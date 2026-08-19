/**
 * useAuth — thin compatibility shim over AuthContext.
 *
 * Existing callers that imported useAuth / AppUser / authApi continue to work.
 * Cookie-based login/logout functions are stubs that delegate to Supabase now
 * (signIn / signOut are on the context; OTP/reset paths go via the API).
 */
import { useAuthContext, type MeUser } from '@/contexts/AuthContext';
import { authenticatedFetch } from '@/lib/authenticated-fetch';

export type AppUser = MeUser;

export interface AuthState {
  user: AppUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refetch: () => void;
}

export function useAuth(): AuthState {
  const { meUser, isLoading, isSignedIn, refreshMe } = useAuthContext();
  return {
    user: meUser,
    isLoading,
    isAuthenticated: isSignedIn,
    refetch: refreshMe,
  };
}

// ---------------------------------------------------------------------------
// Standalone API calls (kept for any pages that still import authApi)
// ---------------------------------------------------------------------------
export const authApi = {
  /** Deprecated: sign-in now goes through Supabase directly via AuthContext.signIn */
  login: (_login: string, _password: string): Promise<unknown> =>
    Promise.reject(new Error('Use AuthContext.signIn instead of authApi.login')),

  logout: () =>
    authenticatedFetch('/api/auth/logout', { method: 'POST' })
      .then(r => r.json()),

  sendOtp: (login: string) =>
    authenticatedFetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login }),
    }).then(r => r.json()),

  verifyOtp: (userId: number, otp: string) =>
    authenticatedFetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, otp }),
    }).then(r => r.json()),

  resetPassword: (userId: number, newPassword: string) =>
    authenticatedFetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, newPassword }),
    }).then(r => r.json()),

  sendPasswordReset: (email: string, redirectTo?: string) =>
    authenticatedFetch('/api/auth/send-password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, redirectTo }),
    }).then(r => r.json()),
};
