import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth, authStorage } from '@/lib/fetchWithAuth';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

interface AuthUser {
  id: string;
  email: string;
  name?: string;
  sdkToken: string;
  avatar: number;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

function syncAvatarToStorage(avatar: number) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('userAvatarIndex', String(avatar));
    window.dispatchEvent(new Event('avatarChanged'));
  }
}

/**
 * Module-level singleton promise prevents duplicate /users/me calls when
 * multiple components mount simultaneously. Crucially, it is reset to null
 * BEFORE each new login/logout so stale state can never block a fresh session.
 */
let _profilePromise: Promise<AuthUser> | null = null;

function resetProfilePromise() {
  _profilePromise = null;
}

async function fetchProfile(): Promise<AuthUser> {
  if (_profilePromise) return _profilePromise;

  _profilePromise = (async () => {
    try {
      const res = await fetchWithAuth(`${API}/users/me`);
      if (res.status === 401) {
        const err = new Error('401') as Error & { status: number };
        err.status = 401;
        throw err;
      }
      if (!res.ok) throw new Error(`profile_${res.status}`);
      return await res.json() as AuthUser;
    } finally {
      _profilePromise = null;
    }
  })();

  return _profilePromise;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // ── Session restore on mount ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // ── 1. Cross-app token handoff ────────────────────────────────────────
      // The auth app (localhost:3001) and web app (localhost:3000) live on
      // DIFFERENT origins, so localStorage is NOT shared between them.
      // On login, the auth app passes fresh tokens via URL ?at=&rt= params.
      // We must:
      //   a) ALWAYS clear any stale tokens first when new URL tokens arrive
      //   b) Save the new tokens to THIS origin's localStorage
      //   c) Strip them from the URL (security: no history leak)
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const urlAt = params.get('at');
        const urlRt = params.get('rt');

        if (urlAt) {
          // New login: wipe stale tokens from previous user/session FIRST
          // This is critical for multi-user scenarios (User A logs out,
          // User B logs in — we cannot let User A's stale tokens persist)
          authStorage.clear();
          resetProfilePromise(); // Reset singleton so old fetch doesn't block new login

          authStorage.setAccessToken(urlAt);
          if (urlRt) authStorage.setRefreshToken(urlRt);

          // Strip tokens from URL immediately — never expose in browser history
          params.delete('at');
          params.delete('rt');
          const clean = params.toString() ? `?${params.toString()}` : '';
          window.history.replaceState({}, '', window.location.pathname + clean + window.location.hash);
        }
      }

      // ── 2. Check if session exists ────────────────────────────────────────
      if (!authStorage.hasSession()) {
        if (!cancelled) setState({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
        return;
      }

      // ── 3. Load user profile (fetchWithAuth auto-refreshes expired AT) ────
      try {
        const user = await fetchProfile();
        if (user.avatar !== undefined) syncAvatarToStorage(user.avatar);
        const freshToken = authStorage.getAccessToken();
        if (!cancelled) setState({ user, accessToken: freshToken, isAuthenticated: true, isLoading: false });
      } catch (err: any) {
        if (!cancelled) {
          const is401 = err?.status === 401 || err?.message === '401';
          if (is401) {
            // Refresh token also expired/revoked — hard logout
            authStorage.clear();
            setState({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
          } else {
            // Transient (5xx, 429, offline) — keep user logged in, profile unavailable temporarily
            console.warn('[useAuth] Transient profile error, keeping session:', err?.message);
            setState({ user: null, accessToken: authStorage.getAccessToken(), isAuthenticated: true, isLoading: false });
          }
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ── Login ────────────────────────────────────────────────────────────────
  // NOTE: This login() is called from the AUTH APP (localhost:3001),
  // not from the web app. The web app receives tokens via URL params above.
  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json() as { accessToken?: string; refreshToken?: string; message?: string };

    if (!res.ok) {
      const s = res.status;
      if (s === 401 || s === 403) throw new Error('Incorrect email or password.');
      if (s === 429) throw new Error('Too many attempts. Please wait a moment and try again.');
      if (s >= 500) throw new Error('Server error. Please try again in a few seconds.');
      throw new Error(data.message ?? 'Sign in failed. Please try again.');
    }

    const { accessToken, refreshToken } = data;
    if (!accessToken) throw new Error('Sign in failed. Please try again.');

    return { accessToken, refreshToken: refreshToken ?? '' };
  }, []);

  // ── Register ─────────────────────────────────────────────────────────────
  const register = useCallback(async (email: string, password: string, name?: string) => {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await res.json() as { accessToken?: string; refreshToken?: string; message?: string };

    if (!res.ok) {
      const s = res.status;
      if (s === 409) throw new Error('An account with this email already exists.');
      if (s === 429) throw new Error('Too many attempts. Please wait a moment and try again.');
      if (s >= 500) throw new Error('Server error. Please try again in a few seconds.');
      throw new Error(data.message ?? 'Registration failed. Please try again.');
    }

    const { accessToken, refreshToken } = data;
    if (!accessToken) throw new Error('Registration failed. Please try again.');

    return { accessToken, refreshToken: refreshToken ?? '' };
  }, []);

  // ── Logout ───────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    resetProfilePromise(); // Prevent stale singleton from blocking next login
    authStorage.clear();
    setState({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
  }, []);

  const logoutWithTransition = useCallback(() => {
    const authUrl = process.env.NEXT_PUBLIC_AUTH_URL ?? 'http://localhost:3001';
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('show-logout-transition'));
      setTimeout(() => {
        logout();
        window.location.href = `${authUrl}/login`;
      }, 1200);
    } else {
      logout();
    }
  }, [logout]);

  // ── Get CLI command ───────────────────────────────────────────────────────
  const getCliCommand = useCallback(async () => {
    const res = await fetchWithAuth(`${API}/users/me/command`);
    if (!res.ok) throw new Error('Failed to fetch CLI command');
    return res.json() as Promise<{ command: string; token: string; instructions: string }>;
  }, []);

  return { ...state, login, register, logout, logoutWithTransition, getCliCommand };
}
