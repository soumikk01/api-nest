'use client';
import { useEffect, useState } from 'react';
import { useAiChat } from '../components/AiChatProvider';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

function token() {
  return typeof window !== 'undefined'
    ? localStorage.getItem('access_token') ?? localStorage.getItem('admin_token') ?? ''
    : '';
}

interface PlatformStats {
  totalUsers: number;
  totalProjects: number;
  totalCalls: number;
  errorRate: number;
  avgLatency: number;
}

interface RecentCall {
  id: string;
  method: string;
  url: string;
  statusCode: number;
  latency: number;
  status: string;
  createdAt: string;
}

function StatCard({ icon, iconClass, label, value, delta, deltaDir, onFixAI }: {
  icon: string;
  iconClass: string;
  label: string;
  value: string | number;
  delta?: string;
  deltaDir?: 'up' | 'down';
  onFixAI?: () => void;
}) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${iconClass}`}>{icon}</div>
      <div className="stat-info">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {delta && <div className={`stat-delta ${deltaDir}`}>{delta}</div>}
      </div>
      {onFixAI && (
        <button
          className="btn-fix-ai"
          onClick={onFixAI}
          title="Ask AI to explain this issue"
          style={{ alignSelf: 'flex-start', marginLeft: 'auto', whiteSpace: 'nowrap' }}
        >
          🔧 Fix
        </button>
      )}
    </div>
  );
}

export default function OverviewPage() {
  const { openChat } = useAiChat();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [recent, setRecent] = useState<RecentCall[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const t = token();
        const headers = { Authorization: `Bearer ${t}` };

        const [usersRes, projectsRes] = await Promise.all([
          fetch(`${API}/users/me`, { headers }),
          fetch(`${API}/projects`, { headers }),
        ]);

        const projects = (await projectsRes.json()) as { id: string }[];
        const user = (await usersRes.json()) as { id: string };

        let analyticsData = { total: 0, errorRate: 0, avgLatency: 0 };
        if (projects.length > 0) {
          const anRes = await fetch(`${API}/analytics/summary?projectId=${projects[0].id}`, { headers });
          if (anRes.ok) analyticsData = (await anRes.json()) as typeof analyticsData;
        }

        setStats({
          totalUsers: 1,
          totalProjects: projects.length,
          totalCalls: analyticsData.total,
          errorRate: analyticsData.errorRate,
          avgLatency: analyticsData.avgLatency,
        });

        if (projects.length > 0) {
          const histRes = await fetch(`${API}/history?projectId=${projects[0].id}&limit=8`, { headers });
          if (histRes.ok) {
            const d = (await histRes.json()) as { data: RecentCall[] };
            setRecent(d.data ?? []);
          }
        }

        void user;
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const latencyClass = (ms: number) =>
    ms < 200 ? 'latency-fast' : ms < 800 ? 'latency-med' : 'latency-slow';

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
        Loading platform data…
      </div>
    );
  }

  const errorRate = stats?.errorRate ?? 0;
  const hasErrors = errorRate > 0;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Platform Overview</div>
          <div className="page-subtitle">Real-time summary of all Apio activity</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => openChat()}
            id="overview-ask-ai-btn"
          >
            🤖 Ask AI
          </button>
          <div className="live-indicator">
            <div className="live-dot" />
            Live
          </div>
        </div>
      </div>

      {/* Error alert banner */}
      {hasErrors && (
        <div className="ai-error-alert" id="overview-error-alert">
          <div className="ai-error-alert-left">
            <span className="ai-error-alert-icon">🔴</span>
            <div>
              <div className="ai-error-alert-title">API Errors Detected</div>
              <div className="ai-error-alert-desc">
                Error rate is <strong>{errorRate}%</strong>. Click &quot;Fix Problem&quot; to get AI-powered diagnosis.
              </div>
            </div>
          </div>
          <button
            className="btn-fix-ai btn-fix-ai--lg"
            onClick={() => openChat({
              errorMessage: `High error rate detected: ${errorRate}%`,
              statusCode: undefined,
              endpoint: 'Multiple endpoints affected',
            })}
            id="overview-fix-ai-btn"
          >
            🔧 Fix Problem
          </button>
        </div>
      )}

      {/* Stat grid */}
      <div className="stat-grid">
        <StatCard icon="👤" iconClass="indigo" label="Total Users"    value={stats?.totalUsers ?? 0}   delta="↑ Your account" deltaDir="up" />
        <StatCard icon="📁" iconClass="blue"   label="Projects"       value={stats?.totalProjects ?? 0} />
        <StatCard icon="📡" iconClass="green"  label="API Calls (24h)" value={stats?.totalCalls ?? 0} />
        <StatCard
          icon="⚠️"
          iconClass={hasErrors ? 'red' : 'amber'}
          label="Error Rate"
          value={`${errorRate}%`}
          delta={errorRate === 0 ? 'All green ✓' : `${errorRate}% errors — needs attention`}
          deltaDir={errorRate === 0 ? 'up' : 'down'}
          onFixAI={hasErrors ? () => openChat({
            errorMessage: `Error rate is ${errorRate}%`,
            endpoint: 'Platform-wide',
          }) : undefined}
        />
      </div>

      {/* Recent calls table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Recent API Calls</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => openChat()}
              id="recent-ask-ai-btn"
            >
              🤖 Ask AI
            </button>
            <a href="/dashboard/history" className="btn btn-outline btn-sm">View all →</a>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {recent.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <div className="empty-title">No API calls yet</div>
              <div className="empty-desc">
                Run <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--surface-2)', padding: '2px 6px', borderRadius: '4px' }}>npx apio-cli init --token …</code> in your dev project to start monitoring
              </div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>URL</th>
                  <th>Status</th>
                  <th>Latency</th>
                  <th>Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((call) => {
                  const isError = call.statusCode >= 400;
                  return (
                    <tr key={call.id} style={{ background: isError ? 'rgba(239,68,68,0.03)' : undefined }}>
                      <td><span className={`method-badge method-${call.method}`}>{call.method}</span></td>
                      <td><span className="url-cell">{call.url}</span></td>
                      <td>
                        <span className={`badge badge-${call.statusCode < 400 ? 'success' : call.statusCode < 500 ? 'warning' : 'danger'}`}>
                          {call.statusCode}
                        </span>
                      </td>
                      <td><span className={`latency-cell ${latencyClass(call.latency)}`}>{call.latency}ms</span></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                        {new Date(call.createdAt).toLocaleTimeString()}
                      </td>
                      <td>
                        {isError ? (
                          <button
                            className="btn-fix-ai"
                            id={`overview-fix-${call.id}`}
                            onClick={() => openChat({
                              endpoint: call.url,
                              method: call.method,
                              statusCode: call.statusCode,
                              latency: call.latency,
                              timestamp: new Date(call.createdAt).toLocaleString(),
                            })}
                            title="Get AI diagnosis for this error"
                          >
                            🔧 Fix Problem
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
