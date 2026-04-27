'use client';

import { useEffect } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { authStorage } from '@/lib/fetchWithAuth';

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * AuthGuard — wraps every protected dashboard page.
 *
 * Auth tokens use localStorage storage:
 *  - Access token: localStorage (instant restore on page refresh)
 *  - Refresh token: localStorage (used to silently renew AT when expired)
 *
 * Key fix for blank-page-on-navigation bug:
 *   useAuth() starts with isLoading=true on EVERY mount (even navigating between
 *   pages within the same session). If we block rendering until isLoading=false,
 *   the page shows blank on every route change until the /users/me call resolves.
 *
 *   Solution: check localStorage SYNCHRONOUSLY on first render.
 *   - If a token already exists  → render children immediately (no flicker)
 *   - If no token at all         → block until the async auth check completes,
 *                                  then redirect to login
 */
export default function AuthGuard({ children }: AuthGuardProps) {
  const { isLoading, user } = useAuth();

  // Synchronous check — does a token exist right now?
  // This is true on every page transition for a logged-in user.
  const hasTokenInStorage = authStorage.hasSession();

  useEffect(() => {
    // Only redirect once the async check has finished AND confirmed no session
    if (!isLoading && !user && !hasTokenInStorage) {
      window.location.href = `${process.env.NEXT_PUBLIC_AUTH_URL ?? 'http://localhost:3001'}/login`;
    }
  }, [isLoading, user, hasTokenInStorage]);

  // ── Case 1: No token at all (not logged in, never was) ──────────────────
  // Block rendering while auth check runs, then the effect above redirects.
  if (!hasTokenInStorage && isLoading) return null;

  // ── Case 2: Async check finished — genuinely unauthenticated ────────────
  // Redirect is already firing via the effect above; show nothing.
  if (!isLoading && !user && !hasTokenInStorage) return null;

  // ── Case 3: Token exists (logged in) or check still running ────────────
  // Render children immediately. Pages show their own shimmer/skeleton loaders
  // while their data fetches. This eliminates the blank-page flash on navigation.
  return <>{children}</>;
}
