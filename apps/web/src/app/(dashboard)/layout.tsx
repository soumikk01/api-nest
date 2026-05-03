import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import TopNavbar from '@/components/TopNavbar/TopNavbar';
import AuthGuard from '@/components/AuthGuard/AuthGuard';

// Lazy load: only shown on user action (panel=getting-started query param)
const ConnectPanel = dynamic(() => import('@/components/ConnectPanel/ConnectPanel'));

// Lazy load: only shown on user action (panel=ai-chat query param)
const AiChatPanel = dynamic(() => import('@/components/AiChatPanel/AiChatPanel'));

// Lazy load: only shown during logout animation
const LogoutOverlay = dynamic(() => import('@/components/LogoutOverlay/LogoutOverlay'));

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div style={{ height: '100vh', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <Suspense fallback={<div style={{ height: '46px' }} />}>
          <TopNavbar />
        </Suspense>
        {/* Push page content below the fixed 46px navbar */}
        <div style={{ flex: 1, marginTop: '46px', overflowY: 'auto', boxSizing: 'border-box' }}>
          {children}
        </div>
      </div>
      {/* Right-side panels */}
      <ConnectPanel />
      <AiChatPanel />
      {/* Full-screen animated logout transition */}
      <LogoutOverlay />
    </AuthGuard>
  );
}
