import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import type { AiContextDto } from './dto/ai.dto';
import {
  detectProvider,
  testProviderKey,
  streamProviderChat,
} from './ai-providers';

// ── Cache TTLs ────────────────────────────────────────────────────────────────
const CONVERSATION_LIST_TTL = 60; // 60 s  — conversation list per user
const CONVERSATION_DETAIL_TTL = 300; // 5 min — full conversation + messages
const API_KEY_TTL = 3600; // 1 h   — resolved API key cache

// ── Prisma error code helpers ─────────────────────────────────────────────────
function isPrismaUnavailable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('PrismaClient') ||
    msg.includes('P1001') || // Can't reach database server
    msg.includes('P1008') || // Operations timed out
    msg.includes('P1017') || // Server closed connection
    msg.includes('connect ECONNREFUSED') ||
    msg.includes('MongoServerError') ||
    msg.includes('ENOTFOUND')
  );
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly config: ConfigService,
  ) {}

  // ── Cache key builders ────────────────────────────────────────────────────
  private listKey(userId: string) {
    return `ai:convlist:${userId}`;
  }
  private detailKey(conversationId: string) {
    return `ai:conv:${conversationId}`;
  }
  private apiKeyCache(userId: string) {
    return `ai:gemkey:${userId}`;
  }
  private readonly PLATFORM_KEY_CACHE = 'ai:platform:gemkey'; // global key
  private readonly PLATFORM_KEY_DB = 'gemini_api_key'; // PlatformConfig.key

  // ── Internal: resolve Gemini API key ─────────────────────────────────────
  // Priority: env GEMINI_API_KEY → Platform key (Admin Panel) → per-user key
  private async resolveApiKey(userId: string): Promise<string> {
    // Priority 1 — server env var (overrides everything)
    const envKey = this.config.get<string>('GEMINI_API_KEY');
    if (envKey?.trim()) return envKey.trim();

    // Priority 2 — Platform-wide key set in Admin Panel (cached in Redis)
    try {
      const cachedPlatform = await this.cache.get<string>(
        this.PLATFORM_KEY_CACHE,
      );
      if (cachedPlatform) return cachedPlatform;
    } catch {
      /* non-fatal */
    }

    try {
      const cfg = await this.prisma.platformConfig.findUnique({
        where: { key: this.PLATFORM_KEY_DB },
      });
      if (cfg?.value) {
        try {
          await this.cache.set(this.PLATFORM_KEY_CACHE, cfg.value, API_KEY_TTL);
        } catch {
          /* non-fatal */
        }
        return cfg.value;
      }
    } catch (err) {
      this.logger.warn('[AI] Could not read platform key from DB', err);
      // Non-fatal: fall through to per-user key
    }

    // Priority 3 — Redis cache for per-user key
    try {
      const cached = await this.cache.get<string>(this.apiKeyCache(userId));
      if (cached) return cached;
    } catch {
      /* non-fatal */
    }

    // Priority 4 — MongoDB per-user key
    let user: { geminiApiKey: string | null } | null;
    try {
      user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { geminiApiKey: true },
      });
    } catch (err) {
      this.logger.error('[AI] DB error resolving API key', err);
      if (isPrismaUnavailable(err)) {
        throw new ServiceUnavailableException(
          'The database is temporarily unavailable. Please try again in a moment.',
        );
      }
      throw new InternalServerErrorException(
        'Could not retrieve your API key. Please try again.',
      );
    }

    const key = user?.geminiApiKey;
    if (!key) {
      throw new BadRequestException(
        'No Gemini API key configured. Ask your admin to set a Platform key in Settings → AI Configuration.',
      );
    }

    try {
      await this.cache.set(this.apiKeyCache(userId), key, API_KEY_TTL);
    } catch {
      /* non-fatal */
    }
    return key;
  }

  // ── Platform-wide key (Admin Panel managed) ───────────────────────────────

  async getPlatformKeyStatus(): Promise<{
    configured: boolean;
    preview: string;
    updatedAt: Date | null;
    envOverride: boolean;
  }> {
    const envKey = this.config.get<string>('GEMINI_API_KEY');
    if (envKey?.trim()) {
      return {
        configured: true,
        preview: 'Set via environment variable (GEMINI_API_KEY)',
        updatedAt: null,
        envOverride: true,
      };
    }
    try {
      const cfg = await this.prisma.platformConfig.findUnique({
        where: { key: this.PLATFORM_KEY_DB },
      });
      if (!cfg?.value)
        return {
          configured: false,
          preview: '',
          updatedAt: null,
          envOverride: false,
        };
      const preview =
        cfg.value.slice(0, 8) +
        '•'.repeat(Math.max(0, cfg.value.length - 12)) +
        cfg.value.slice(-4);
      return {
        configured: true,
        preview,
        updatedAt: cfg.updatedAt,
        envOverride: false,
      };
    } catch {
      return {
        configured: false,
        preview: '',
        updatedAt: null,
        envOverride: false,
      };
    }
  }

  async setPlatformKey(apiKey: string, updatedBy: string): Promise<void> {
    try {
      await this.prisma.platformConfig.upsert({
        where: { key: this.PLATFORM_KEY_DB },
        update: { value: apiKey.trim(), updatedBy },
        create: { key: this.PLATFORM_KEY_DB, value: apiKey.trim(), updatedBy },
      });
    } catch (err) {
      this.logger.error('[AI] Failed to save platform key', err);
      throw isPrismaUnavailable(err)
        ? new ServiceUnavailableException(
            'Database unavailable. Please try again.',
          )
        : new InternalServerErrorException(
            'Could not save the platform key. Please try again.',
          );
    }
    // Bust Redis cache so next request picks up new key immediately
    try {
      await this.cache.del(this.PLATFORM_KEY_CACHE);
    } catch {
      /* non-fatal */
    }
    this.logger.log(`[AI] Platform Gemini key updated by user ${updatedBy}`);
  }

  async removePlatformKey(): Promise<void> {
    try {
      await this.prisma.platformConfig.deleteMany({
        where: { key: this.PLATFORM_KEY_DB },
      });
    } catch (err) {
      this.logger.error('[AI] Failed to remove platform key', err);
      throw isPrismaUnavailable(err)
        ? new ServiceUnavailableException(
            'Database unavailable. Please try again.',
          )
        : new InternalServerErrorException(
            'Could not remove the platform key. Please try again.',
          );
    }
    try {
      await this.cache.del(this.PLATFORM_KEY_CACHE);
    } catch {
      /* non-fatal */
    }
    this.logger.log('[AI] Platform Gemini key removed');
  }

  // ── Save per-user Gemini key to DB + bust cache ───────────────────────────
  async saveApiKey(userId: string, geminiApiKey: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { geminiApiKey: geminiApiKey.trim() },
      });
    } catch (err) {
      this.logger.error('[AI] DB error saving API key', err);
      throw isPrismaUnavailable(err)
        ? new ServiceUnavailableException(
            'Database unavailable. Please try again.',
          )
        : new InternalServerErrorException(
            'Could not save API key. Please try again.',
          );
    }
    try {
      await this.cache.del(this.apiKeyCache(userId));
    } catch {
      /* non-fatal */
    }
    const info = detectProvider(geminiApiKey);
    this.logger.log(`[AI] Saved ${info.name} key for user ${userId}`);
  }

  // ── Remove per-user key ───────────────────────────────────────────────────
  async removeApiKey(userId: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { geminiApiKey: null },
      });
    } catch (err) {
      this.logger.error('[AI] DB error removing API key', err);
      throw isPrismaUnavailable(err)
        ? new ServiceUnavailableException(
            'Database unavailable. Please try again.',
          )
        : new InternalServerErrorException(
            'Could not remove API key. Please try again.',
          );
    }
    try {
      await this.cache.del(this.apiKeyCache(userId));
    } catch {
      /* non-fatal */
    }
    this.logger.log(`[AI] Removed Gemini key for user ${userId}`);
  }

  // ── Get masked key status ─────────────────────────────────────────────────
  async getApiKeyStatus(userId: string): Promise<{
    configured: boolean;
    serverManaged: boolean;
    preview: string;
    provider?: string;
  }> {
    const serverKey = this.config.get<string>('GEMINI_API_KEY');
    if (serverKey?.trim()) {
      return {
        configured: true,
        serverManaged: true,
        preview: 'Server-managed key',
      };
    }

    let user: { geminiApiKey: string | null } | null = null;
    try {
      user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { geminiApiKey: true },
      });
    } catch (err) {
      this.logger.warn(
        '[AI] DB error fetching key status — returning unconfigured',
        err,
      );
      // Non-fatal: return "not configured" rather than crashing
      return { configured: false, serverManaged: false, preview: '' };
    }

    const key = user?.geminiApiKey;
    if (!key) return { configured: false, serverManaged: false, preview: '' };

    const info = detectProvider(key);
    const preview =
      key.slice(0, 8) +
      '\u2022'.repeat(Math.max(0, key.length - 12)) +
      key.slice(-4);
    return {
      configured: true,
      serverManaged: false,
      preview,
      provider: info.name,
    };
  }

  // ── Validate a key (any provider) before saving ──────────────────────────
  async testApiKey(
    apiKey: string,
  ): Promise<{ valid: boolean; message: string; provider?: string }> {
    return testProviderKey(apiKey);
  }

  // ── Start conversation (persisted to MongoDB) ─────────────────────────────
  async startConversation(
    userId: string,
    context?: AiContextDto,
    mode?: 'user' | 'admin',
  ) {
    const title = context?.endpoint
      ? `${context.method ?? 'ERR'} ${context.endpoint} — ${context.statusCode ?? '?'}`
      : 'General AI Chat';

    // Embed mode into context so streamMessage can pick the right prompt
    const contextWithMode = context
      ? { ...(context as Record<string, unknown>), _mode: mode ?? 'user' }
      : mode
        ? { _mode: mode }
        : undefined;

    let conversation: {
      id: string;
      userId: string;
      title: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
    try {
      conversation = await this.prisma.aiConversation.create({
        data: {
          userId,
          title,
          context: contextWithMode
            ? (contextWithMode as unknown as Prisma.InputJsonValue)
            : undefined,
        },
      });
    } catch (err) {
      this.logger.error('[AI] Failed to create conversation', err);
      throw isPrismaUnavailable(err)
        ? new ServiceUnavailableException(
            'The database is temporarily unavailable. Please try again in a moment.',
          )
        : new InternalServerErrorException(
            'Could not start the AI session. Please try again.',
          );
    }

    try {
      await this.cache.del(this.listKey(userId));
    } catch {
      /* non-fatal */
    }
    this.logger.log(
      `[AI] New conversation ${conversation.id} for ${userId} [mode=${mode ?? 'user'}]`,
    );
    return conversation;
  }

  // ── List conversations (Redis-cached) ─────────────────────────────────────
  async listConversations(userId: string, limit = 20) {
    const cacheKey = this.listKey(userId);
    try {
      const cached = await this.cache.get<unknown[]>(cacheKey);
      if (cached) return cached;
    } catch {
      /* non-fatal */
    }

    let conversations: unknown[];
    try {
      conversations = await this.prisma.aiConversation.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: Math.min(limit, 50),
        select: {
          id: true,
          title: true,
          context: true,
          createdAt: true,
          updatedAt: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { content: true, role: true, createdAt: true },
          },
        },
      });
    } catch (err) {
      this.logger.error('[AI] Failed to list conversations', err);
      throw isPrismaUnavailable(err)
        ? new ServiceUnavailableException(
            'Database unavailable. Please try again.',
          )
        : new InternalServerErrorException(
            'Could not load conversations. Please refresh.',
          );
    }

    try {
      await this.cache.set(cacheKey, conversations, CONVERSATION_LIST_TTL);
    } catch {
      /* non-fatal */
    }
    return conversations;
  }

  // ── Get single conversation + messages (Redis-cached) ────────────────────
  async getConversation(userId: string, conversationId: string) {
    const cacheKey = this.detailKey(conversationId);
    try {
      const cached = await this.cache.get<unknown>(cacheKey);
      if (cached) return cached;
    } catch {
      /* non-fatal */
    }

    let conversation: { userId: string; messages: unknown[] } | null;
    try {
      conversation = (await this.prisma.aiConversation.findUnique({
        where: { id: conversationId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      })) as typeof conversation;
    } catch (err) {
      this.logger.error('[AI] Failed to load conversation', err);
      throw isPrismaUnavailable(err)
        ? new ServiceUnavailableException(
            'Database unavailable. Please try again.',
          )
        : new InternalServerErrorException(
            'Could not load this conversation. Please refresh.',
          );
    }

    if (!conversation) throw new NotFoundException('Conversation not found.');
    if (conversation.userId !== userId)
      throw new ForbiddenException('Access denied.');

    try {
      await this.cache.set(cacheKey, conversation, CONVERSATION_DETAIL_TTL);
    } catch {
      /* non-fatal */
    }
    return conversation;
  }

  // ── Delete conversation ───────────────────────────────────────────────────
  async deleteConversation(userId: string, conversationId: string) {
    let conv: { userId: string } | null;
    try {
      conv = await this.prisma.aiConversation.findUnique({
        where: { id: conversationId },
        select: { userId: true },
      });
    } catch (err) {
      throw isPrismaUnavailable(err)
        ? new ServiceUnavailableException(
            'Database unavailable. Please try again.',
          )
        : new InternalServerErrorException('Could not find this conversation.');
    }

    if (!conv) throw new NotFoundException('Conversation not found.');
    if (conv.userId !== userId) throw new ForbiddenException('Access denied.');

    try {
      await this.prisma.aiConversation.delete({
        where: { id: conversationId },
      });
    } catch (err) {
      throw isPrismaUnavailable(err)
        ? new ServiceUnavailableException(
            'Database unavailable. Please try again.',
          )
        : new InternalServerErrorException(
            'Could not delete this conversation.',
          );
    }

    try {
      await this.cache.del(
        this.detailKey(conversationId),
        this.listKey(userId),
      );
    } catch {
      /* non-fatal */
    }
    return { deleted: true };
  }

  // ── Stream response via auto-detected AI provider ─────────────────────────
  async *streamMessage(
    userId: string,
    conversationId: string,
    userContent: string,
  ): AsyncGenerator<string> {
    // 1. Load & verify ownership
    let conversation: {
      userId: string;
      context: unknown;
      messages: { role: string; content: string }[];
    } | null;
    try {
      conversation = (await this.prisma.aiConversation.findUnique({
        where: { id: conversationId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      })) as typeof conversation;
    } catch (err) {
      throw isPrismaUnavailable(err)
        ? new ServiceUnavailableException(
            'Database unavailable. Please try again in a moment.',
          )
        : new InternalServerErrorException(
            'Could not load this conversation. Please refresh.',
          );
    }

    if (!conversation) throw new NotFoundException('Conversation not found.');
    if (conversation.userId !== userId)
      throw new ForbiddenException('Access denied.');

    // 2. Resolve API key (env > platform key > per-user key)
    const apiKey = await this.resolveApiKey(userId);

    // 3. Persist user message immediately (durable before stream starts)
    try {
      await this.prisma.aiMessage.create({
        data: { conversationId, role: 'user', content: userContent },
      });
    } catch (err) {
      this.logger.warn(
        '[AI] Could not save user message — continuing stream',
        err,
      );
    }

    // 4. Build message history + system prompt (mode stored in context._mode)
    const ctx = conversation.context as
      | (AiContextDto & { _mode?: string })
      | null;
    const isUserMode = !ctx?._mode || ctx._mode === 'user';
    const systemPrompt = isUserMode
      ? this.buildUserSystemPrompt(ctx)
      : this.buildSystemPrompt(ctx);

    const messages = [
      ...conversation.messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: userContent },
    ];

    // 5. Stream from auto-detected provider (Gemini / NVIDIA / OpenAI / Anthropic / OpenRouter)
    let fullResponse = '';
    try {
      for await (const chunk of streamProviderChat(
        apiKey,
        messages,
        systemPrompt,
      )) {
        fullResponse += chunk;
        yield chunk;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[AI] Stream error: ${msg}`);
      // Re-throw as a user-friendly BadRequestException (caught by AiExceptionFilter)
      throw new BadRequestException(msg);
    }

    // 6. Persist assistant response + update conversation timestamp
    if (fullResponse) {
      try {
        await this.prisma.aiMessage.create({
          data: { conversationId, role: 'assistant', content: fullResponse },
        });
        await this.prisma.aiConversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });
      } catch (err) {
        this.logger.warn('[AI] Could not persist assistant message', err);
      }
      try {
        await this.cache.del(
          this.detailKey(conversationId),
          this.listKey(userId),
        );
      } catch {
        /* non-fatal */
      }
    }
  }

  // ── Non-streaming convenience wrapper ─────────────────────────────────────
  async chat(
    userId: string,
    conversationId: string,
    userContent: string,
  ): Promise<{ content: string; conversationId: string }> {
    let fullText = '';
    for await (const chunk of this.streamMessage(
      userId,
      conversationId,
      userContent,
    )) {
      fullText += chunk;
    }
    return { content: fullText, conversationId };
  }

  // ── System prompt builder ─────────────────────────────────────────────────
  private buildSystemPrompt(context: AiContextDto | null | undefined): string {
    const base = `You are Apio AI — a friendly, expert assistant built into the Apio API monitoring dashboard.

Your job is to help developers (from beginners to seniors) understand and fix API issues quickly.

**How you respond:**
- Always use clear, simple language. Avoid overwhelming jargon.
- When you use a technical term (like "status code" or "latency"), briefly explain what it means in plain English.
- Structure your answers with:
  1. A short summary of what happened (1-2 sentences, plain English)
  2. Why it happened (the root cause, explained simply)
  3. How to fix it (step-by-step, numbered, with code examples when useful)
- Use **bold** for important terms, \`code\` for values/commands/endpoints.
- Use bullet points or numbered steps — never write a wall of text.
- End with a friendly note like "Let me know if you need more help!" when appropriate.
- If you don't know something, say so honestly instead of guessing.

**Tone:** Professional, calm, and encouraging. Like a senior engineer patiently helping a teammate.`;

    if (!context) return base;

    return (
      base +
      '\n\n' +
      '---\n' +
      '**The user is looking at this specific API error in their dashboard:**\n\n' +
      `- **Endpoint:** \`${context.endpoint ?? 'Unknown'}\`\n` +
      `- **Method:** \`${context.method ?? 'Unknown'}\`\n` +
      `- **Status Code:** ${context.statusCode ?? 'Unknown'}\n` +
      `- **Error Message:** ${context.errorMessage ?? 'None'}\n` +
      `- **Response Time:** ${context.latency != null ? context.latency + 'ms' : 'Unknown'}\n` +
      `- **Time:** ${context.timestamp ?? 'Unknown'}\n\n` +
      'Diagnose this error. Give: 1) What this error means in plain English, 2) The most likely cause, 3) Exact steps to fix it.'
    );
  }

  // ── System prompt — USER APP (beginner-friendly, warm, non-technical) ─────
  private buildUserSystemPrompt(
    context: (AiContextDto & { _mode?: string }) | null | undefined,
  ): string {
    const base = `You are Apio AI — a helpful assistant inside the Apio API monitoring tool.

You are talking to a developer who may be new to APIs or backend development. Your goal is to make them feel confident and help them solve their problem without feeling overwhelmed.

**Your response style:**
- Start with a single plain-English sentence explaining what happened (no jargon at all).
- Then explain WHY it happened in 2–3 simple sentences. Use real-world analogies where helpful (e.g. "Think of it like a locked door — the server refused entry because...").
- Then give a clear numbered list of steps to fix it. Keep each step short and actionable.
- Use **bold** to highlight the most important words or actions.
- Use \`code formatting\` for anything they need to type, copy, or paste.
- If there is a code example, show it in a proper code block with the language label.
- After the fix steps, add one short encouraging sentence (e.g. "You're almost there — this is one of the most common errors!" or "Once you fix this, your API should work perfectly.").
- NEVER write long unbroken paragraphs. Always use structure.
- If you don't know the answer, say "I'm not 100% sure, but here's what I'd try first..." — never guess confidently.

**Tone:** Warm, patient, and encouraging. Like a friendly senior developer sitting next to a junior colleague.
**Vocabulary:** Assume the user knows basic programming but NOT HTTP internals, server config, or DevOps details.`;

    if (!context || !context.endpoint) return base;

    return (
      base +
      '\n\n' +
      '---\n' +
      '**Here is the API error the user is currently looking at:**\n\n' +
      `- **What was called:** \`${context.method ?? '?'} ${context.endpoint ?? 'Unknown'}\`\n` +
      `- **Error code:** **${context.statusCode ?? 'Unknown'}** *(this is the HTTP status code — the number the server sent back)*\n` +
      `- **Error message:** ${context.errorMessage ?? 'None'}\n` +
      `- **Response time:** ${context.latency != null ? `${context.latency}ms (milliseconds — how long the server took to reply)` : 'Unknown'}\n\n` +
      'Please explain this error in simple language and walk the user through exactly how to fix it, step by step.'
    );
  }
}
