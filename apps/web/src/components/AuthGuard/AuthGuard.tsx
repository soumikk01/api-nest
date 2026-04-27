'use client';

import { useEffect } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * AuthGuard — wraps every protected dashboard page.
 *
 * Auth tokens use Supabase-style localStorage storage:
 *  - Access token: localStorage (instant restore on page refresh)
 *  - Refresh token: localStorage (used to silently renew AT when expired)
 *
 * On page load: useAuth() reads the token directly from localStorage.
 * If the token is expired, fetchWithAuth automatically refreshes it.
 * The user stays logged in seamlessly with zero flicker.
 */
export default function AuthGuard({ children }: AuthGuardProps) {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      window.location.href = `${process.env.NEXT_PUBLIC_AUTH_URL ?? 'http://localhost:3001'}/login`;
    }
  }, [isLoading, user]);

  // Auth check in progress — render nothing (page shows its own skeleton)
  if (isLoading) return null;

  // Not authenticated — redirect is firing, show nothing to avoid flash
  if (!user) return null;

  return <>{children}</>;
}
