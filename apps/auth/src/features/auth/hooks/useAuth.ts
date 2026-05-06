'use client';

import { useState, useEffect, useCallback } from 'react';
import { authClient } from '@/lib/auth-client';

const BETTER_AUTH_BASE =
  // NEXT_PUBLIC_API_URL already contains /api/v1, so we only append /auth/better
  `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'}/auth/better`;

// ── Error sanitizer ───────────────────────────────────────────────────────────
// Strips raw HTTP paths / network details — shows professional messages instead.
function sanitizeError(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  if (
    raw.startsWith('Cannot POST') ||
    raw.startsWith('Cannot GET') ||
    raw.includes('/api/') ||
    raw.includes('fetch failed') ||
    raw.includes('NetworkError') ||
    raw.includes('Failed to fetch')
  ) return fallback;
  return raw;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface AuthUser {
  id: string;
  email: string;
  name?: string;
  image?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// ── useAuth ───────────────────────────────────────────────────────────────────
// Wraps BetterAuth client for all auth operations:
// login, register, logout, OAuth (Google/GitHub), forgot password.
// BetterAuth manages sessions via HTTP-only cookies — no manual token handling.
export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // ── Restore session on mount ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    authClient.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data?.user) {
        setState({ user: data.user as AuthUser, isAuthenticated: true, isLoading: false });
      } else {
        setState({ user: null, isAuthenticated: false, isLoading: false });
      }
    }).catch(() => {
      if (!cancelled) setState({ user: null, isAuthenticated: false, isLoading: false });
    });

    return () => { cancelled = true; };
  }, []);

  // ── Login (email + password) ───────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await authClient.signIn.email({ email, password });

    if (error) {
      if (error.status === 401 || error.status === 403)
        throw new Error('Incorrect email or password.');
      if (error.status === 429)
        throw new Error('Too many login attempts. Please wait a moment and try again.');
      throw new Error(sanitizeError(error.message, 'Sign in failed. Please try again.'));
    }

    if (!data?.user) throw new Error('Sign in failed. Please try again.');

    setState({ user: data.user as AuthUser, isAuthenticated: true, isLoading: false });

    // Redirect to web dashboard — BetterAuth session cookie is shared via backend
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    window.location.href = `${baseUrl}/projects`;
  }, []);

  // ── Register (email + password) ────────────────────────────────────────────
  const register = useCallback(async (email: string, password: string, name?: string) => {
    const { data, error } = await authClient.signUp.email({
      email,
      password,
      name: name ?? email.split('@')[0],
    });

    if (error) {
      if (error.status === 409 || error.message?.toLowerCase().includes('already'))
        throw new Error('An account with this email already exists.');
      if (error.status === 422 || error.message?.toLowerCase().includes('disposable') || error.message?.toLowerCase().includes('invalid email'))
        throw new Error(error.message ?? 'Please use a valid email address.');
      if (error.status === 429)
        throw new Error('Too many attempts. Please wait a moment and try again.');
      throw new Error(sanitizeError(error.message, 'Registration failed. Please try again.'));
    }

    if (!data?.user) throw new Error('Registration failed. Please try again.');

    setState({ user: data.user as AuthUser, isAuthenticated: true, isLoading: false });

    // Redirect to web dashboard after successful registration
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    window.location.href = `${baseUrl}/projects`;
  }, []);

  // ── OAuth — Google ─────────────────────────────────────────────────────────
  const loginWithGoogle = useCallback(async () => {
    await authClient.signIn.social({
      provider: 'google',
      callbackURL: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/projects`,
    });
  }, []);

  // ── OAuth — GitHub ─────────────────────────────────────────────────────────
  const loginWithGitHub = useCallback(async () => {
    await authClient.signIn.social({
      provider: 'github',
      callbackURL: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/projects`,
    });
  }, []);

  // ── Forgot Password — send reset email ────────────────────────────────────
  // Direct fetch avoids BetterAuth TS2349 plugin type-inference collision
  const sendPasswordResetEmail = useCallback(async (email: string) => {
    const redirectTo =
      `${process.env.NEXT_PUBLIC_AUTH_URL ?? 'http://localhost:3001'}/reset-password`;
    const res = await fetch(`${BETTER_AUTH_BASE}/forget-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, redirectTo }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(data.message ?? 'Failed to send reset email. Please try again.');
    }
  }, []);

  // ── Reset Password (from email link) ──────────────────────────────────────
  const resetPassword = useCallback(async (newPassword: string, token: string) => {
    const res = await fetch(`${BETTER_AUTH_BASE}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ newPassword, token }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { message?: string };
      throw new Error(data.message ?? 'Failed to reset password. Please try again.');
    }
  }, []);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await authClient.signOut();
    setState({ user: null, isAuthenticated: false, isLoading: false });
  }, []);

  const logoutWithTransition = useCallback((router: { push: (url: string) => void }) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('show-logout-transition'));
      setTimeout(async () => {
        await authClient.signOut();
        setState({ user: null, isAuthenticated: false, isLoading: false });
        router.push('/');
      }, 1200);
    } else {
      logout();
      router.push('/');
    }
  }, [logout]);

  return {
    ...state,
    login,
    register,
    loginWithGoogle,
    loginWithGitHub,
    sendPasswordResetEmail,
    resetPassword,
    logout,
    logoutWithTransition,
  };
}
