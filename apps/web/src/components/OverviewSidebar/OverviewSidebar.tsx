'use client';

import { useState, useEffect } from 'react';
import styles from './OverviewSidebar.module.scss';

export default function OverviewSidebar() {
  const [activeSection, setActiveSection] = useState<string>('metrics');

  // Scroll-spy: track which section is visible in the viewport
  useEffect(() => {
    const sections = ['metrics', 'traffic'];
    const observers: IntersectionObserver[] = [];

    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id); },
        { threshold: 0.4 },
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <h3 className={styles.title}>Overview</h3>
      </div>
      <nav className={styles.nav}>
        <a href="#metrics" className={`${styles.navItem} ${activeSection === 'metrics' ? styles.active : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M12 20V10M18 20V4M6 20v-4" />
          </svg>
          <span className={styles.label}>Core Metrics</span>
        </a>
        <a href="#traffic" className={`${styles.navItem} ${activeSection === 'traffic' ? styles.active : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <span className={styles.label}>Traffic Matrix</span>
        </a>
      </nav>
    </aside>
  );
}
