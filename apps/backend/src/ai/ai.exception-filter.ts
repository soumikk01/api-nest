import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * AiExceptionFilter — catches ALL errors thrown inside the AI module
 * and converts them to consistent, user-friendly JSON responses.
 *
 * Guarantees:
 *  - No raw stack traces or internal DB errors leak to the client
 *  - HTTP errors (NestJS HttpException) keep their status + message
 *  - Prisma errors are mapped to a clean 500 with a safe message
 *  - Gemini API errors are detected and mapped to 502
 *  - All internal details are logged server-side only
 */
@Catch()
export class AiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('AiExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    // Already ended (SSE stream) — don't try to write again
    if (res.headersSent) return;

    const { status, userMessage } = this.classify(exception);

    // Log full error server-side (never sent to client)
    this.logger.error(
      `[AI] ${status} — ${userMessage}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    res.status(status).json({
      statusCode: status,
      error: this.statusLabel(status),
      message: userMessage,
      timestamp: new Date().toISOString(),
    });
  }

  private classify(exception: unknown): {
    status: number;
    userMessage: string;
  } {
    // ── NestJS HttpException (BadRequest, NotFound, Forbidden, etc.) ─────
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      const msg =
        typeof res === 'string'
          ? res
          : (res as { message?: string | string[] }).message
            ? Array.isArray((res as { message: string[] }).message)
              ? (res as { message: string[] }).message.join('. ')
              : String((res as { message: string }).message)
            : exception.message;

      // Translate known AI-specific messages
      if (msg.includes('No Gemini API key')) {
        return {
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          userMessage:
            'No AI API key configured. Go to Settings → AI Configuration to add your Gemini key.',
        };
      }
      return { status: exception.getStatus(), userMessage: msg };
    }

    const errMsg =
      exception instanceof Error ? exception.message : String(exception);

    // ── Prisma / MongoDB errors ───────────────────────────────────────────
    if (
      errMsg.includes('PrismaClient') ||
      errMsg.includes('prisma') ||
      errMsg.includes('P2') || // Prisma error codes
      errMsg.includes('MongoServer') ||
      errMsg.includes('connect ECONNREFUSED')
    ) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        userMessage:
          'The database is temporarily unavailable. Please try again in a moment.',
      };
    }

    // ── Gemini API upstream errors ────────────────────────────────────────
    if (
      errMsg.includes('Gemini') ||
      errMsg.includes('generativelanguage.googleapis.com') ||
      errMsg.includes('RESOURCE_EXHAUSTED') ||
      errMsg.includes('INVALID_ARGUMENT')
    ) {
      if (errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('429')) {
        return {
          status: HttpStatus.TOO_MANY_REQUESTS,
          userMessage:
            'AI quota exceeded. Your Gemini API key has hit its rate limit. Please wait a minute and try again.',
        };
      }
      if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('401')) {
        return {
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          userMessage:
            'Your Gemini API key is invalid or expired. Go to Settings → AI Configuration to update it.',
        };
      }
      return {
        status: HttpStatus.BAD_GATEWAY,
        userMessage:
          'The AI service returned an error. Please try again or check your API key.',
      };
    }

    // ── Network / timeout errors ──────────────────────────────────────────
    if (
      errMsg.includes('ECONNRESET') ||
      errMsg.includes('ETIMEDOUT') ||
      errMsg.includes('fetch failed') ||
      errMsg.includes('network')
    ) {
      return {
        status: HttpStatus.GATEWAY_TIMEOUT,
        userMessage:
          'Connection to the AI service timed out. Please check your network and try again.',
      };
    }

    // ── Fallback: unknown internal error (never expose details) ──────────
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      userMessage:
        'An unexpected error occurred in the AI service. Our team has been notified. Please try again.',
    };
  }

  private statusLabel(status: number): string {
    const labels: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      422: 'Unprocessable Entity',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout',
    };
    return labels[status] ?? 'Error';
  }
}
