/**
 * @deprecated — DO NOT USE THIS FILE.
 *
 * This file is dead code left over from an earlier architecture.
 * It writes tokens directly to sessionStorage using raw key names,
 * bypassing `authStorage` from `fetchWithAuth.ts`.
 *
 * All auth operations (login, register, logout, token refresh) are handled
 * exclusively through the `useAuth` hook:
 *
 *   import { useAuth } from '@/features/auth/hooks/useAuth';
 *
 * This file exists only to avoid breaking any accidental imports.
 * It will be removed in a future cleanup.
 */

export {};
