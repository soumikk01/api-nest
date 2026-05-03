'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

function authToken(): string {
  return typeof window !== 'undefined'
    ? localStorage.getItem('access_token') ?? localStorage.getItem('admin_token') ?? ''
    : '';
}

// Sentinel class to signal a 401 — handled by callers, not by hard-redirect
class SessionExpiredError extends Error {
  constructor() { super('Session expired'); }
}

function apiFetch(path: string, init?: RequestInit) {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken()}`,
      ...(init?.headers ?? {}),
    },
  }).then((res) => {
    if (res.status === 401) throw new SessionExpiredError();
    return res;
  });
}

interface UserProfile { id: string; email: string; name?: string; }
interface KeyStatus { configured: boolean; serverManaged: boolean; preview: string; }
interface PlatformKeyStatus { configured: boolean; preview: string; updatedAt: string | null; envOverride: boolean; }

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [backendUrl, setBackendUrl] = useState(API);
  const [wsUrl, setWsUrl] = useState(process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000');
  const [saved, setSaved] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  // ── Per-user AI key state ──────────────────────────────────────────────
  const [geminiKey, setGeminiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);
  const [aiRemoving, setAiRemoving] = useState(false);
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [testMsg, setTestMsg] = useState('');

  // ── Platform-wide AI key state ─────────────────────────────────────────
  const [platformKey, setPlatformKey] = useState('');
  const [showPlatformKey, setShowPlatformKey] = useState(false);
  const [platformKeyStatus, setPlatformKeyStatus] = useState<PlatformKeyStatus | null>(null);
  const [platformSaving, setPlatformSaving] = useState(false);
  const [platformSaved, setPlatformSaved] = useState(false);
  const [platformRemoving, setPlatformRemoving] = useState(false);
  const [platformTestState, setPlatformTestState] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [platformTestMsg, setPlatformTestMsg] = useState('');

  // ── Load profile + key statuses ───────────────────────────────────────
  const loadKeyStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/ai/key');
      if (res.ok) setKeyStatus(await res.json() as KeyStatus);
    } catch (e) {
      if (e instanceof SessionExpiredError) setSessionExpired(true);
    }
  }, []);

  const loadPlatformKeyStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/ai/platform-key');
      if (res.ok) setPlatformKeyStatus(await res.json() as PlatformKeyStatus);
    } catch (e) {
      if (e instanceof SessionExpiredError) setSessionExpired(true);
    }
  }, []);

  useEffect(() => {
    apiFetch('/users/me')
      .then(r => r.json()).then(d => setUser(d as UserProfile))
      .catch((e) => { if (e instanceof SessionExpiredError) setSessionExpired(true); });
    loadKeyStatus();
    loadPlatformKeyStatus();
  }, [loadKeyStatus, loadPlatformKeyStatus]);

  // ── Connection settings (local display only) ──────────────────────────
  function save(e: React.FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  // ── Test key via backend ──────────────────────────────────────────────
  async function testKey() {
    const key = geminiKey.trim();
    if (!key) { setTestMsg('Enter a key to test.'); setTestState('error'); return; }
    setTestState('testing'); setTestMsg('');
    try {
      const res = await apiFetch('/ai/key/test', {
        method: 'POST',
        body: JSON.stringify({ apiKey: key }),
      });
      const data = await res.json() as { valid: boolean; message: string };
      setTestState(data.valid ? 'ok' : 'error');
      setTestMsg(data.message);
    } catch (e) {
      setTestState('error');
      setTestMsg(e instanceof Error ? e.message : 'Connection failed');
    }
  }

  // ── Save key to backend (stored in DB, cached in Redis) ───────────────
  async function saveAiKey(e: React.FormEvent) {
    e.preventDefault();
    const key = geminiKey.trim();
    setAiSaving(true);
    try {
      if (!key) {
        // Remove key
        const res = await apiFetch('/ai/key', { method: 'DELETE' });
        if (!res.ok) throw new Error(await res.text());
      } else {
        const res = await apiFetch('/ai/key', {
          method: 'POST',
          body: JSON.stringify({ geminiApiKey: key }),
        });
        if (!res.ok) throw new Error(await res.text());
      }
      await loadKeyStatus();
      if (key) { setGeminiKey(''); } // clear field after save
      setAiSaved(true);
      setTestState('idle'); setTestMsg('');
      setTimeout(() => setAiSaved(false), 2500);
    } catch (err) {
      setTestMsg(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
      setTestState('error');
    } finally {
      setAiSaving(false);
    }
  }

  // ── Remove key from backend ───────────────────────────────────────────
  async function removeKey() {
    if (!confirm('Remove your Gemini API key? AI features will be disabled.')) return;
    setAiRemoving(true);
    try {
      await apiFetch('/ai/key', { method: 'DELETE' });
      await loadKeyStatus();
      setGeminiKey('');
      setTestState('idle'); setTestMsg('');
    } catch { /* ignore */ } finally {
      setAiRemoving(false);
    }
  }

  // ── Platform key handlers ──────────────────────────────────────────────
  async function testPlatformKey() {
    const key = platformKey.trim();
    if (!key) { setPlatformTestMsg('Enter a key first.'); setPlatformTestState('error'); return; }
    setPlatformTestState('testing'); setPlatformTestMsg('');
    try {
      const res = await apiFetch('/ai/key/test', { method: 'POST', body: JSON.stringify({ apiKey: key }) });
      const data = await res.json() as { valid: boolean; message: string };
      setPlatformTestState(data.valid ? 'ok' : 'error');
      setPlatformTestMsg(data.message);
    } catch (e) {
      setPlatformTestState('error');
      setPlatformTestMsg(e instanceof Error ? e.message : 'Connection failed');
    }
  }

  async function savePlatformKey(e: React.FormEvent) {
    e.preventDefault();
    const key = platformKey.trim();
    if (!key) return;
    setPlatformSaving(true);
    try {
      const res = await apiFetch('/ai/platform-key', { method: 'POST', body: JSON.stringify({ geminiApiKey: key }) });
      if (!res.ok) throw new Error(await res.text());
      await loadPlatformKeyStatus();
      setPlatformKey('');
      setPlatformSaved(true);
      setPlatformTestState('idle'); setPlatformTestMsg('');
      setTimeout(() => setPlatformSaved(false), 2500);
    } catch (err) {
      setPlatformTestMsg(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
      setPlatformTestState('error');
    } finally {
      setPlatformSaving(false);
    }
  }

  async function removePlatformKey() {
    if (!confirm('Remove the platform-wide Gemini key? AI will stop working for all users unless they have their own key.')) return;
    setPlatformRemoving(true);
    try {
      await apiFetch('/ai/platform-key', { method: 'DELETE' });
      await loadPlatformKeyStatus();
      setPlatformKey('');
      setPlatformTestState('idle'); setPlatformTestMsg('');
    } catch { /* ignore */ } finally {
      setPlatformRemoving(false);
    }
  }

  function logout() {
    localStorage.clear();
    router.push('/');
  }

  const infoRows = [
    { label: 'Backend URL',      value: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1' },
    { label: 'WebSocket URL',    value: process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000' },
    { label: 'Admin Panel Port', value: '3001' },
    { label: 'Main App Port',    value: '3000' },
    { label: 'Backend Port',     value: '4000' },
    { label: 'Prisma',           value: 'MongoDB v6' },
    { label: 'CLI Package',      value: 'apio-cli@1.0.0' },
  ];

  // ── Session expired banner — shown instead of silent logout ──────────
  if (sessionExpired) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 40 }}>🔒</div>
        <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>Session expired</div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: 340 }}>
          Your admin session has expired. Please log in again to continue.
          Your settings are safe — nothing was changed.
        </div>
        <button
          className="btn btn-primary"
          style={{ marginTop: 8 }}
          onClick={() => {
            localStorage.clear();
            router.push('/');
          }}
        >
          🔑 Log in again
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-subtitle">Admin panel configuration and system info</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* ── Account ────────────────────────────────────────────────── */}
        <div className="card">
          <div className="card-header"><span className="card-title">👤 Account</span></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <div className="form-label">Email</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{user?.email ?? '—'}</div>
            </div>
            <div>
              <div className="form-label">Name</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{user?.name ?? 'Not set'}</div>
            </div>
            <div>
              <div className="form-label">User ID</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{user?.id ?? '—'}</div>
            </div>
            <hr style={{ borderColor: 'var(--border)', borderTop: 'none' }} />
            <button className="btn btn-danger" onClick={logout}>⎋ Sign out</button>
          </div>
        </div>

        {/* ── Connection ──────────────────────────────────────────────── */}
        <div className="card">
          <div className="card-header"><span className="card-title">🔌 Connection</span></div>
          <div className="card-body">
            <form onSubmit={save}>
              <div className="form-group">
                <label className="form-label">Backend API URL</label>
                <input className="form-input" value={backendUrl} onChange={e => setBackendUrl(e.target.value)} placeholder="http://localhost:4000/api/v1" />
              </div>
              <div className="form-group">
                <label className="form-label">WebSocket URL</label>
                <input className="form-input" value={wsUrl} onChange={e => setWsUrl(e.target.value)} placeholder="http://localhost:4000" />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                {saved ? '✓ Saved' : 'Save settings'}
              </button>
            </form>
          </div>
        </div>

        {/* ── 🔑 Platform-wide Gemini Key ──────────────────────────────── */}
        <div className="card" style={{ gridColumn: '1 / -1', border: '1.5px solid rgba(99,102,241,0.35)' }} id="platform-ai-key">
          <div className="card-header" style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.08),rgba(139,92,246,0.08))' }}>
            <span className="card-title">🔑 Platform AI Key <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>applies to ALL users</span></span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge badge-accent">Gemini 2.0 Flash</span>
              {platformKeyStatus?.envOverride && <span className="badge badge-warning" title="Set via GEMINI_API_KEY env var — edit .env to change">🔒 ENV Override</span>}
              {!platformKeyStatus?.envOverride && platformKeyStatus?.configured && <span className="badge badge-success">✓ Active</span>}
              {!platformKeyStatus?.configured && !platformKeyStatus?.envOverride && <span className="badge" style={{ background: 'var(--danger-light)', color: '#991b1b' }}>Not configured</span>}
            </div>
          </div>
          <div className="card-body">

            {/* How it works banner */}
            <div style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.07),rgba(139,92,246,0.07))', border: '1px solid rgba(99,102,241,0.18)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: 6 }}>🌐 How Platform Keys Work</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Set one key here and <strong>every user</strong> on the platform uses it automatically — no per-user setup needed.
                You can change or remove it any time and the change takes effect instantly for all AI chats.
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 8 }}>
                Priority: <code style={{ background: 'rgba(0,0,0,0.08)', padding: '1px 5px', borderRadius: 3 }}>GEMINI_API_KEY env</code>
                {' '}&gt;{' '}<code style={{ background: 'rgba(99,102,241,0.12)', padding: '1px 5px', borderRadius: 3 }}>Platform Key (this panel)</code>
                {' '}&gt;{' '}<code style={{ background: 'rgba(0,0,0,0.08)', padding: '1px 5px', borderRadius: 3 }}>Per-user key</code>
              </div>
            </div>

            {/* Current status */}
            {platformKeyStatus?.configured && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-hover)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 2 }}>Current key</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', letterSpacing: 1 }}>
                    {platformKeyStatus.envOverride ? platformKeyStatus.preview : platformKey || platformKeyStatus.preview}
                  </div>
                  {platformKeyStatus.updatedAt && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 3 }}>
                      Updated {new Date(platformKeyStatus.updatedAt).toLocaleString()}
                    </div>
                  )}
                </div>
                {!platformKeyStatus.envOverride && (
                  <button className="btn btn-danger" style={{ fontSize: '12px', padding: '6px 12px' }}
                    onClick={removePlatformKey} disabled={platformRemoving}>
                    {platformRemoving ? 'Removing…' : '🗑 Remove'}
                  </button>
                )}
              </div>
            )}

            {platformKeyStatus?.envOverride ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '10px 14px', background: 'rgba(234,179,8,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(234,179,8,0.25)' }}>
                ⚠️ Key is set via <code>GEMINI_API_KEY</code> environment variable. To change it using this panel, remove it from <code>apps/backend/.env</code> first, then set it here.
              </div>
            ) : (
              <form onSubmit={savePlatformKey} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    {platformKeyStatus?.configured ? 'Replace platform key' : 'Enter AI API key'}
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="form-input"
                      type={showPlatformKey ? 'text' : 'password'}
                      placeholder="AIzaSy... or nvapi-... or sk-... or sk-ant-... or sk-or-..."
                      value={platformKey}
                      onChange={e => { setPlatformKey(e.target.value); setPlatformTestState('idle'); setPlatformTestMsg(''); }}
                      style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '13px' }}
                    />
                    <button type="button" className="btn" style={{ whiteSpace: 'nowrap' }}
                      onClick={() => setShowPlatformKey(p => !p)}>
                      {showPlatformKey ? '🙈 Hide' : '👁 Show'}
                    </button>
                  </div>

                  {/* Live provider detection */}
                  {platformKey.trim() && (() => {
                    const k = platformKey.trim();
                    const detected =
                      k.startsWith('AIza')     ? { name: 'Google Gemini', color: '#4285F4' } :
                      k.startsWith('nvapi-')   ? { name: 'NVIDIA NIM', color: '#76b900' } :
                      k.startsWith('sk-ant-')  ? { name: 'Anthropic Claude', color: '#d97706' } :
                      k.startsWith('sk-or-')   ? { name: 'OpenRouter', color: '#7c3aed' } :
                      k.startsWith('sk-')      ? { name: 'OpenAI', color: '#10a37f' } :
                      { name: 'Unknown — check format', color: '#dc2626' };
                    return (
                      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: detected.color, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontSize: '12px', color: detected.color, fontWeight: 500 }}>Detected: {detected.name}</span>
                      </div>
                    );
                  })()}

                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 6 }}>
                    <strong>Supported providers:</strong>{' '}
                    <span style={{ color: '#4285F4' }}>Gemini</span> (AIzaSy…) ·{' '}
                    <span style={{ color: '#76b900' }}>NVIDIA</span> (nvapi-…) ·{' '}
                    <span style={{ color: '#10a37f' }}>OpenAI</span> (sk-…) ·{' '}
                    <span style={{ color: '#d97706' }}>Claude</span> (sk-ant-…) ·{' '}
                    <span style={{ color: '#7c3aed' }}>OpenRouter</span> (sk-or-…)
                  </div>
                </div>

                {platformTestMsg && (
                  <div style={{ fontSize: '12px', padding: '8px 12px', borderRadius: 'var(--radius-md)', background: platformTestState === 'ok' ? 'rgba(16,185,129,0.1)' : 'var(--danger-light)', color: platformTestState === 'ok' ? '#065f46' : '#991b1b', border: `1px solid ${platformTestState === 'ok' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                    {platformTestMsg}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className="btn" onClick={testPlatformKey}
                    disabled={platformTestState === 'testing' || !platformKey.trim()} style={{ flex: 1, justifyContent: 'center' }}>
                    {platformTestState === 'testing' ? '⏳ Testing…' : platformTestState === 'ok' ? '✓ Valid' : '🔍 Test Key'}
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }}
                    disabled={platformSaving || !platformKey.trim() || platformTestState === 'error'}>
                    {platformSaving ? 'Saving…' : platformSaved ? '✓ Saved!' : platformKeyStatus?.configured ? '🔄 Update Platform Key' : '💾 Save Platform Key'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* ── AI Configuration (per-user key) ─────────────────────────────── */}
        <div className="card" style={{ gridColumn: '1 / -1' }} id="ai-config">
          <div className="card-header">
            <span className="card-title">🤖 My AI Key <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>personal key for this account only</span></span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge badge-accent">Gemini 2.0 Flash</span>
              {keyStatus?.configured && (
                <span className="badge badge-success">
                  {keyStatus.serverManaged ? '🔐 Server key' : '✓ Key saved'}
                </span>
              )}
            </div>
          </div>
          <div className="card-body">

            {/* Info banner */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(139,92,246,0.06) 100%)',
              border: '1px solid rgba(99,102,241,0.15)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
              marginBottom: '20px',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              lineHeight: '1.6',
            }}>
              <strong style={{ color: 'var(--text-primary)' }}>Secure server-side AI:</strong>{' '}
              Your Gemini API key is stored encrypted in the database and cached in Redis — never exposed to the browser.
              The AI assistant uses it on the backend to stream responses directly to you.
              {keyStatus?.serverManaged && (
                <><br /><br />
                  <strong style={{ color: 'var(--success)' }}>🔐 A server-wide key is already configured by the administrator.</strong>
                  {' '}You can still add a personal key to override it.
                </>
              )}
              {!keyStatus?.serverManaged && (
                <><br /><br />
                  Get a free key at{' '}
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer"
                    style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                    aistudio.google.com
                  </a>.
                </>
              )}
            </div>

            {/* Current status row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Current status:</span>
              {keyStatus?.configured ? (
                <>
                  <span className="badge badge-success">✓ AI Ready</span>
                  {!keyStatus.serverManaged && keyStatus.preview && (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {keyStatus.preview}
                    </span>
                  )}
                </>
              ) : (
                <span className="badge badge-neutral">⚠ No key — AI disabled</span>
              )}
            </div>

            <form onSubmit={saveAiKey}>
              <div className="form-group">
                <label className="form-label">
                  {keyStatus?.configured && !keyStatus.serverManaged
                    ? 'Update Gemini API Key'
                    : 'Gemini API Key'}
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      className="form-input"
                      type={showKey ? 'text' : 'password'}
                      value={geminiKey}
                      onChange={e => { setGeminiKey(e.target.value); setTestState('idle'); setTestMsg(''); }}
                      placeholder={keyStatus?.configured ? 'Enter new key to replace…' : 'AIza…'}
                      id="gemini-api-key-input"
                      style={{ paddingRight: '80px' }}
                      autoComplete="off"
                      disabled={keyStatus?.serverManaged}
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(v => !v)}
                      style={{
                        position: 'absolute', right: '10px', top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none', border: 'none',
                        color: 'var(--text-muted)', fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      {showKey ? 'Hide' : 'Show'}
                    </button>
                  </div>

                  {/* Test button — calls backend /ai/key/test */}
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={testKey}
                    disabled={testState === 'testing' || !geminiKey.trim() || keyStatus?.serverManaged}
                    id="test-gemini-key-btn"
                  >
                    {testState === 'testing' ? '⏳ Testing…' : '🧪 Test Key'}
                  </button>
                </div>

                {/* Test result */}
                {testMsg && (
                  <div style={{
                    marginTop: '8px', fontSize: '12px', fontWeight: 500,
                    color: testState === 'ok' ? 'var(--success)' : testState === 'error' ? 'var(--danger)' : 'var(--text-muted)',
                  }}>
                    {testMsg}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              {!keyStatus?.serverManaged && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    id="save-ai-key-btn"
                    disabled={aiSaving || !geminiKey.trim()}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    {aiSaving ? '⏳ Saving…' : aiSaved ? '✓ Saved to database' : '💾 Save API Key'}
                  </button>
                  {keyStatus?.configured && (
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={removeKey}
                      disabled={aiRemoving}
                      title="Remove API key from database"
                    >
                      {aiRemoving ? '⏳' : '🗑 Remove'}
                    </button>
                  )}
                </div>
              )}
            </form>
          </div>
        </div>

        {/* ── System info ──────────────────────────────────────────────── */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header"><span className="card-title">🖥️ System Information</span></div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0' }}>
              {infoRows.map(({ label, value }, i) => (
                <div key={label} style={{
                  padding: '12px 16px',
                  borderBottom: i < infoRows.length - 3 ? '1px solid var(--border)' : 'none',
                  borderRight: (i + 1) % 3 !== 0 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Danger zone ──────────────────────────────────────────────── */}
        <div className="card" style={{ gridColumn: '1 / -1', borderColor: 'var(--danger-light)' }}>
          <div className="card-header" style={{ borderColor: 'var(--danger-light)' }}>
            <span className="card-title" style={{ color: 'var(--danger)' }}>⚠️ Danger Zone</span>
          </div>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>Sign out of admin panel</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>You will be redirected to the login page.</div>
            </div>
            <button className="btn btn-danger" onClick={logout}>Sign out →</button>
          </div>
        </div>
      </div>
    </>
  );
}
