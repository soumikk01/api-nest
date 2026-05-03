'use client';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAiChat } from './AiChatProvider';

const navItems = [
  { href: '/dashboard',           label: 'Overview',   icon: '◉' },
  { href: '/dashboard/live',      label: 'Live Feed',  icon: '⬤', badge: 'LIVE' },
  { href: '/dashboard/users',     label: 'Users',      icon: '👤' },
  { href: '/dashboard/projects',  label: 'Projects',   icon: '📁' },
  { href: '/dashboard/history',   label: 'History',    icon: '🕐' },
  { href: '/dashboard/analytics', label: 'Analytics',  icon: '📊' },
];

const bottomItems = [
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { openChat } = useAiChat();

  function logout() {
    localStorage.removeItem('admin_token');
    router.push('/');
  }

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">📡</div>
        <span className="sidebar-logo-text">Apio</span>
        <span className="sidebar-logo-badge">ADMIN</span>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="sidebar-section">
          <div className="sidebar-section-label">Platform</div>
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-item${active ? ' active' : ''}`}
              >
                <span className="sidebar-icon">{item.icon}</span>
                {item.label}
                {item.badge && (
                  <span className="sidebar-badge" style={{ background: 'var(--success)', fontSize: '9px' }}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* AI Assistant quick-access */}
        <div className="sidebar-section" style={{ marginTop: '8px' }}>
          <div className="sidebar-section-label">AI Tools</div>
          <button
            className="sidebar-item sidebar-ai-btn"
            onClick={() => openChat()}
            id="sidebar-ai-assistant-btn"
            title="Open AI Assistant"
          >
            <span className="sidebar-icon">🤖</span>
            AI Assistant
            <span className="sidebar-badge" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', fontSize: '9px' }}>
              NEW
            </span>
          </button>
        </div>

        <div className="sidebar-section" style={{ marginTop: '8px' }}>
          <div className="sidebar-section-label">System</div>
          {bottomItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-item${active ? ' active' : ''}`}
              >
                <span className="sidebar-icon">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">A</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">Admin</div>
            <div className="sidebar-user-role">Super Admin</div>
          </div>
          <button
            onClick={logout}
            title="Log out"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', padding: '4px' }}
          >
            ⎋
          </button>
        </div>
      </div>
    </aside>
  );
}
