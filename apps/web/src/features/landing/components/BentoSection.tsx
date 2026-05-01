'use client';
import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import styles from './BentoSection.module.scss';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 32 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.6, delay, ease: 'easeOut' as const },
});

/* ── SVG Illustrations ─────────────────────────────────────── */
const IlluUptime = () => (
  <svg viewBox="0 0 200 120" fill="none" className={styles.illus}>
    {/* Background grid */}
    {[0,40,80,120,160,200].map(x => (
      <line key={x} x1={x} y1="0" x2={x} y2="120" stroke="currentColor" strokeWidth="0.4" opacity="0.12"/>
    ))}
    {[0,30,60,90,120].map(y => (
      <line key={y} x1="0" y1={y} x2="200" y2={y} stroke="currentColor" strokeWidth="0.4" opacity="0.12"/>
    ))}
    {/* Uptime line */}
    <defs>
      <linearGradient id="uptimeGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#22c55e" stopOpacity="0.35"/>
        <stop offset="100%" stopColor="#22c55e" stopOpacity="0"/>
      </linearGradient>
    </defs>
    <path d="M0,80 L30,78 L60,76 L90,78 L100,60 L110,10 L120,62 L150,72 L180,70 L200,68" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M0,80 L30,78 L60,76 L90,78 L100,60 L110,10 L120,62 L150,72 L180,70 L200,68 L200,120 L0,120Z" fill="url(#uptimeGrad)"/>
    {/* Spike label */}
    <circle cx="110" cy="10" r="4" fill="#22c55e"/>
    <rect x="118" y="2" width="50" height="16" rx="6" fill="#22c55e"/>
    <text x="143" y="13" textAnchor="middle" fill="white" fontSize="8" fontWeight="700">99.99%</text>
    {/* Pulse rings */}
    <circle cx="110" cy="10" r="8" stroke="#22c55e" strokeWidth="1" opacity="0.4"/>
    <circle cx="110" cy="10" r="13" stroke="#22c55e" strokeWidth="0.6" opacity="0.2"/>
  </svg>
);

const IlluLatency = () => (
  <svg viewBox="0 0 160 100" fill="none" className={styles.illus}>
    <defs>
      <linearGradient id="latGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#a78bfa"/>
        <stop offset="100%" stopColor="#60a5fa"/>
      </linearGradient>
    </defs>
    {/* Gauge arc */}
    <path d="M20,80 A60,60 0 0 1 140,80" stroke="rgba(167,139,250,0.15)" strokeWidth="10" strokeLinecap="round" fill="none"/>
    <path d="M20,80 A60,60 0 0 1 95,26" stroke="url(#latGrad)" strokeWidth="10" strokeLinecap="round" fill="none"/>
    {/* Needle */}
    <line x1="80" y1="80" x2="95" y2="30" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round"/>
    <circle cx="80" cy="80" r="6" fill="#1a1a1a"/>
    <circle cx="80" cy="80" r="3" fill="white"/>
    {/* Labels */}
    <text x="15" y="96" fill="#6b6b6b" fontSize="8">0ms</text>
    <text x="130" y="96" fill="#6b6b6b" fontSize="8">1s</text>
    <text x="75" y="95" textAnchor="middle" fill="#1a1a1a" fontSize="18" fontWeight="800">&lt;5ms</text>
  </svg>
);

const IlluShield = () => (
  <svg viewBox="0 0 100 110" fill="none" className={styles.illus}>
    <defs>
      <linearGradient id="shieldGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fef9c3"/>
        <stop offset="100%" stopColor="#fde68a"/>
      </linearGradient>
    </defs>
    <path d="M50,8 L85,22 L85,55 Q85,80 50,98 Q15,80 15,55 L15,22 Z" fill="url(#shieldGrad)" stroke="#1a1a1a" strokeWidth="2"/>
    {/* Check */}
    <path d="M34,52 L44,62 L67,39" stroke="#1a1a1a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    {/* Lock icon inside */}
    <rect x="42" y="38" width="16" height="12" rx="2" stroke="#1a1a1a" strokeWidth="1.5" fill="rgba(255,255,255,0.5)"/>
    <path d="M45,38 Q45,32 50,32 Q55,32 55,38" stroke="#1a1a1a" strokeWidth="1.5" fill="none"/>
  </svg>
);

const IlluGlobe = () => (
  <svg viewBox="0 0 120 120" fill="none" className={styles.illus}>
    <circle cx="60" cy="60" r="44" stroke="rgba(59,130,246,0.25)" strokeWidth="1.5" fill="rgba(59,130,246,0.04)"/>
    <ellipse cx="60" cy="60" rx="44" ry="20" stroke="rgba(59,130,246,0.2)" strokeWidth="1"/>
    <line x1="60" y1="16" x2="60" y2="104" stroke="rgba(59,130,246,0.2)" strokeWidth="1"/>
    {/* Location dots */}
    {[[32,45],[75,38],[88,68],[45,80],[60,30]].map(([cx,cy],i) => (
      <g key={i}>
        <circle cx={cx} cy={cy} r="3.5" fill="#3b82f6"/>
        <circle cx={cx} cy={cy} r="6" stroke="#3b82f6" strokeWidth="0.8" opacity="0.4"/>
      </g>
    ))}
    {/* Connection lines */}
    <line x1="32" y1="45" x2="75" y2="38" stroke="#3b82f6" strokeWidth="0.8" opacity="0.3" strokeDasharray="3,3"/>
    <line x1="75" y1="38" x2="88" y2="68" stroke="#3b82f6" strokeWidth="0.8" opacity="0.3" strokeDasharray="3,3"/>
    <line x1="45" y1="80" x2="88" y2="68" stroke="#3b82f6" strokeWidth="0.8" opacity="0.3" strokeDasharray="3,3"/>
    <line x1="60" y1="30" x2="32" y2="45" stroke="#3b82f6" strokeWidth="0.8" opacity="0.3" strokeDasharray="3,3"/>
    <text x="60" y="118" textAnchor="middle" fill="#6b6b6b" fontSize="8" fontWeight="600">25+ Global Nodes</text>
  </svg>
);

const IlluCode = () => (
  <div className={styles.codeBlock}>
    <div className={styles.codeLine}><span className={styles.kw}>npx</span> apio-cli@latest init</div>
    <div className={styles.codeLine}><span className={styles.str}>✓</span> Token validated</div>
    <div className={styles.codeLine}><span className={styles.str}>✓</span> Agent injected</div>
    <div className={styles.codeLine}><span className={styles.kw}>npm</span> run dev</div>
    <div className={styles.codeLine}><span className={styles.ok}>[apio]</span> Sender active →</div>
    <div className={styles.codeLine}><span className={styles.muted}>Watching 6 endpoints…</span></div>
  </div>
);

/* ── Feature cards data ─────────────────────────────────────── */
const FEATURES = [
  {
    icon: '⚡',
    title: 'Sub-ms Overhead',
    desc: 'Our async queue adds less than 0.2ms to every request. Zero blocking, zero latency tax.',
    color: '#fef3c7',
    accent: '#f59e0b',
  },
  {
    icon: '🌐',
    title: 'Global Edge Nodes',
    desc: '25+ monitoring nodes across 6 continents. Your APIs watched from the user\'s perspective.',
    color: '#dbeafe',
    accent: '#3b82f6',
  },
  {
    icon: '🔒',
    title: 'Enterprise Security',
    desc: 'SOC 2 Type II compliant. Token-scoped access, audit logs, and encrypted telemetry.',
    color: '#dcfce7',
    accent: '#22c55e',
  },
  {
    icon: '📊',
    title: 'Deep Analytics',
    desc: 'P50/P95/P99 latency, error rates, throughput heatmaps — all queryable by time range.',
    color: '#f3e8ff',
    accent: '#a78bfa',
  },
  {
    icon: '🔔',
    title: 'Smart Alerts',
    desc: 'Anomaly detection triggers Slack, PagerDuty, or webhooks before users notice a thing.',
    color: '#fce7f3',
    accent: '#ec4899',
  },
  {
    icon: '🚀',
    title: 'One-Command Setup',
    desc: 'Install in 30 seconds. Works with Node, Python, Go, Java — no code changes required.',
    color: '#e0f2fe',
    accent: '#0ea5e9',
  },
];

/* ── Main export ─────────────────────────────────────────────── */
export default function BentoSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: '-80px' });

  return (
    <section ref={sectionRef} className={styles.section}>

      {/* ── Section header ── */}
      <motion.div className={styles.sectionHead} {...fadeUp(0)}>
        <span className={styles.eyebrow}>Platform Capabilities</span>
        <h2 className={styles.title}>
          Everything you need to<br />
          <span className={styles.titleAccent}>own your API reliability</span>
        </h2>
        <p className={styles.subtitle}>
          From zero-config setup to enterprise-grade analytics —<br className={styles.br}/>
          Apio gives you complete visibility in minutes.
        </p>
      </motion.div>

      {/* ── Bento Grid ── */}
      <div className={styles.bento}>

        {/* Cell 1 — Large: Uptime chart */}
        <motion.div className={`${styles.cell} ${styles.cellLarge}`} {...fadeUp(0.05)}>
          <div className={styles.cellTopRow}>
            <span className={styles.cellEyebrow}>Real-time Monitoring</span>
            <span className={styles.livePill}><span className={styles.liveDot}/>LIVE</span>
          </div>
          <h3 className={styles.cellTitle}>Always-on uptime tracking</h3>
          <p className={styles.cellDesc}>Visual heartbeat across all endpoints. Instant anomaly detection with sub-second precision.</p>
          <div className={styles.celIllusWrap}>
            <IlluUptime />
          </div>
        </motion.div>

        {/* Cell 2 — Medium: Latency gauge */}
        <motion.div className={`${styles.cell} ${styles.cellMed} ${styles.cellDark}`} {...fadeUp(0.1)}>
          <span className={styles.cellEyebrow} style={{ color: '#a78bfa' }}>Performance</span>
          <h3 className={styles.cellTitle} style={{ color: '#f1f5f9' }}>Zero latency tax</h3>
          <div className={styles.celIllusWrap} style={{ flex: 1 }}>
            <IlluLatency />
          </div>
          <div className={styles.statRow}>
            <div className={styles.stat}><span className={styles.statNum} style={{ color: '#a78bfa' }}>&lt;5ms</span><span className={styles.statLabel}>overhead</span></div>
            <div className={styles.stat}><span className={styles.statNum} style={{ color: '#60a5fa' }}>async</span><span className={styles.statLabel}>queue</span></div>
          </div>
        </motion.div>

        {/* Cell 3 — Small: Code snippet */}
        <motion.div className={`${styles.cell} ${styles.cellSmall} ${styles.cellCode}`} {...fadeUp(0.15)}>
          <span className={styles.cellEyebrow}>Quick Install</span>
          <h3 className={styles.cellTitle}>30-second setup</h3>
          <IlluCode />
        </motion.div>

        {/* Cell 4 — Medium: Security */}
        <motion.div className={`${styles.cell} ${styles.cellMed} ${styles.cellYellow}`} {...fadeUp(0.2)}>
          <span className={styles.cellEyebrow}>Security</span>
          <h3 className={styles.cellTitle}>Enterprise-grade protection</h3>
          <p className={styles.cellDesc}>SOC 2 Type II compliant. Every token is scoped, every request encrypted.</p>
          <div className={styles.celIllusWrap}>
            <IlluShield />
          </div>
        </motion.div>

        {/* Cell 5 — Large: Globe */}
        <motion.div className={`${styles.cell} ${styles.cellLarge} ${styles.cellBlue}`} {...fadeUp(0.25)}>
          <div className={styles.cellTopRow}>
            <span className={styles.cellEyebrow} style={{ color: '#3b82f6' }}>Global Infrastructure</span>
          </div>
          <h3 className={styles.cellTitle}>Monitored from every corner</h3>
          <p className={styles.cellDesc}>25+ edge nodes across 6 continents. We test your APIs where your users actually are.</p>
          <div className={styles.celIllusWrap}>
            <IlluGlobe />
          </div>
          <div className={styles.statRow}>
            {[['25+','Nodes'],['6','Continents'],['99.99%','Uptime SLA']].map(([n,l]) => (
              <div key={l} className={styles.stat}>
                <span className={styles.statNum} style={{ color: '#3b82f6' }}>{n}</span>
                <span className={styles.statLabel}>{l}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Cell 6 — Small: Requests stat */}
        <motion.div className={`${styles.cell} ${styles.cellSmall} ${styles.cellGreen}`} {...fadeUp(0.3)}>
          <span className={styles.cellEyebrow}>Scale</span>
          <div className={styles.bigStat}>1.2B+</div>
          <div className={styles.bigStatLabel}>Requests scanned monthly</div>
          <div className={styles.miniBarRow}>
            {[70,85,60,90,75,95,80].map((h, i) => (
              <motion.div
                key={i}
                className={styles.miniBar}
                initial={{ scaleY: 0 }}
                whileInView={{ scaleY: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.35 + i * 0.05, duration: 0.4 }}
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── 6-Feature grid ── */}
      <motion.div className={styles.featureGrid} {...fadeUp(0.1)}>
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            className={styles.featureCard}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ delay: 0.05 * i, duration: 0.55, ease: 'easeOut' as const }}
            style={{ '--accent': f.accent, '--bg': f.color } as React.CSSProperties}
          >
            <div className={styles.featureIcon}>{f.icon}</div>
            <h4 className={styles.featureTitle}>{f.title}</h4>
            <p className={styles.featureDesc}>{f.desc}</p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
