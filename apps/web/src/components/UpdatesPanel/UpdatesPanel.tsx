'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import styles from './UpdatesPanel.module.scss';

function UpdatesPanelInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isOpen = searchParams.get('panel') === 'updates';

  const close = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('panel');
    const qs = params.toString();
    router.push(`${pathname}${qs ? '?' + qs : ''}`, { scroll: false });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className={styles.backdrop} onClick={close} aria-hidden="true" />

      {/* Drawer Panel */}
      <aside className={styles.panel} aria-label="Updates & Features">
        
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <span className={styles.sparkleIcon}>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
                <polygon points="10,1 19,6 19,14 10,19 1,14 1,6" />
                <path d="M10 5 Q10 10, 15 10 Q10 10, 10 15 Q10 10, 5 10 Q10 10, 10 5 Z" fill="#3b82f6" stroke="none" />
              </svg>
            </span>
            Updates & Features
          </div>
          <button className={styles.closeBtn} onClick={close} aria-label="Close panel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Scrollable Body (Chatting Window Style) */}
        <div className={styles.body}>
          
          <div className={`${styles.message} ${styles.messageSystem}`}>
            <div className={styles.messageTitle}>
              <span className={styles.badge}>NEW</span>
              Dashboard Refactor Complete!
            </div>
            <div className={styles.messageText}>
              We've just pushed a massive update to the core navigation and design system. Enjoy a more streamlined experience, faster token refreshing, and a beautiful new feature panel.
            </div>
            <span className={styles.timestamp}>Today at 10:45 AM</span>
          </div>

          <div className={`${styles.message} ${styles.messageSystem}`}>
            <div className={styles.messageTitle}>
              <span className={styles.badge}>SECURITY</span>
              Session Persistence Added
            </div>
            <div className={styles.messageText}>
              You will no longer be logged out when refreshing your browser. We have migrated our auth engine to use industry-standard LocalStorage refresh token rotation (matching Supabase and Auth0 flows).
            </div>
            <span className={styles.timestamp}>Yesterday at 4:20 PM</span>
          </div>

          <div className={`${styles.message} ${styles.messageSystem}`}>
            <div className={styles.messageTitle}>
              <span className={styles.badge}>SPEED</span>
              Rate Limiting Enabled
            </div>
            <div className={styles.messageText}>
              The backend API is now heavily fortified against spam requests and brute-force attacks. Stay secure while scaling to 10k+ concurrent connections!
            </div>
            <span className={styles.timestamp}>Apr 24 at 1:15 PM</span>
          </div>

        </div>
      </aside>
    </>
  );
}

export default function UpdatesPanel() {
  return (
    <Suspense fallback={null}>
      <UpdatesPanelInner />
    </Suspense>
  );
}
