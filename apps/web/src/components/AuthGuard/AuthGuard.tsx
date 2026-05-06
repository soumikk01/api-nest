'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * AuthGuard — wraps every protected dashboard page.
 *
 * ## Flow (BetterAuth + JWT bridge)
 *
 * 1. Server renders nothing (avoids hydration mismatch — no localStorage on server)
 * 2. After first client paint, useAuth runs:
 *    a. If BetterAuth cookie exists → exchanges for JWT → loads profile → shows children
 *    b. If no cookie AND no JWT in localStorage → redirects to /login
 * 3. Subsequent navigations within the session are instant (JWT already in localStorage)
 */
export default function AuthGuard({ children }: AuthGuardProps) {
  const { isLoading, isAuthenticated } = useAuth();
  const [mounted, setMounted] = useState(false);

  // Prevent SSR mismatch — nothing rendered on server
  useEffect(() => { setMounted(true); }, []);

  // Redirect when auth check finishes with no session
  useEffect(() => {
    if (!mounted || isLoading) return;
    if (!isAuthenticated) {
      const authUrl = process.env.NEXT_PUBLIC_AUTH_URL ?? 'http://localhost:3001';
      window.location.href = `${authUrl}/login`;
    }
  }, [mounted, isLoading, isAuthenticated]);

  // ── Before mount: render nothing (matches SSR output) ────────────────────
  if (!mounted) return null;

  // ── Auth check running: wait ──────────────────────────────────────────────
  if (isLoading) return null;

  // ── Not authenticated: redirect firing ───────────────────────────────────
  if (!isAuthenticated) return null;

  // ── Authenticated: render children ───────────────────────────────────────
  return <>{children}</>;
}
