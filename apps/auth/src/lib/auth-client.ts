import { createAuthClient } from 'better-auth/react';
import { twoFactorClient, emailOTPClient } from 'better-auth/client/plugins';

/**
 * BetterAuth client instance for the auth app (apps/auth).
 *
 * The baseURL points to the NestJS backend at /api/v1/auth/better
 * All auth operations (sign-in, sign-up, OAuth, 2FA, etc.) go through here.
 */
export const authClient = createAuthClient({
  // NEXT_PUBLIC_API_URL = http://localhost:4000/api/v1
  // BetterAuth is mounted at /api/v1/auth/better on the backend
  // So we only append /auth/better — NOT /api/v1/auth/better
  baseURL: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'}/auth/better`,

  plugins: [
    twoFactorClient({
      twoFactorPage: '/2fa', // redirect here when 2FA is required
    }),
    emailOTPClient(),
  ],
});

// Named exports for convenience (tree-shakeable)
export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  forgetPassword,
  resetPassword,
  sendVerificationEmail,
  verifyEmail,
  twoFactor,
  emailOtp,
} = authClient;
