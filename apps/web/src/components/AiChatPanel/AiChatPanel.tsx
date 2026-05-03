'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useState, useRef, useEffect, useCallback, useMemo, Suspense } from 'react';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { parseBackendError } from '@/lib/parseBackendError';
import { useAuth } from '@/hooks/useAuth';
import { AVATARS } from '@/features/dashboard/components/AccountPage/avatars';
import styles from './AiChatPanel.module.scss';

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

// ── Backend helpers ────────────────────────────────────────────────────────────
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

async function createConversation(ctx: ApiErrorContext | null): Promise<string> {
  const res = await fetchWithAuth(`${API}/ai/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context: ctx ?? undefined, mode: 'user' }),
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
  const res = await fetchWithAuth(`${API}/ai/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

// ── Full Markdown renderer ─────────────────────────────────────────────────────
function renderMd(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  const inline = (str: string): React.ReactNode[] => {
    const result: React.ReactNode[] = [];
    const regex = /(\*\*[^*\n]+?\*\*|\*[^*\n]+?\*|`[^`\n]+`)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(str)) !== null) {
      if (m.index > last) result.push(<span key={key++}>{str.slice(last, m.index)}</span>);
      const t = m[0];
      if (t.startsWith('**'))
        result.push(<strong key={key++} style={{ fontWeight: 700 }}>{t.slice(2, -2)}</strong>);
      else if (t.startsWith('*'))
        result.push(<em key={key++}>{t.slice(1, -1)}</em>);
      else
        result.push(
          <code key={key++} style={{
            background: 'var(--accent-muted)',
            border: '1px solid var(--accent-border)',
            padding: '1px 5px',
            borderRadius: '4px',
            fontFamily: "'JetBrains Mono','Fira Code',monospace",
            fontSize: '0.77rem',
            color: 'var(--accent)',
            fontWeight: 500,
          }}>{t.slice(1, -1)}</code>
        );
      last = m.index + t.length;
    }
    if (last < str.length) result.push(<span key={key++}>{str.slice(last)}</span>);
    return result;
  };

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { code.push(lines[i]); i++; }
      elements.push(
        <div key={key++} style={{
          background: 'var(--code-bg)',
          border: '1px solid var(--accent-border)',
          borderRadius: '8px',
          overflow: 'hidden',
          margin: '8px 0',
        }}>
          {lang && <div style={{
            padding: '3px 10px',
            background: 'var(--accent-muted)',
            color: 'var(--accent)',
            fontSize: '0.65rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            borderBottom: '1px solid var(--accent-border)',
          }}>{lang}</div>}
          <pre style={{
            margin: 0,
            padding: '10px 14px',
            overflowX: 'auto',
            color: '#e2e8f0',
            fontSize: '0.76rem',
            fontFamily: "'JetBrains Mono','Fira Code',monospace",
            lineHeight: 1.6,
          }}>{code.join('\n')}</pre>
        </div>
      );
      i++;
      continue;
    }

    // HR
    if (line.trim() === '---' || line.trim() === '***') {
      elements.push(<hr key={key++} style={{ border: 'none', borderTop: '1px solid var(--drop-divider)', margin: '8px 0' }} />);
      i++; continue;
    }

    // Heading
    const h = line.match(/^(#{1,3})\s+(.*)/);
    if (h) {
      const level = h[1].length;
      const sz = level === 1 ? '0.95rem' : level === 2 ? '0.87rem' : '0.82rem';
      elements.push(
        <div key={key++} style={{ fontWeight: 700, fontSize: sz, color: 'var(--text-primary)', margin: '10px 0 4px' }}>
          {inline(h[2])}
        </div>
      );
      i++; continue;
    }

    // Numbered list
    const numM = line.match(/^(\d+)\.\s+(.*)/);
    if (numM) {
      const items: { n: string; c: string }[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\d+)\.\s+(.*)/);
        if (!m) break;
        items.push({ n: m[1], c: m[2] });
        i++;
      }
      elements.push(
        <ol key={key++} style={{ margin: '6px 0', paddingLeft: 0, listStyle: 'none' }}>
          {items.map((item, idx) => (
            <li key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '5px', alignItems: 'flex-start' }}>
              <span style={{
                minWidth: '20px', height: '20px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                color: 'white',
                fontSize: '0.62rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginTop: '1px',
              }}>{item.n}</span>
              <span style={{ lineHeight: 1.6 }}>{inline(item.c)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Bullet list
    const bulM = line.match(/^[-*•]\s+(.*)/);
    if (bulM) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*•]\s+(.*)/)) {
        items.push(lines[i].match(/^[-*•]\s+(.*)/)![1]);
        i++;
      }
      elements.push(
        <ul key={key++} style={{ margin: '6px 0', paddingLeft: 0, listStyle: 'none' }}>
          {items.map((item, idx) => (
            <li key={idx} style={{ display: 'flex', gap: '7px', marginBottom: '4px', alignItems: 'flex-start' }}>
              <span style={{ color: '#818cf8', fontSize: '0.85rem', lineHeight: 1.4, flexShrink: 0 }}>◆</span>
              <span style={{ lineHeight: 1.6 }}>{inline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      elements.push(<div key={key++} style={{ height: '5px' }} />);
      i++; continue;
    }

    // Normal text
    elements.push(
      <div key={key++} style={{ lineHeight: 1.65, marginBottom: '2px' }}>
        {inline(line)}
      </div>
    );
    i++;
  }
  return <>{elements}</>;
}

// ── Quick prompts ──────────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  { icon: '🔍', label: 'What does HTTP 503 mean?' },
  { icon: '🔧', label: 'How to fix CORS errors?' },
  { icon: '⚡', label: 'Why is my API so slow?' },
  { icon: '🔒', label: 'What causes 401 Unauthorized?' },
];

// ── Main component ─────────────────────────────────────────────────────────────
function AiChatPanelInner() {
  const pathname    = usePathname();
  const searchParams = useSearchParams();
  const isOpen      = searchParams.get('panel') === 'ai-chat';

  // ── User avatar (real-time: mirrors TopNavbar logic) ────────────────────────
  const { user } = useAuth();
  const [avatarIndex, setAvatarIndex] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return parseInt(localStorage.getItem('userAvatarIndex') ?? '0', 10);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const getIdx = () => parseInt(localStorage.getItem('userAvatarIndex') ?? '0', 10);
    setAvatarIndex(getIdx());
    const handler = () => setAvatarIndex(getIdx());
    window.addEventListener('avatarChanged', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('avatarChanged', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const currentAvatar = AVATARS[avatarIndex] ?? AVATARS[0];

  const ctxParam = searchParams.get('aiCtx');
  // Memoised so the object reference is stable across re-renders
  const errorContext = useMemo<ApiErrorContext | null>(() => {
    if (!ctxParam) return null;
    try { return JSON.parse(decodeURIComponent(ctxParam)) as ApiErrorContext; }
    catch { return null; }
  }, [ctxParam]);

  // Messages + conversationId persisted in sessionStorage so re-opening the panel restores history
  const SESSION_KEY = `ai-chat:${ctxParam ?? 'general'}`;

  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      return saved ? (JSON.parse(saved) as Message[]) : [];
    } catch { return []; }
  });
  const [input, setInput]               = useState('');
  const [loading, setLoading]           = useState(false);
  const [errorMsg, setErrorMsg]         = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(() => {
    try { return sessionStorage.getItem(`${SESSION_KEY}:convId`); } catch { return null; }
  });
  const [noKey, setNoKey]               = useState(false);
  const [placeholderText, setPlaceholderText] = useState('');

  const bottomRef   = useRef<HTMLDivElement>(null);
  const abortRef    = useRef<AbortController | null>(null);
  const inputRef    = useRef<HTMLTextAreaElement>(null);
  const initialSent = useRef(false);
  const convIdRef = useRef<string | null>(null);

  // Seed convIdRef from state (includes sessionStorage-restored value)
  useEffect(() => { convIdRef.current = conversationId; }, [conversationId]);

  // Persist messages to sessionStorage so they survive panel close/re-open
  useEffect(() => {
    if (messages.length === 0) return;
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages)); } catch { /* quota full */ }
  }, [messages, SESSION_KEY]);

  // Persist conversationId separately so we can reuse the same DB thread
  useEffect(() => {
    try {
      if (conversationId) sessionStorage.setItem(`${SESSION_KEY}:convId`, conversationId);
      else sessionStorage.removeItem(`${SESSION_KEY}:convId`);
    } catch { /* quota full */ }
  }, [conversationId, SESSION_KEY]);

  const close = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('panel'); params.delete('aiCtx');
    const qs = params.toString();
    window.history.replaceState(null, '', `${pathname}${qs ? '?' + qs : ''}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, [pathname, searchParams]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
      
      // Typewriter animation for placeholder
      const targetText = errorContext ? 'Ask about this error…' : 'Ask about an error, status code, or API issue…';
      setPlaceholderText('');
      let i = 0;
      const interval = setInterval(() => {
        setPlaceholderText(targetText.slice(0, i + 1));
        i++;
        if (i >= targetText.length) clearInterval(interval);
      }, 40); // 40ms per character
      return () => clearInterval(interval);
    }
    if (!isOpen) {
      initialSent.current = false;
      setPlaceholderText('');
    }
  }, [isOpen, errorContext]);

  const sendMessage = useCallback(async (text: string) => {
    setErrorMsg(null);
    setLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: text }, { role: 'assistant', content: '' }]);
    setInput('');
    abortRef.current = new AbortController();

    try {
      let convId = convIdRef.current;
      if (!convId) {
        convId = await createConversation(errorContext);
        setConversationId(convId);
        convIdRef.current = convId;
      }
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
      setNoKey(parsed.isKeyMissing);
      setErrorMsg(parsed.isKeyMissing || parsed.isAuthError ? null : parsed.message);
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: 'assistant',
          content: parsed.isKeyMissing
            ? '⚠️ **No AI key configured.**\n\nGo to **Admin Panel → Settings → Platform AI Key** and add a supported key:\n- Google Gemini: `AIzaSy...`\n- OpenAI: `sk-...`\n- NVIDIA NIM: `nvapi-...`\n- Claude: `sk-ant-...`'
            : parsed.isAuthError
            ? '🔒 **Session expired.** Please refresh the page and log in again.'
            : parsed.isRateLimit
            ? '⏱️ **Rate limit reached.** Your AI provider has temporarily throttled requests. Wait a moment and try again.'
            : parsed.isUnavailable
            ? '🔧 **AI service unavailable.** Please try again in a moment.'
            : `❌ **Something went wrong.**\n\n${parsed.message}`,
        };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }, [errorContext]);

  useEffect(() => {
    if (!isOpen || initialSent.current || !errorContext) return;
    initialSent.current = true;
    sendMessage(
      `I found an API error in my monitoring dashboard:\n\n` +
      `**Endpoint:** \`${errorContext.endpoint ?? 'N/A'}\`\n` +
      `**Method:** ${errorContext.method ?? 'N/A'}\n` +
      `**Status:** ${errorContext.statusCode ?? 'N/A'}\n` +
      `**Error:** ${errorContext.errorMessage ?? 'N/A'}\n` +
      `**Latency:** ${errorContext.latency != null ? errorContext.latency + 'ms' : 'N/A'}\n\n` +
      `Please diagnose this and tell me exactly how to fix it.`
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, errorContext]);

  function handleSend() { const t = input.trim(); if (t && !loading) { sendMessage(t); if (inputRef.current) { inputRef.current.style.height = 'auto'; } } }
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }
  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px'; // max 180px (~6 lines)
  }
  function clearChat() {
    abortRef.current?.abort();
    setMessages([]); setConversationId(null); convIdRef.current = null;
    initialSent.current = false; setLoading(false); setErrorMsg(null); setNoKey(false);
    if (inputRef.current) inputRef.current.style.height = 'auto';
    // Also clear session persistence so a fresh open starts blank
    try { sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(`${SESSION_KEY}:convId`); } catch { /* ignore */ }
  }

  if (!isOpen) return null;

  return (
    <>
      <div className={styles.backdrop} onClick={close} aria-hidden="true" />

      <aside className={styles.panel} aria-label="Apio AI Assistant" role="dialog" aria-modal="true">

        {/* ── Intro Logo Animation (plays once on open if empty) ── */}
        {messages.length === 0 && (
          <div className={styles.introLogoWrap}>
            <svg className={styles.introLogoSvg} viewBox="0 0 20 20" fill="none" stroke="var(--accent)" strokeWidth="1.2" width="64" height="64">
              <polygon points="10,1 19,6 19,14 10,19 1,14 1,6" />
              <path d="M10 5 Q10 10, 15 10 Q10 10, 10 15 Q10 10, 5 10 Q10 10, 10 5 Z" fill="var(--accent)" stroke="none" />
            </svg>
          </div>
        )}

        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <svg viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="1.5" width="26" height="26">
              <polygon points="10,1 19,6 19,14 10,19 1,14 1,6" />
              <path d="M10 5 Q10 10, 15 10 Q10 10, 10 15 Q10 10, 5 10 Q10 10, 10 5 Z" fill="rgba(255,255,255,0.9)" stroke="none" />
            </svg>
            <div className={styles.headerMeta}>
              <div className={styles.headerTitle}>Apio AI Assistant</div>
              <div className={styles.headerStatus}>
                <span className={`${styles.statusDot} ${loading ? styles.statusDotThinking : ''}`} />
                {loading ? 'Thinking…' : conversationId ? 'Session active · Saved' : 'Ready to help'}
              </div>
            </div>
          </div>
          <div className={styles.headerRight}>
            <button className={styles.iconBtn} onClick={clearChat} title="New conversation" aria-label="Clear chat">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M23 4v6h-6M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
            </button>
            <button className={styles.closeBtn} onClick={close} aria-label="Close AI panel">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ── No-key warning ── */}
        {noKey && (
          <div className={styles.noKeyBanner}>
            <span>⚠️ No AI key configured. Contact your admin.</span>
            <span className={styles.noKeyLink} onClick={() => {
              close();
              window.open('/dashboard', '_blank');
            }}>
              Open Admin →
            </span>
          </div>
        )}

        {/* ── Error context pill ── */}
        {errorContext && (
          <div className={styles.errorContext}>
            <span className={styles.errorBadge}>{errorContext.statusCode ?? '?'}</span>
            <span className={styles.errorMethod}>{errorContext.method}</span>
            <span className={styles.errorEndpoint}>{errorContext.endpoint}</span>
            {errorContext.latency != null && (
              <span className={styles.errorLatency}>{errorContext.latency}ms</span>
            )}
          </div>
        )}

        {/* ── Messages ── */}
        <div className={styles.body}>
          {messages.length === 0 && !loading && (
            <div className={styles.emptyState}>
              <div className={styles.emptyGlow} />
              <svg viewBox="0 0 20 20" fill="none" stroke="var(--accent)" strokeWidth="1.2" width="44" height="44" style={{ marginBottom: '14px' }}>
                <polygon points="10,1 19,6 19,14 10,19 1,14 1,6" />
                <path d="M10 5 Q10 10, 15 10 Q10 10, 10 15 Q10 10, 5 10 Q10 10, 10 5 Z" fill="var(--accent)" stroke="none" />
              </svg>
              <div className={styles.emptyTitle}>
                {errorContext ? '🔍 Analyzing your error…' : 'How can I help you today?'}
              </div>
              <div className={styles.emptyDesc}>
                {errorContext
                  ? `${errorContext.method} ${errorContext.endpoint} → ${errorContext.statusCode}`
                  : 'Ask me about API errors, status codes, latency, or backend problems.'}
              </div>
              {!errorContext && (
                <div className={styles.quickPrompts}>
                  {QUICK_PROMPTS.map((q) => (
                    <button key={q.label} className={styles.quickPrompt} onClick={() => sendMessage(q.label)}>
                      {q.icon} {q.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((msg, i) => {
            const isStreaming = loading && i === messages.length - 1 && msg.role === 'assistant';
            return (
              <div key={i} className={`${styles.messageRow} ${msg.role === 'user' ? styles.messageRowUser : ''}`}>
                {msg.role === 'assistant' && (
                  <svg viewBox="0 0 20 20" fill="none" stroke="var(--accent)" strokeWidth="1.5" width="24" height="24" style={{ flexShrink: 0, marginTop: '2px' }}>
                    <polygon points="10,1 19,6 19,14 10,19 1,14 1,6" />
                    <path d="M10 5 Q10 10, 15 10 Q10 10, 10 15 Q10 10, 5 10 Q10 10, 10 5 Z" fill="var(--accent)" stroke="none" />
                  </svg>
                )}
                <div className={`${styles.bubble} ${msg.role === 'user' ? styles.bubbleUser : ''}`}>
                  {msg.role === 'assistant' ? (
                    <>
                      {msg.content
                        ? isStreaming
                          /* While streaming: plain text so partial chunks render with correct spacing */
                          ? <span style={{ whiteSpace: 'pre-wrap', wordSpacing: 'normal', letterSpacing: 'normal' }}>{msg.content}</span>
                          /* Finished: full markdown rendering */
                          : renderMd(msg.content)
                        : isStreaming
                          ? (
                            <div className={styles.skeletonLoader}>
                              <svg className={styles.skeletonHex} viewBox="0 0 20 20" fill="none" stroke="var(--accent)" strokeWidth="1.5">
                                <polygon points="10,1 19,6 19,14 10,19 1,14 1,6" />
                                <path d="M10 5 Q10 10, 15 10 Q10 10, 10 15 Q10 10, 5 10 Q10 10, 10 5 Z" fill="var(--accent)" stroke="none" />
                              </svg>
                              <div className={styles.skeletonLines}>
                                <div className={styles.skeletonLine} style={{ width: '90%' }} />
                                <div className={styles.skeletonLine} style={{ width: '75%' }} />
                                <div className={styles.skeletonLine} style={{ width: '50%' }} />
                              </div>
                            </div>
                          )
                          : null}
                      {isStreaming && msg.content && <span className={styles.cursor} />}
                    </>
                  ) : (
                    msg.content
                  )}
                </div>
                {/* User avatar — right side, real-time, round */}
                {msg.role === 'user' && (
                  <div className={styles.msgAvatarUser} title={user?.name ?? user?.email ?? 'You'}>
                    <div className={styles.msgAvatarSvg}>{currentAvatar.svg}</div>
                  </div>
                )}
              </div>
            );
          })}

          <div ref={bottomRef} />
        </div>

        {/* ── Error footer ── */}
        {errorMsg && (
          <div className={styles.errorBar}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {errorMsg.slice(0, 120)}
          </div>
        )}

        {/* ── Input ── */}
        <div className={styles.inputArea}>
          <div className={styles.inputWrapper}>
            <textarea
              ref={inputRef}
              className={styles.textarea}
              value={input}
              onChange={e => { setInput(e.target.value); autoResize(e.target); }}
              onKeyDown={handleKeyDown}
              placeholder={placeholderText}
              disabled={loading}
              id="ai-chat-panel-input"
              aria-label="Type your message to Apio AI"
            />
            
            {/* Animated send/stop button inside the textarea */}
            <div className={`${styles.actionArea} ${input.trim() || loading ? styles.actionAreaVisible : ''}`}>
              {loading ? (
                <button className={styles.stopBtnIcon} onClick={() => { abortRef.current?.abort(); setLoading(false); }} title="Stop generating">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="4" y="4" width="16" height="16" rx="2"/>
                  </svg>
                </button>
              ) : (
                <button className={styles.sendBtnIcon} onClick={handleSend} disabled={!input.trim()} title="Send message" id="ai-chat-send-btn">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div className={styles.inputFooter}>
            <span className={styles.hint}>
              {conversationId ? '💾 Saved · ' : ''}Shift+Enter for newline
            </span>
            <div className={styles.poweredBy}>Powered by Apio AI</div>
          </div>
        </div>
      </aside>
    </>
  );
}

export default function AiChatPanel() {
  return (
    <Suspense fallback={null}>
      <AiChatPanelInner />
    </Suspense>
  );
}

export function openAiPanel(ctx?: ApiErrorContext) {
  const params = new URLSearchParams(window.location.search);
  params.set('panel', 'ai-chat');
  if (ctx) params.set('aiCtx', encodeURIComponent(JSON.stringify(ctx)));
  else params.delete('aiCtx');
  window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
