'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(process.env.NEXT_PUBLIC_DUMMY_EMAIL ?? '');
  const [password, setPassword] = useState(process.env.NEXT_PUBLIC_DUMMY_PASSWORD ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // /auth/admin/login issues a separate admin JWT (ADMIN_JWT_SECRET, 7d expiry)
      const res = await fetch(`${API}/auth/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as {
        accessToken?: string; role?: string; email?: string;
        name?: string; expiresIn?: string; message?: string; statusCode?: number;
      };
      if (!res.ok) {
        if (res.status === 401) throw new Error('Incorrect email or password. Please try again.');
        if (res.status === 400) throw new Error('Please enter a valid email and password.');
        if (res.status === 429) throw new Error('Too many login attempts. Please wait a moment.');
        throw new Error(data.message ?? 'Login failed');
      }
      if (data.role !== 'admin') throw new Error('This account does not have admin access.');
      localStorage.setItem('admin_token', data.accessToken!);
      localStorage.setItem('access_token', data.accessToken!);
      localStorage.setItem('admin_expires_in', data.expiresIn ?? '7d');
      router.push('/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      {/* Left panel */}
      <div className="login-left">
        <div className="login-brand">
          <div className="login-brand-icon">📡</div>
          <h1>Apio<br />Admin Panel</h1>
          <p>
            Full visibility into every API call across all users and projects.
            Real-time monitoring, analytics, and platform management in one place.
          </p>
          <div className="login-features">
            {[
              'Live API call feed across all projects',
              'User management and access control',
              'Platform-wide analytics and error rates',
              'Per-user SDK token management',
            ].map((f) => (
              <div key={f} className="login-feature">
                <div className="login-feature-dot" />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="login-right">
        <div className="login-form-box">
          <h2>Welcome back</h2>
          <p>Sign in to your admin account</p>

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Email address</label>
              <input
                className="form-input"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div style={{
                background: 'var(--danger-light)',
                color: '#991b1b',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
                marginBottom: '16px',
              }}>
                {error}
                {error.includes('Incorrect email') && (
                  <div style={{ marginTop: '6px', fontSize: '12px', color: '#6b7280' }}>
                    Don&apos;t have an account?{' '}
                    <a
                      href={process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000'}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--accent)', textDecoration: 'underline' }}
                    >
                      Register on the main app →
                    </a>
                  </div>
                )}
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>

          <p style={{ marginTop: '24px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
            Admin access only · Apio Platform
          </p>
        </div>
      </div>
    </div>
  );
}
