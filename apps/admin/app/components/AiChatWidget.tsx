'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { parseBackendError } from '../../lib/parseBackendError';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface ApiErrorContext {
  endpoint?: string;
  method?: string;
  statusCode?: number;
  errorMessage?: string;
  latency?: number;
  timestamp?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AiChatWidgetProps {
  open: boolean;
  onClose: () => void;
  errorContext?: ApiErrorContext | null;
}

// ── API helpers ────────────────────────────────────────────────────────────────
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

function authHeader(): Record<string, string> {
  const token =
    typeof window !== 'undefined'
      ? (localStorage.getItem('access_token') ?? localStorage.getItem('admin_token') ?? '')
      : '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function ensureConversation(
  conversationId: string | null,
  ctx: ApiErrorContext | null | undefined,
): Promise<string> {
  if (conversationId) return conversationId;
  const res = await fetch(`${API}/ai/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ context: ctx ?? null, mode: 'admin' }),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
  const data = await res.json() as { id: string };
  return data.id;
}

async function streamFromBackend(
  conversationId: string,
  content: string,
  onChunk: (chunk: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API}/ai/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ conversationId, content }),
    signal,
  });
  if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));

  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).replace(/\r$/, ''); // keep leading spaces — they are part of AI tokens
      if (data === '[DONE]') return;
      if (data.startsWith('[ERROR]')) throw new Error(data.slice(7).trim());
      onChunk(data.replace(/\\n/g, '\n'));
    }
  }
}

// ── Full-featured Markdown renderer ───────────────────────────────────────────
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  const inlineRender = (str: string): React.ReactNode[] => {
    // Process: bold, italic, code, then plain text
    const result: React.ReactNode[] = [];
    const regex = /(\*\*[^*\n]+?\*\*|\*[^*\n]+?\*|`[^`\n]+`)/g;
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(str)) !== null) {
      if (match.index > last) result.push(<span key={key++}>{str.slice(last, match.index)}</span>);
      const token = match[0];
      if (token.startsWith('**'))
        result.push(<strong key={key++} style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{token.slice(2, -2)}</strong>);
      else if (token.startsWith('*'))
        result.push(<em key={key++}>{token.slice(1, -1)}</em>);
      else
        result.push(
          <code key={key++} style={{
            background: 'rgba(99,102,241,0.15)',
            border: '1px solid rgba(99,102,241,0.25)',
            padding: '1px 6px',
            borderRadius: '4px',
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: '11.5px',
            color: '#a5b4fc',
            fontWeight: 500,
          }}>{token.slice(1, -1)}</code>
        );
      last = match.index + token.length;
    }
    if (last < str.length) result.push(<span key={key++}>{str.slice(last)}</span>);
    return result;
  };

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <div key={key++} style={{
          background: 'rgba(15,15,30,0.8)',
          border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: '8px',
          overflow: 'hidden',
          margin: '8px 0',
          fontSize: '12px',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        }}>
          {lang && (
            <div style={{
              padding: '4px 12px',
              background: 'rgba(99,102,241,0.12)',
              color: '#a5b4fc',
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              borderBottom: '1px solid rgba(99,102,241,0.15)',
            }}>{lang}</div>
          )}
          <pre style={{ margin: 0, padding: '10px 14px', overflowX: 'auto', color: '#e2e8f0', lineHeight: 1.6 }}>
            {codeLines.join('\n')}
          </pre>
        </div>
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (line.trim() === '---' || line.trim() === '***') {
      elements.push(<hr key={key++} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '10px 0' }} />);
      i++;
      continue;
    }

    // Headings
    const h3 = line.match(/^###\s+(.*)/);
    const h2 = line.match(/^##\s+(.*)/);
    const h1 = line.match(/^#\s+(.*)/);
    if (h1 || h2 || h3) {
      const content = (h1?.[1] ?? h2?.[1] ?? h3?.[1])!;
      const sz = h1 ? '15px' : h2 ? '14px' : '13px';
      elements.push(
        <div key={key++} style={{ fontWeight: 700, fontSize: sz, color: 'var(--text-primary)', margin: '10px 0 4px' }}>
          {inlineRender(content)}
        </div>
      );
      i++;
      continue;
    }

    // Numbered list
    const numMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      const listItems: { num: string; content: string }[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\d+)\.\s+(.*)/);
        if (!m) break;
        listItems.push({ num: m[1], content: m[2] });
        i++;
      }
      elements.push(
        <ol key={key++} style={{ margin: '6px 0', paddingLeft: '0', listStyle: 'none' }}>
          {listItems.map((item, idx) => (
            <li key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '5px', alignItems: 'flex-start' }}>
              <span style={{
                minWidth: '20px',
                height: '20px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                color: 'white',
                fontSize: '10px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '1px',
              }}>{item.num}</span>
              <span style={{ lineHeight: 1.55 }}>{inlineRender(item.content)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Bullet list
    const bulletMatch = line.match(/^[-*•]\s+(.*)/);
    if (bulletMatch) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*•]\s+(.*)/)) {
        items.push(lines[i].match(/^[-*•]\s+(.*)/)![1]);
        i++;
      }
      elements.push(
        <ul key={key++} style={{ margin: '6px 0', paddingLeft: '0', listStyle: 'none' }}>
          {items.map((item, idx) => (
            <li key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '4px', alignItems: 'flex-start' }}>
              <span style={{ color: '#818cf8', fontSize: '14px', lineHeight: 1.4, flexShrink: 0 }}>◆</span>
              <span style={{ lineHeight: 1.55 }}>{inlineRender(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Empty line → spacer
    if (line.trim() === '') {
      elements.push(<div key={key++} style={{ height: '6px' }} />);
      i++;
      continue;
    }

    // Normal paragraph
    elements.push(
      <div key={key++} style={{ lineHeight: 1.65, marginBottom: '2px' }}>
        {inlineRender(line)}
      </div>
    );
    i++;
  }

  return <>{elements}</>;
}

// ── Quick-action chips (empty state) ──────────────────────────────────────────
const QUICK_ACTIONS = [
  { icon: '🔍', label: 'What is a 401 error?' },
  { icon: '⚡', label: 'Why is my API slow?' },
  { icon: '🔧', label: 'How to fix CORS errors?' },
  { icon: '📊', label: 'What does 429 mean?' },
];

// ── Component ──────────────────────────────────────────────────────────────────
export default function AiChatWidget({ open, onClose, errorContext }: AiChatWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef  = useRef<AbortController | null>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const initialSent = useRef(false);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
    if (!open) initialSent.current = false;
  }, [open]);

  const sendMessage = useCallback(async (text: string) => {
    setError(null);
    setLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: text }, { role: 'assistant', content: '' }]);
    setInput('');
    abortRef.current = new AbortController();

    try {
      const convId = await ensureConversation(conversationId, errorContext);
      if (!conversationId) setConversationId(convId);
      await streamFromBackend(convId, text, (chunk) => {
        setMessages(prev => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.role === 'assistant') copy[copy.length - 1] = { ...last, content: last.content + chunk };
          return copy;
        });
      }, abortRef.current.signal);
    } catch (e: unknown) {
      const parsed = parseBackendError(e);
      if (parsed.isAbort) { setLoading(false); return; }
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: 'assistant',
          content: parsed.isKeyMissing
            ? '⚠️ **No AI key configured.**\n\nGo to **Settings → Platform AI Key** and paste any supported key:\n- Google Gemini: `AIzaSy...`\n- OpenAI: `sk-...`\n- NVIDIA NIM: `nvapi-...`\n- Claude: `sk-ant-...`\n- OpenRouter: `sk-or-...`'
            : parsed.isAuthError
            ? '🔒 **Session expired.** Please refresh the page and log in again.'
            : parsed.isRateLimit
            ? '⏱️ **Rate limit reached.** Your AI provider has temporarily throttled requests. Wait a moment and try again.'
            : parsed.isUnavailable
            ? '🔧 **AI service unavailable.** The AI service is temporarily down. Please try again shortly.'
            : `❌ **Something went wrong.**\n\n${parsed.message}`,
        };
        return copy;
      });
      setError(parsed.isKeyMissing || parsed.isAuthError ? null : parsed.message);
    } finally {
      setLoading(false);
    }
  }, [conversationId, errorContext]);

  useEffect(() => {
    if (!open || initialSent.current || !errorContext) return;
    initialSent.current = true;
    sendMessage(
      `I'm seeing an API error in my monitoring dashboard:\n\n` +
      `**Endpoint:** \`${errorContext.endpoint ?? 'N/A'}\`\n` +
      `**Method:** ${errorContext.method ?? 'N/A'}\n` +
      `**Status:** ${errorContext.statusCode ?? 'N/A'}\n` +
      `**Error:** ${errorContext.errorMessage ?? 'N/A'}\n` +
      `**Latency:** ${errorContext.latency != null ? errorContext.latency + 'ms' : 'N/A'}\n\n` +
      `Please diagnose this and tell me exactly how to fix it.`
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, errorContext]);

  function handleSend() { const t = input.trim(); if (t && !loading) sendMessage(t); }
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }
  function handleAbort() { abortRef.current?.abort(); setLoading(false); }
  function clearChat() {
    abortRef.current?.abort();
    setMessages([]); setConversationId(null);
    initialSent.current = false; setLoading(false); setError(null);
  }

  if (!open) return null;

  return (
    <div className="ai-chat-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="AI Assistant">
      <div className="ai-chat-widget" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="ai-chat-header">
          <div className="ai-chat-header-left">
            <div className="ai-chat-avatar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div className="ai-chat-title">Apio AI Assistant</div>
              <div className="ai-chat-status">
                <span className={`ai-status-dot ${loading ? 'ai-status-thinking' : ''}`} />
                {loading ? 'Thinking…' : conversationId ? 'Session active · Saved' : 'Ready to help'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button className="ai-icon-btn" onClick={clearChat} title="New conversation" aria-label="New conversation">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
            </button>
            <button className="ai-icon-btn" onClick={onClose} title="Close" aria-label="Close">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ── Error context pill ── */}
        {errorContext && (
          <div className="ai-error-context">
            <span className="ai-error-badge">{errorContext.statusCode ?? '?'}</span>
            <span className="ai-error-method">{errorContext.method}</span>
            <span className="ai-error-endpoint">{errorContext.endpoint}</span>
            {errorContext.latency != null && (
              <span className="ai-error-latency">{errorContext.latency}ms</span>
            )}
          </div>
        )}

        {/* ── Messages ── */}
        <div className="ai-messages">
          {messages.length === 0 && (
            <div className="ai-empty">
              <div className="ai-empty-glow" />
              <div className="ai-empty-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                    stroke="url(#g1)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <defs>
                    <linearGradient id="g1" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#818cf8"/><stop offset="1" stopColor="#a78bfa"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <div className="ai-empty-title">
                {errorContext ? '🔍 Analyzing your API error…' : 'How can I help you today?'}
              </div>
              <div className="ai-empty-desc">
                {errorContext
                  ? `Looking at ${errorContext.method} ${errorContext.endpoint} → ${errorContext.statusCode}`
                  : 'Ask me anything about your APIs, errors, or performance.'}
              </div>
              {!errorContext && (
                <div className="ai-quick-actions">
                  {QUICK_ACTIONS.map((a) => (
                    <button key={a.label} className="ai-quick-chip" onClick={() => sendMessage(a.label)}>
                      {a.icon} {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((msg, i) => {
            const isStreaming = loading && i === messages.length - 1 && msg.role === 'assistant';
            return (
              <div key={i} className={`ai-message ai-message-${msg.role}`}>
                {msg.role === 'assistant' && (
                  <div className="ai-msg-avatar" aria-label="AI">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                        stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
                <div className="ai-msg-bubble">
                  {msg.role === 'assistant' ? (
                    <div className="ai-msg-text">
                      {msg.content
                        ? isStreaming
                          /* Streaming: plain pre-wrap so partial chunks never collapse spaces */
                          ? <span style={{ whiteSpace: 'pre-wrap', wordSpacing: 'normal', letterSpacing: 'normal' }}>{msg.content}</span>
                          /* Done: full markdown */
                          : renderMarkdown(msg.content)
                        : isStreaming
                          ? <span className="ai-thinking"><span /><span /><span /></span>
                          : null
                      }
                      {isStreaming && msg.content && <span className="ai-typing-cursor" />}
                    </div>
                  ) : (
                    <div className="ai-msg-text">{msg.content}</div>
                  )}
                </div>
              </div>
            );
          })}

          <div ref={bottomRef} />
        </div>

        {/* ── Error banner ── */}
        {error && !error.includes('abort') && (
          <div className="ai-error-bar">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error.slice(0, 120)}
          </div>
        )}

        {/* ── Input ── */}
        <div className="ai-input-area">
          <div className="ai-input-wrapper">
            <textarea
              ref={inputRef}
              className="ai-textarea"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={errorContext
                ? "Ask about this error, or describe what you're seeing…"
                : "Ask about an error, status code, or API issue… (Enter to send)"}
              rows={2}
              disabled={loading}
              aria-label="Message input"
            />
          </div>
          <div className="ai-input-footer">
            <span className="ai-hint">
              {conversationId ? '💾 History saved · ' : ''}Shift+Enter for newline
            </span>
            {loading ? (
              <button className="ai-stop-btn" onClick={handleAbort}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2"/>
                </svg>
                Stop
              </button>
            ) : (
              <button
                className="ai-send-btn"
                onClick={handleSend}
                disabled={!input.trim()}
                id="ai-widget-send-btn"
              >
                Send
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="ai-footer">
          <span>Powered by Apio AI · History saved to your account</span>
          <div className="ai-footer-dot" />
          <span className="ai-footer-user">
            {typeof window !== 'undefined' ? (localStorage.getItem('admin_email') ?? 'N') : 'N'}
          </span>
        </div>
      </div>
    </div>
  );
}
