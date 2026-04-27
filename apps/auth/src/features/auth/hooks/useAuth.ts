import { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth, ensureValidToken, authStorage } from '@/lib/fetchWithAuth';

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

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // ── On mount: restore session from sessionStorage (per-tab) ───────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // ensureValidToken reads from sessionStorage — empty in a new tab
      const validToken = await ensureValidToken();

      if (!validToken) {
        if (!cancelled) {
          setState({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
        }
        return;
      }

      try {
        const res = await fetch(`${API}/users/me`, {
          headers: { Authorization: `Bearer ${validToken}` },
        });
        if (!res.ok) throw new Error('Failed to load profile');
        const user = await res.json() as AuthUser;
        if (!cancelled) {
          setState({ user, accessToken: validToken, isAuthenticated: true, isLoading: false });
        }
      } catch {
        if (!cancelled) {
          authStorage.clear();
          setState({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
        }
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ── Login ──────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json() as {
      accessToken?: string;
      refreshToken?: string;
      message?: string;
      statusCode?: number;
    };

    if (!res.ok) {
      // Map backend error codes to human-friendly messages
      const status = res.status;
      if (status === 401 || status === 403) throw new Error('Incorrect email or password.');
      if (status === 429) throw new Error('Too many attempts. Please wait a moment and try again.');
      if (status >= 500) throw new Error('Server error. Please try again in a few seconds.');
      throw new Error(data.message ?? 'Sign in failed. Please try again.');
    }

    const accessToken = data.accessToken;
    const refreshToken = data.refreshToken;
    if (!accessToken) throw new Error('Sign in failed. Please try again.');

    // Do NOT store tokens in auth app's localStorage (localhost:3001).
    // The web app (localhost:3000) has a SEPARATE localStorage — it cannot
    // read ours. Tokens are passed via URL params on redirect instead.
    return { accessToken, refreshToken: refreshToken ?? '' };
  }, []);

  // ── Register ───────────────────────────────────────────────────────────
  const register = useCallback(async (email: string, password: string, name?: string) => {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await res.json() as {
      accessToken?: string;
      refreshToken?: string;
      message?: string;
    };
    if (!res.ok) throw new Error(data.message ?? 'Registration failed');

    const accessToken = data.accessToken;
    const refreshToken = data.refreshToken;
    if (!accessToken) throw new Error('Server did not return an access token');

    authStorage.setAccessToken(accessToken);
    if (refreshToken) authStorage.setRefreshToken(refreshToken);

    const userRes = await fetchWithAuth(`${API}/users/me`);
    if (!userRes.ok) throw new Error('Failed to load user profile after registration');
    const user = await userRes.json() as AuthUser;

    setState({ user, accessToken, isAuthenticated: true, isLoading: false });
    return user;
  }, []);

  // ── Logout ─────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    authStorage.clear();
    setState({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
  }, []);

  const logoutWithTransition = useCallback((router: { push: (url: string) => void }) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('show-logout-transition'));
      setTimeout(() => {
        logout();
        router.push('/');
      }, 1200); // Wait for the animation to play
    } else {
      logout();
      router.push('/');
    }
  }, [logout]);

  // ── Get CLI command (uses auto-refresh) ───────────────────────────────
  const getCliCommand = useCallback(async () => {
    const res = await fetchWithAuth(`${API}/users/me/command`);
    if (!res.ok) throw new Error('Failed to fetch CLI command');
    return res.json() as Promise<{ command: string; token: string; instructions: string }>;
  }, []);

  return { ...state, login, register, logout, logoutWithTransition, getCliCommand };
}
