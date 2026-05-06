'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import styles from '../../features/auth/components/ForgotPasswordPage/ForgotPasswordPage.module.scss';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

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

type Status = 'verifying' | 'success' | 'error' | 'no-token';

function VerifyEmailContent() {
  const params = useSearchParams();
  const token = params.get('token');

  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'no-token');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) return;

    // Call BetterAuth verify-email endpoint with the token from the email link
    (async () => {
      try {
        const res = await fetch(
          `${BACKEND}/auth/better/verify-email?token=${encodeURIComponent(token)}`,
          { method: 'GET', credentials: 'include' },
        );

        if (res.ok) {
          setStatus('success');
        } else {
          const data = await res.json().catch(() => ({})) as { message?: string };
          setErrorMsg(data.message ?? 'Verification failed. The link may have expired.');
          setStatus('error');
        }
      } catch {
        setErrorMsg('Network error. Please check your connection and try again.');
        setStatus('error');
      }
    })();
  }, [token]);

  // ── Icon ──────────────────────────────────────────────────────────────────
  const icon = {
    verifying: (
      <svg className={styles.spinnerIcon} style={{ width: 28, height: 28 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
    ),
    success: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
    ),
    error: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
    'no-token': (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  }[status];

  const title = {
    verifying: 'Verifying…',
    success:   'Email verified!',
    error:     'Verification failed',
    'no-token': 'Invalid link',
  }[status];

  const subtitle = {
    verifying:  'Confirming your email address',
    success:    'Your account is now active. You can sign in.',
    error:      errorMsg,
    'no-token': 'This link is invalid or has expired. Request a new one.',
  }[status];

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

          {/* Icon + copy */}
          <div className={styles.topCopy}>
            <div className={styles.introIcon}>{icon}</div>
            <h1 className={styles.introTitle}>{title}</h1>
            <p className={styles.introSub}>{subtitle}</p>
          </div>

          {/* CTA */}
          <div className={styles.card} style={{ textAlign: 'center' }}>
            {status === 'success' && (
              <Link href="/login" className={styles.submitBtn} style={{ display: 'inline-block', textDecoration: 'none' }}>
                Sign in →
              </Link>
            )}
            {(status === 'error' || status === 'no-token') && (
              <Link href="/forgot-password" className={styles.submitBtn} style={{ display: 'inline-block', textDecoration: 'none' }}>
                Request new link
              </Link>
            )}
          </div>

          {/* Bottom link */}
          <div className={styles.bottomUtilLinks}>
            <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)' }}>
              Already verified?
            </span>
            <Link href="/login" className={styles.bottomRegisterLink}>
              Log in →
            </Link>
          </div>

        </div>
      </main>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
