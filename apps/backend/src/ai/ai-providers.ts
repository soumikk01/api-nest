/**
 * ai-providers.ts
 *
 * Multi-provider AI abstraction layer.
 * Supports: Gemini, NVIDIA NIM, OpenAI, Anthropic, OpenRouter.
 *
 * Key detection is done from the key prefix — no manual config needed.
 * All providers expose the same streaming AsyncGenerator interface.
 */

export type AiProvider =
  | 'gemini'
  | 'openai'
  | 'nvidia'
  | 'anthropic'
  | 'openrouter'
  | 'unknown';

export interface ProviderInfo {
  provider: AiProvider;
  name: string; // Human-readable
  model: string; // Default model for this provider
  badge: string; // Short label for UI badge
  baseUrl?: string; // OpenAI-compatible base URL (if applicable)
}

// ── Auto-detect provider from key prefix ─────────────────────────────────────
export function detectProvider(apiKey: string): ProviderInfo {
  const k = apiKey.trim();

  if (k.startsWith('AIza')) {
    return {
      provider: 'gemini',
      name: 'Google Gemini',
      model: 'gemini-2.0-flash',
      badge: 'Gemini',
    };
  }
  if (k.startsWith('nvapi-')) {
    return {
      provider: 'nvidia',
      name: 'NVIDIA NIM',
      model: 'meta/llama-3.1-70b-instruct',
      badge: 'NVIDIA',
      baseUrl: 'https://integrate.api.nvidia.com/v1',
    };
  }
  if (k.startsWith('sk-ant-')) {
    return {
      provider: 'anthropic',
      name: 'Anthropic Claude',
      model: 'claude-3-5-haiku-20241022',
      badge: 'Claude',
    };
  }
  if (k.startsWith('sk-or-')) {
    return {
      provider: 'openrouter',
      name: 'OpenRouter',
      model: 'openai/gpt-4o-mini',
      badge: 'OpenRouter',
      baseUrl: 'https://openrouter.ai/api/v1',
    };
  }
  if (k.startsWith('sk-')) {
    return {
      provider: 'openai',
      name: 'OpenAI',
      model: 'gpt-4o-mini',
      badge: 'OpenAI',
    };
  }

  return {
    provider: 'unknown',
    name: 'Unknown Provider',
    model: '',
    badge: '?',
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Shared message format used internally before converting per-provider */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ── Test / validate a key ─────────────────────────────────────────────────────
export async function testProviderKey(
  apiKey: string,
): Promise<{ valid: boolean; message: string; provider: string }> {
  const info = detectProvider(apiKey);

  if (info.provider === 'unknown') {
    return {
      valid: false,
      provider: 'Unknown',
      message:
        '✗ Unrecognized key format. Supported: Gemini (AIzaSy...), NVIDIA (nvapi-...), OpenAI (sk-...), Anthropic (sk-ant-...), OpenRouter (sk-or-...).',
    };
  }

  try {
    switch (info.provider) {
      case 'gemini':
        return await testGemini(apiKey, info);
      case 'openai':
        return await testOpenAiCompat(apiKey, info);
      case 'nvidia':
        return await testOpenAiCompat(apiKey, info);
      case 'openrouter':
        return await testOpenAiCompat(apiKey, info);
      case 'anthropic':
        return await testAnthropic(apiKey, info);
      default:
        return {
          valid: false,
          provider: info.name,
          message: '✗ Provider not supported yet.',
        };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) {
      return {
        valid: false,
        provider: info.name,
        message: `✗ Request timed out. Check your network.`,
      };
    }
    return {
      valid: false,
      provider: info.name,
      message: `✗ Connection failed: ${msg.slice(0, 120)}`,
    };
  }
}

async function testGemini(apiKey: string, info: ProviderInfo) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${info.model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Reply with one word: OK' }] }],
      }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (res.ok)
    return {
      valid: true,
      provider: info.name,
      message: `✓ ${info.name} key is valid and ready.`,
    };
  const err = (await res.json()) as { error?: { message?: string } };
  const msg = err?.error?.message ?? `HTTP ${res.status}`;
  if (res.status === 400 && msg.includes('API_KEY_INVALID'))
    return {
      valid: false,
      provider: info.name,
      message: '✗ Invalid Gemini API key.',
    };
  if (res.status === 429)
    return {
      valid: false,
      provider: info.name,
      message: '✗ Rate limit hit — key is valid but busy.',
    };
  return { valid: false, provider: info.name, message: `✗ ${msg}` };
}

async function testOpenAiCompat(apiKey: string, info: ProviderInfo) {
  const base = info.baseUrl ?? 'https://api.openai.com/v1';

  // NVIDIA NIM and OpenRouter don't allow GET /models with all key types.
  // Use a minimal 1-token chat completion instead — more reliable across all providers.
  if (info.provider === 'nvidia' || info.provider === 'openrouter') {
    return testViaCompletion(apiKey, info, base);
  }

  // OpenAI: GET /models is cheap and works correctly
  const res = await fetch(`${base}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.ok)
    return {
      valid: true,
      provider: info.name,
      message: `✓ ${info.name} key is valid and ready.`,
    };
  const body = await res.text().catch(() => '');
  if (res.status === 401)
    return {
      valid: false,
      provider: info.name,
      message: `✗ Invalid ${info.name} API key.`,
    };
  if (res.status === 403)
    return {
      valid: false,
      provider: info.name,
      message: `✗ ${info.name} key lacks required permissions.`,
    };
  if (res.status === 429)
    return {
      valid: false,
      provider: info.name,
      message: `✗ Rate limit hit — key is valid but busy.`,
    };
  return {
    valid: false,
    provider: info.name,
    message: `✗ HTTP ${res.status}: ${body.slice(0, 120)}`,
  };
}

/** Test via a minimal 1-token chat completion (used for NVIDIA, OpenRouter) */
async function testViaCompletion(
  apiKey: string,
  info: ProviderInfo,
  base: string,
) {
  const extraHeaders: Record<string, string> = {};
  if (info.provider === 'openrouter') {
    extraHeaders['HTTP-Referer'] = 'https://apio.dev';
    extraHeaders['X-Title'] = 'Apio AI Assistant';
  }

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model: info.model,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'Hi' }],
    }),
    signal: AbortSignal.timeout(20_000), // completions can be slower
  });

  if (res.ok)
    return {
      valid: true,
      provider: info.name,
      message: `✓ ${info.name} key is valid and ready.`,
    };

  const body = await res.text().catch(() => '');
  if (res.status === 401)
    return {
      valid: false,
      provider: info.name,
      message: `✗ Invalid ${info.name} API key. Double-check and try again.`,
    };
  if (res.status === 402)
    return {
      valid: false,
      provider: info.name,
      message: `✗ ${info.name} account has no credits. Please top up.`,
    };
  if (res.status === 403)
    return {
      valid: false,
      provider: info.name,
      message: `✗ ${info.name} key does not have access to model "${info.model}".`,
    };
  if (res.status === 429)
    return {
      valid: false,
      provider: info.name,
      message: `✗ Rate limit hit — key is valid but quota exceeded. Try again shortly.`,
    };
  if (res.status === 404)
    return {
      valid: false,
      provider: info.name,
      message: `✗ Model "${info.model}" not found on ${info.name}. The key may be valid — try chatting directly.`,
    };

  // Extract error message if JSON
  try {
    const json = JSON.parse(body) as {
      error?: { message?: string };
      message?: string;
    };
    const msg = json?.error?.message ?? json?.message ?? `HTTP ${res.status}`;
    return {
      valid: false,
      provider: info.name,
      message: `✗ ${msg.slice(0, 200)}`,
    };
  } catch {
    return {
      valid: false,
      provider: info.name,
      message: `✗ HTTP ${res.status}: ${body.slice(0, 120)}`,
    };
  }
}

async function testAnthropic(apiKey: string, info: ProviderInfo) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: info.model,
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Reply with one word: OK' }],
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (res.ok)
    return {
      valid: true,
      provider: info.name,
      message: `✓ ${info.name} key is valid and ready.`,
    };
  const err = (await res.json().catch(() => ({}))) as {
    error?: { message?: string; type?: string };
  };
  const msg = err?.error?.message ?? `HTTP ${res.status}`;
  if (res.status === 401)
    return {
      valid: false,
      provider: info.name,
      message: `✗ Invalid Anthropic API key.`,
    };
  if (res.status === 403)
    return {
      valid: false,
      provider: info.name,
      message: `✗ Anthropic key is inactive or lacks credit.`,
    };
  if (res.status === 429)
    return {
      valid: false,
      provider: info.name,
      message: `✗ Anthropic rate limit hit — key is valid.`,
    };
  return { valid: false, provider: info.name, message: `✗ ${msg}` };
}

// ── Streaming chat ────────────────────────────────────────────────────────────

/** Main streaming entry point — routes to correct provider */
export async function* streamProviderChat(
  apiKey: string,
  messages: ChatMessage[],
  systemPrompt: string,
): AsyncGenerator<string> {
  const info = detectProvider(apiKey);
  switch (info.provider) {
    case 'gemini':
      yield* streamGemini(apiKey, info, messages, systemPrompt);
      break;
    case 'openai':
    case 'nvidia':
    case 'openrouter':
      yield* streamOpenAiCompat(apiKey, info, messages, systemPrompt);
      break;
    case 'anthropic':
      yield* streamAnthropic(apiKey, info, messages, systemPrompt);
      break;
    default:
      throw new Error(
        'Unrecognized API key format. Supported providers: Gemini (AIzaSy...), NVIDIA (nvapi-...), OpenAI (sk-...), Anthropic (sk-ant-...), OpenRouter (sk-or-...).',
      );
  }
}

// ── Gemini streaming ──────────────────────────────────────────────────────────

interface GeminiContent {
  role: 'user' | 'model';
  parts: { text: string }[];
}
interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

async function* streamGemini(
  apiKey: string,
  info: ProviderInfo,
  messages: ChatMessage[],
  systemPrompt: string,
): AsyncGenerator<string> {
  const contents: GeminiContent[] = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${info.model}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.65, maxOutputTokens: 1500 },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 400 && body.includes('API_KEY_INVALID'))
      throw new Error(
        'Your Gemini API key is invalid or expired. Update it in Settings → AI Configuration.',
      );
    if (res.status === 429)
      throw new Error(
        'Gemini rate limit reached. Please wait a moment and try again.',
      );
    throw new Error(`Gemini API error (${res.status}). Please try again.`);
  }

  yield* readSseStream(res, (json) => {
    const parsed = JSON.parse(json) as GeminiResponse;
    return parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  });
}

// ── OpenAI-compatible streaming (OpenAI, NVIDIA, OpenRouter) ──────────────────

interface OAIChunk {
  choices?: { delta?: { content?: string } }[];
}

async function* streamOpenAiCompat(
  apiKey: string,
  info: ProviderInfo,
  messages: ChatMessage[],
  systemPrompt: string,
): AsyncGenerator<string> {
  const base = info.baseUrl ?? 'https://api.openai.com/v1';

  const body: Record<string, unknown> = {
    model: info.model,
    stream: true,
    temperature: 0.65,
    max_tokens: 1500,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  };

  // NVIDIA NIM requires stream_options for token counting
  if (info.provider === 'nvidia') {
    body['stream_options'] = { include_usage: false };
  }

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      // OpenRouter requires these headers
      ...(info.provider === 'openrouter'
        ? {
            'HTTP-Referer': 'https://apio.dev',
            'X-Title': 'Apio AI Assistant',
          }
        : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    if (res.status === 401)
      throw new Error(
        `Your ${info.name} API key is invalid or expired. Update it in Settings → AI Configuration.`,
      );
    if (res.status === 429)
      throw new Error(
        `${info.name} rate limit reached. Please wait a moment and try again.`,
      );
    if (res.status === 402)
      throw new Error(
        `${info.name} account has insufficient credits. Please top up your account.`,
      );
    throw new Error(
      `${info.name} API error (${res.status}). Please try again.`,
    );
  }

  yield* readSseStream(res, (json) => {
    if (json === '[DONE]') return '';
    const parsed = JSON.parse(json) as OAIChunk;
    return parsed.choices?.[0]?.delta?.content ?? '';
  });
}

// ── Anthropic streaming ───────────────────────────────────────────────────────

interface AnthropicEvent {
  type: string;
  delta?: { type: string; text?: string };
}

async function* streamAnthropic(
  apiKey: string,
  info: ProviderInfo,
  messages: ChatMessage[],
  systemPrompt: string,
): AsyncGenerator<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: info.model,
      max_tokens: 1500,
      system: systemPrompt,
      stream: true,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!res.ok) {
    if (res.status === 401)
      throw new Error(
        'Your Anthropic API key is invalid or expired. Update it in Settings → AI Configuration.',
      );
    if (res.status === 429)
      throw new Error(
        'Anthropic rate limit reached. Please wait a moment and try again.',
      );
    if (res.status === 529)
      throw new Error('Anthropic is overloaded. Please try again in a moment.');
    throw new Error(`Anthropic API error (${res.status}). Please try again.`);
  }

  yield* readSseStream(res, (json) => {
    const ev = JSON.parse(json) as AnthropicEvent;
    if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
      return ev.delta.text ?? '';
    }
    return '';
  });
}

// ── Shared SSE reader ─────────────────────────────────────────────────────────
async function* readSseStream(
  res: Response,
  extract: (json: string) => string,
): AsyncGenerator<string> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const json = line.slice(6).trim();
        if (!json || json === '[DONE]') continue;
        try {
          const text = extract(json);
          if (text) yield text;
        } catch {
          /* skip malformed frame */
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
