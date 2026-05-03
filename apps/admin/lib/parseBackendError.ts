/**
 * parseBackendError — shared for admin app.
 * Converts raw backend error responses into clean user-facing messages.
 */
export function parseBackendError(raw: unknown): {
  message: string;
  isAbort: boolean;
  isKeyMissing: boolean;
  isAuthError: boolean;
  isRateLimit: boolean;
  isUnavailable: boolean;
} {
  const text =
    raw instanceof Error ? raw.message :
    typeof raw === 'string' ? raw :
    JSON.stringify(raw);

  if (text.includes('AbortError') || text.includes('abort') || text.toLowerCase().includes('the user aborted')) {
    return { message: '', isAbort: true, isKeyMissing: false, isAuthError: false, isRateLimit: false, isUnavailable: false };
  }

  let parsed: { statusCode?: number; message?: string; error?: string } = {};
  try { parsed = JSON.parse(text) as typeof parsed; } catch { /* not JSON */ }

  const msg    = parsed.message ?? text;
  const status = parsed.statusCode ?? 0;

  const isKeyMissing  = msg.includes('No AI API key') || msg.includes('No Gemini API key') || msg.includes('AI Configuration') || msg.includes('add your Gemini');
  const isAuthError   = status === 401 || status === 403 || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('forbidden');
  const isRateLimit   = status === 429 || msg.includes('rate limit') || msg.includes('quota');
  const isUnavailable = status === 503 || status === 504 || status === 502 || (msg.includes('database') && msg.includes('unavailable'));

  let message = msg;
  if (isKeyMissing)   message = 'No Gemini API key configured. Go to Settings → AI Configuration to add your key.';
  else if (isAuthError)   message = 'Your session has expired. Please refresh the page and log in again.';
  else if (isRateLimit)   message = 'AI rate limit reached. Please wait a moment before sending another message.';
  else if (isUnavailable) message = 'The AI service is temporarily unavailable. Please try again in a moment.';
  else if (status >= 500 || msg.includes('Internal server error') || msg.includes('Internal Server Error'))
    message = 'Something went wrong on our end. Please try again in a moment.';
  else if (msg.includes('Failed to fetch') || msg.includes('fetch failed'))
    message = 'Could not connect to the backend. Please check the server is running.';

  return { message, isAbort: false, isKeyMissing, isAuthError, isRateLimit, isUnavailable };
}
