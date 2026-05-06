'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from '../../features/auth/components/ForgotPasswordPage/ForgotPasswordPage.module.scss';

const AUTH_BASE = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'}`;

/* ── Spring Sparkles (mirrors ForgotPasswordPage) ── */
const SpringBackground = () => (
  <div className={styles.springBg} aria-hidden="true">
    <svg className={`${styles.sparkle} ${styles.sp1}`} viewBox="0 0 20 20" fill="none"><path d="M10,1 L11.2,8.8 L19,10 L11.2,11.2 L10,19 L8.8,11.2 L1,10 L8.8,8.8 Z" fill="#1A1A1A" opacity="0.65"/></svg>
    <svg className={`${styles.sparkle} ${styles.sp2}`} viewBox="0 0 14 14" fill="none"><path d="M7,1 L7.8,6.2 L13,7 L7.8,7.8 L7,13 L6.2,7.8 L1,7 L6.2,6.2 Z" fill="#1A1A1A" opacity="0.5"/></svg>
    <svg className={`${styles.sparkle} ${styles.sp3}`} viewBox="0 0 18 18" fill="none"><path d="M9,1.5 L10,7.8 L16.5,9 L10,10.2 L9,16.5 L8,10.2 L1.5,9 L8,7.8 Z" fill="#7C6050" opacity="0.4"/></svg>
    <svg className={`${styles.sparkle} ${styles.sp4}`} viewBox="0 0 10 10" fill="none"><path d="M5,0.5 L5.6,4.4 L9.5,5 L5.6,5.6 L5,9.5 L4.4,5.6 L0.5,5 L4.4,4.4 Z" fill="#1A1A1A" opacity="0.45"/></svg>
    <svg className={`${styles.sparkle} ${styles.sp5}`} viewBox="0 0 16 16" fill="none"><path d="M8,1 L9,6.8 L15,8 L9,9.2 L8,15 L7,9.2 L1,8 L7,6.8 Z" fill="#1A1A1A" opacity="0.55"/></svg>
  </div>
);

function ResetPasswordContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [done, setDone] = useState(false);

  // If no token in URL — redirect to forgot-password immediately
  useEffect(() => {
    if (!token) {
      router.replace('/forgot-password');
    }
  }, [token, router]);

  const handleInvalid = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 600);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.');
      handleInvalid();
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      handleInvalid();
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${AUTH_BASE}/auth/better/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ newPassword: password, token }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(data.message ?? 'Failed to reset password. The link may have expired.');
      }

      setDone(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch (err) {
      setError((err as Error).message);
      handleInvalid();
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) return null;

  return (
    <div className={`${styles.page} ${styles.dark}`}>
      <div className={styles.patternOverlay} />
      <div className={styles.noiseOverlay} />
      <SpringBackground />

      {/* Navbar */}
      <div className={styles.navWrap}>
        <nav className={styles.nav}>
          <div className={styles.logo}>
            <span className={styles.logoMark}>APIO</span>
          </div>
          <Link href="/login" className={styles.backLink}>← Login</Link>
        </nav>
      </div>

      {/* Main */}
      <main className={styles.centerMain}>
        <div className={styles.centerStack}>

          {/* Icon + Title */}
          <div className={styles.topCopy}>
            <div className={styles.introIcon}>
              {done ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              )}
            </div>
            <h1 className={styles.introTitle}>
              {done ? 'Password updated' : 'New password'}
            </h1>
            <p className={styles.introSub}>
              {done
                ? 'Redirecting you to login…'
                : 'Choose a strong password for your Apio account'}
            </p>
          </div>

          {/* Card */}
          {!done && (
            <div className={styles.card}>
              <form className={styles.form} onSubmit={handleSubmit} noValidate>

                {error && (
                  <div className={styles.errorBanner} role="alert">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    {error}
                  </div>
                )}

                {/* New password */}
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="new-password">New Password</label>
                  <input
                    id="new-password"
                    type="password"
                    className={`${styles.input} ${isShaking ? styles.inputError : ''}`}
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoFocus
                    autoComplete="new-password"
                    required
                    minLength={8}
                  />
                </div>

                {/* Confirm password */}
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="confirm-password">Confirm Password</label>
                  <input
                    id="confirm-password"
                    type="password"
                    className={`${styles.input} ${isShaking ? styles.inputError : ''}`}
                    placeholder="Repeat your password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className={`${styles.submitBtn} ${isLoading ? styles.loadingBtn : ''}`}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className={styles.loaderContent}>
                      <svg className={styles.spinnerIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                      Updating…
                    </span>
                  ) : 'Set New Password'}
                </button>
              </form>
            </div>
          )}

          {/* Bottom link */}
          {!done && (
            <div className={styles.bottomUtilLinks}>
              <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)' }}>
                Remembered it?
              </span>
              <Link href="/login" className={styles.bottomRegisterLink}>
                Log in →
              </Link>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
