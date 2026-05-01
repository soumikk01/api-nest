'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import styles from './DashboardMockSection.module.scss';

/* ─── Mock data ─────────────────────────────────────────── */
const ENDPOINTS = [
  { method: 'GET',    path: '/api/v1/users',          status: 200, latency: 42,  rpm: 1240 },
  { method: 'POST',   path: '/api/v1/auth/login',     status: 201, latency: 118, rpm: 430  },
  { method: 'GET',    path: '/api/v1/products',       status: 200, latency: 28,  rpm: 3100 },
  { method: 'DELETE', path: '/api/v1/orders/:id',     status: 204, latency: 55,  rpm: 87   },
  { method: 'PATCH',  path: '/api/v1/users/:id',      status: 200, latency: 73,  rpm: 210  },
  { method: 'GET',    path: '/api/v1/analytics',      status: 200, latency: 190, rpm: 560  },
];

const LIVE_EVENTS = [
  { method: 'GET',  path: '/api/v1/users',      status: 200, latency: 38  },
  { method: 'POST', path: '/api/v1/auth/login', status: 201, latency: 112 },
  { method: 'GET',  path: '/api/v1/products',   status: 200, latency: 22  },
  { method: 'GET',  path: '/api/v1/analytics',  status: 500, latency: 3200},
  { method: 'GET',  path: '/api/v1/users',      status: 200, latency: 45  },
  { method: 'PATCH',path: '/api/v1/users/42',   status: 200, latency: 68  },
];

const TERMINAL_LINES = [
  { delay: 0,    text: '~/my-backend ❯ ',          type: 'prompt' },
  { delay: 300,  text: 'npx apio-cli@latest init --token sk_prod_••••••••', type: 'cmd' },
  { delay: 1200, text: '',                          type: 'blank' },
  { delay: 1400, text: '  ✓ Token validated',       type: 'success' },
  { delay: 1800, text: '  ✓ Project created on dashboard', type: 'success' },
  { delay: 2200, text: '  ✓ package.json start script patched', type: 'success' },
  { delay: 2600, text: '  ✓ .apio.json config saved', type: 'success' },
  { delay: 3000, text: '',                          type: 'blank' },
  { delay: 3200, text: '~/my-backend ❯ npm run dev', type: 'cmd' },
  { delay: 4000, text: '',                          type: 'blank' },
  { delay: 4200, text: '  [apio] ✅ Monitoring active → http://localhost:4000', type: 'active' },
  { delay: 4600, text: '  [apio] Watching 6 endpoints…', type: 'info' },
  { delay: 5000, text: '',                          type: 'blank' },
  { delay: 5200, text: '  GET  /api/v1/users         200  42ms', type: 'log' },
  { delay: 5600, text: '  POST /api/v1/auth/login    201 118ms', type: 'log' },
  { delay: 6000, text: '  GET  /api/v1/products      200  28ms', type: 'log' },
];

const BAR_DATA = [65, 80, 55, 90, 72, 88, 60, 95, 70, 85, 78, 92];
const METHOD_COLOR: Record<string, string> = {
  GET: '#3b82f6', POST: '#10b981', DELETE: '#ef4444', PATCH: '#f59e0b', PUT: '#8b5cf6',
};
const STATUS_COLOR = (s: number) => s >= 500 ? '#ef4444' : s >= 400 ? '#f59e0b' : '#10b981';

/* ─── Terminal component ─────────────────────────────────── */
function AnimatedTerminal() {
  const [visibleLines, setVisibleLines] = useState<number[]>([]);
  const [cursor, setCursor] = useState(true);
  const termBodyRef = useRef<HTMLDivElement>(null);  // scroll ONLY the terminal box

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    TERMINAL_LINES.forEach((_, i) => {
      timers.push(setTimeout(() => {
        setVisibleLines(prev => [...prev, i]);
        // Scroll only the terminal's own body — NOT the page
        if (termBodyRef.current) {
          termBodyRef.current.scrollTop = termBodyRef.current.scrollHeight;
        }
      }, TERMINAL_LINES[i].delay + 600));
    });
    const cur = setInterval(() => setCursor(c => !c), 530);
    return () => { timers.forEach(clearTimeout); clearInterval(cur); };
  }, []);

  return (
    <div className={styles.terminal}>
      <div className={styles.termBar}>
        <span className={styles.dot} style={{ background: '#ff5f57' }} />
        <span className={styles.dot} style={{ background: '#febc2e' }} />
        <span className={styles.dot} style={{ background: '#28c840' }} />
        <span className={styles.termTitle}>zsh — my-backend</span>
      </div>
      <div className={styles.termBody} ref={termBodyRef}>
        {TERMINAL_LINES.map((line, i) => (
          <AnimatePresence key={i}>
            {visibleLines.includes(i) && (
              <motion.div
                className={`${styles.termLine} ${styles[`termLine_${line.type}`]}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                {line.text}
                {i === visibleLines[visibleLines.length - 1] && line.type === 'prompt' && (
                  <span className={styles.cursor} style={{ opacity: cursor ? 1 : 0 }}>▋</span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        ))}
      </div>
    </div>
  );
}

/* ─── Dashboard mock ─────────────────────────────────────── */
// Extend event type with a stable id for AnimatePresence key tracking
type LiveEvent = typeof LIVE_EVENTS[number] & { id: number };

function DashboardMock() {
  // liveIdx lives in a ref — no state needed, so useEffect runs only once (Bug 1 fix)
  const liveIdxRef = useRef(0);
  const [liveLog, setLiveLog] = useState<LiveEvent[]>([]);
  const [totalReq, setTotalReq] = useState(12847);
  const [activeTab, setActiveTab] = useState<'apis' | 'analytics'>('apis');

  useEffect(() => {
    // ✅ Bug 1 fixed: empty dep array — interval is created once and never torn down
    const t = setInterval(() => {
      const next = LIVE_EVENTS[liveIdxRef.current % LIVE_EVENTS.length];
      // ✅ Bug 3 fixed: stable monotonic id so AnimatePresence tracks exits correctly
      const entry: LiveEvent = { ...next, id: Date.now() };
      setLiveLog(prev => [entry, ...prev].slice(0, 6));
      liveIdxRef.current += 1;
      setTotalReq(n => n + Math.floor(Math.random() * 4) + 1);
    }, 1400);
    return () => clearInterval(t);
  }, []);

  return (
    <div className={styles.dashboard}>
      {/* Sidebar */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarLogo}>
          <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
            <polygon points="10,1 19,6 19,14 10,19 1,14 1,6" stroke="#a78bfa" strokeWidth="1.5" fill="none"/>
            <circle cx="10" cy="10" r="3" fill="#a78bfa"/>
          </svg>
        </div>
        {[
          { icon: '◈', label: 'Overview',   active: false },
          { icon: '⚡', label: 'APIs',       active: activeTab === 'apis' },
          { icon: '📊', label: 'Analytics',  active: activeTab === 'analytics' },
          { icon: '🛡', label: 'Security',   active: false },
          { icon: '⚙', label: 'Settings',   active: false },
        ].map(item => (
          <button
            key={item.label}
            className={`${styles.sidebarItem} ${item.active ? styles.sidebarItemActive : ''}`}
            onClick={() => item.label === 'APIs' ? setActiveTab('apis') : item.label === 'Analytics' ? setActiveTab('analytics') : undefined}
            title={item.label}
          >
            <span className={styles.sidebarIcon}>{item.icon}</span>
            <span className={styles.sidebarLabel}>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Main panel */}
      <div className={styles.main}>
        {/* Top bar */}
        <div className={styles.topBar}>
          <div className={styles.topBarLeft}>
            <span className={styles.topBarTitle}>
              {activeTab === 'apis' ? 'API Explorer' : 'Analytics'}
            </span>
            <span className={styles.liveBadge}>
              <span className={styles.liveDot} /> LIVE
            </span>
          </div>
          <div className={styles.topBarRight}>
            <span className={styles.statPill}>
              <span className={styles.statPillNum}>{totalReq.toLocaleString()}</span> total req
            </span>
            <span className={styles.statPill} style={{ color: '#10b981' }}>
              99.9% uptime
            </span>
          </div>
        </div>

        {activeTab === 'apis' ? (
          <div className={styles.panelContent}>
            {/* API table */}
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Endpoint</th>
                    <th>Status</th>
                    <th>Latency</th>
                    <th>RPM</th>
                  </tr>
                </thead>
                <tbody>
                  {ENDPOINTS.map((ep, i) => (
                    <motion.tr
                      key={ep.path}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                    >
                      <td>
                        <span className={styles.methodBadge} style={{ background: `${METHOD_COLOR[ep.method]}22`, color: METHOD_COLOR[ep.method] }}>
                          {ep.method}
                        </span>
                      </td>
                      <td className={styles.pathCell}>{ep.path}</td>
                      <td>
                        <span className={styles.statusDot} style={{ color: STATUS_COLOR(ep.status) }}>
                          ● {ep.status}
                        </span>
                      </td>
                      <td className={styles.latencyCell} style={{ color: ep.latency > 200 ? '#f59e0b' : '#6ee7b7' }}>
                        {ep.latency}ms
                      </td>
                      <td className={styles.rpmCell}>{ep.rpm.toLocaleString()}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Live stream */}
            <div className={styles.liveStream}>
              <div className={styles.liveStreamHeader}>
                <span className={styles.liveDot} /> Real-time stream
              </div>
              <div className={styles.liveStreamBody}>
                <AnimatePresence>
                  {liveLog.map((ev) => (
                    <motion.div
                      // Bug 3 fix: stable id — no index-based remounting on each tick
                      key={ev.id}
                      className={styles.liveRow}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <span style={{ color: METHOD_COLOR[ev.method], fontWeight: 600, width: 52, display: 'inline-block' }}>{ev.method}</span>
                      <span className={styles.livePath}>{ev.path}</span>
                      <span style={{ color: STATUS_COLOR(ev.status), marginLeft: 'auto' }}>{ev.status}</span>
                      <span style={{ color: ev.latency > 500 ? '#ef4444' : '#6ee7b7', marginLeft: 12 }}>{ev.latency}ms</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.panelContent}>
            {/* Analytics */}
            <div className={styles.analyticsGrid}>
              <div className={styles.analyticsCard}>
                <div className={styles.analyticsLabel}>Requests / min</div>
                <div className={styles.chartBars}>
                  {BAR_DATA.map((h, i) => (
                    <motion.div
                      key={i}
                      className={styles.bar}
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ delay: i * 0.04, duration: 0.4 }}
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>
              <div className={styles.analyticsCard}>
                <div className={styles.analyticsLabel}>Status breakdown</div>
                <div className={styles.donutWrap}>
                  <svg viewBox="0 0 80 80" className={styles.donut}>
                    <circle cx="40" cy="40" r="28" fill="none" stroke="#10b981" strokeWidth="12" strokeDasharray="145 40" strokeDashoffset="25"/>
                    <circle cx="40" cy="40" r="28" fill="none" stroke="#f59e0b" strokeWidth="12" strokeDasharray="22 163" strokeDashoffset="-120"/>
                    <circle cx="40" cy="40" r="28" fill="none" stroke="#ef4444" strokeWidth="12" strokeDasharray="18 167" strokeDashoffset="-142"/>
                    <text x="40" y="44" textAnchor="middle" fill="#f1f5f9" fontSize="10" fontWeight="700">99.1%</text>
                  </svg>
                  <div className={styles.donutLegend}>
                    {[['#10b981','2xx OK'],['#f59e0b','4xx Warn'],['#ef4444','5xx Err']].map(([c,l])=>(
                      <div key={l} className={styles.legendRow}>
                        <span className={styles.legendDot} style={{background:c}}/>
                        <span>{l}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className={styles.analyticsCard} style={{gridColumn:'1/-1'}}>
                <div className={styles.analyticsLabel}>P99 Latency (ms) — last 12 intervals</div>
                <div className={styles.lineChartWrap}>
                  <svg viewBox="0 0 300 60" className={styles.lineChart}>
                    <defs>
                      {/* ✅ Bug 2 fixed: unique id prevents collision with other SVGs on the page */}
                      <linearGradient id="dm-latency-lg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.4"/>
                        <stop offset="100%" stopColor="#a78bfa" stopOpacity="0"/>
                      </linearGradient>
                    </defs>
                    <path d="M0 45 L25 38 L50 42 L75 20 L100 35 L125 18 L150 40 L175 15 L200 30 L225 22 L250 35 L275 10 L300 25" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M0 45 L25 38 L50 42 L75 20 L100 35 L125 18 L150 40 L175 15 L200 30 L225 22 L250 35 L275 10 L300 25 L300 60 L0 60Z" fill="url(#dm-latency-lg)"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main export ────────────────────────────────────────── */
export default function DashboardMockSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section ref={ref} className={styles.section} id="product-demo">
      {/* Section label */}
      <motion.div
        className={styles.sectionLabel}
        initial={{ opacity: 0, y: 16 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
      >
        <span className={styles.labelDot} />
        See it in action — zero config, one command
      </motion.div>

      <div className={styles.splitRow}>
        {/* Left — Terminal */}
        <motion.div
          className={styles.leftCol}
          initial={{ opacity: 0, x: -40 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className={styles.colLabel}>
            <span className={styles.stepNum}>1</span> Run in your terminal
          </div>
          <AnimatedTerminal />
          <div className={styles.arrow}>
            <svg viewBox="0 0 40 20" fill="none" width="48">
              <path d="M0 10 L30 10 M22 4 L30 10 L22 16" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </motion.div>

        {/* Right — Dashboard mock */}
        <motion.div
          className={styles.rightCol}
          initial={{ opacity: 0, x: 40 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.25 }}
        >
          <div className={styles.colLabel}>
            <span className={styles.stepNum}>2</span> Your live dashboard
          </div>
          <DashboardMock />
        </motion.div>
      </div>
    </section>
  );
}
