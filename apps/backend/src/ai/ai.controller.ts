import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  UseFilters,
  HttpCode,
  HttpStatus,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { Request } from 'express';
import { AiService } from './ai.service';
import { StartConversationDto, SendMessageDto, SetApiKeyDto } from './dto/ai.dto';
import { AiExceptionFilter } from './ai.exception-filter';
import { Throttle } from '@nestjs/throttler';
import { AdminGuard } from '../auth/guards/admin.guard';

interface AuthedRequest extends Request {
  user: { userId: string; email: string };
}

@Controller('ai')
@UseGuards(AuthGuard('jwt'))
@UseFilters(AiExceptionFilter)
export class AiController {
  constructor(private readonly ai: AiService) {}

  // ── Per-user API Key management ───────────────────────────────────────────

  /** GET /api/v1/ai/key — returns masked key status */
  @Get('key')
  getKeyStatus(@Req() req: AuthedRequest) {
    return this.ai.getApiKeyStatus(req.user.userId);
  }

  /** POST /api/v1/ai/key — save / update user's Gemini key */
  @Post('key')
  @Throttle({ long: { limit: 10, ttl: 60_000 } })
  async saveKey(@Req() req: AuthedRequest, @Body() dto: SetApiKeyDto) {
    await this.ai.saveApiKey(req.user.userId, dto.geminiApiKey);
    return { success: true, message: 'API key saved successfully' };
  }

  /** DELETE /api/v1/ai/key — remove user's Gemini key */
  @Delete('key')
  async removeKey(@Req() req: AuthedRequest) {
    await this.ai.removeApiKey(req.user.userId);
    return { success: true, message: 'API key removed' };
  }

  /** POST /api/v1/ai/key/test — validate key against provider */
  @Post('key/test')
  @Throttle({ long: { limit: 10, ttl: 60_000 } })
  testKey(@Body() body: { apiKey: string }) {
    if (!body.apiKey?.trim()) throw new BadRequestException('apiKey is required');
    return this.ai.testApiKey(body.apiKey.trim());
  }

  // ── Platform-wide API Key (admin-managed, applies to ALL users) ───────────

  /** GET /api/v1/ai/platform-key — get platform key status (admin only) */
  @Get('platform-key')
  @UseGuards(AdminGuard)
  getPlatformKeyStatus() {
    return this.ai.getPlatformKeyStatus();
  }

  /** POST /api/v1/ai/platform-key — set platform key (admin only) */
  @Post('platform-key')
  @UseGuards(AdminGuard)
  @Throttle({ long: { limit: 10, ttl: 60_000 } })
  async setPlatformKey(@Req() req: AuthedRequest, @Body() dto: SetApiKeyDto) {
    await this.ai.setPlatformKey(dto.geminiApiKey, req.user.userId);
    return { success: true, message: 'Platform API key saved. All users will now use this key.' };
  }

  /** DELETE /api/v1/ai/platform-key — remove platform key (admin only) */
  @Delete('platform-key')
  @UseGuards(AdminGuard)
  async removePlatformKey() {
    await this.ai.removePlatformKey();
    return { success: true, message: 'Platform API key removed.' };
  }

  // ── Conversations ─────────────────────────────────────────────────────────

  /** GET /api/v1/ai/conversations */
  @Get('conversations')
  listConversations(
    @Req() req: AuthedRequest,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.ai.listConversations(req.user.userId, isNaN(parsedLimit) ? 20 : parsedLimit);
  }

  /** POST /api/v1/ai/conversations — start a new thread */
  @Post('conversations')
  @HttpCode(HttpStatus.CREATED)
  startConversation(@Req() req: AuthedRequest, @Body() dto: StartConversationDto) {
    return this.ai.startConversation(req.user.userId, dto.context, dto.mode);
  }

  /** GET /api/v1/ai/conversations/:id */
  @Get('conversations/:id')
  getConversation(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.ai.getConversation(req.user.userId, id);
  }

  /** DELETE /api/v1/ai/conversations/:id */
  @Delete('conversations/:id')
  deleteConversation(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.ai.deleteConversation(req.user.userId, id);
  }

  // ── Streaming chat (SSE) ──────────────────────────────────────────────────

  /**
   * POST /api/v1/ai/chat/stream
   * Body: { conversationId: string; content: string }
   * Returns: text/event-stream
   *   data: <chunk>\n\n   (newlines inside chunks escaped as \\n)
   *   data: [DONE]\n\n
   *   data: [ERROR] <message>\n\n
   */
  @Post('chat/stream')
  @Throttle({ medium: { limit: 60, ttl: 60_000 } })
  async streamChat(
    @Req() req: AuthedRequest,
    @Res() res: Response,
    @Body() dto: SendMessageDto,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      for await (const chunk of this.ai.streamMessage(
        req.user.userId,
        dto.conversationId,
        dto.content,
      )) {
        // Escape embedded newlines so SSE framing is never broken
        res.write(`data: ${chunk.replace(/\n/g, '\\n')}\n\n`);
      }
      res.write('data: [DONE]\n\n');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.write(`data: [ERROR] ${msg}\n\n`);
    } finally {
      res.end();
    }
  }

  /**
   * POST /api/v1/ai/chat
   * Non-streaming — returns full JSON response.
   */
  @Post('chat')
  @Throttle({ medium: { limit: 60, ttl: 60_000 } })
  chat(@Req() req: AuthedRequest, @Body() dto: SendMessageDto) {
    return this.ai.chat(req.user.userId, dto.conversationId, dto.content);
  }
}
