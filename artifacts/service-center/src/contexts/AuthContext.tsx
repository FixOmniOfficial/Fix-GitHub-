import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase-client';
import { setAuthTokenGetter } from '@workspace/api-client-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MeUser {
  id: string;
  email: string | null;
  name: string;
  role: string;
  permissions: string[];
  userType: string;
  appUserId: number | null;
}

export interface AuthContextValue {
  /** Supabase session (null = signed out, undefined = loading) */
  session: Session | null | undefined;
  /** Supabase user object */
  supabaseUser: User | null;
  /** Application-level user from /api/auth/me */
  meUser: MeUser | null;
  /** True while the initial session check is in flight */
  isLoading: boolean;
  /** True once session check has completed */
  isLoaded: boolean;
  /** True when a valid session exists */
  isSignedIn: boolean;
  /** Sign in with email/password */
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  /** Sign out */
  signOut: () => Promise<void>;
  /** Force-reload /api/auth/me (e.g. after role change) */
  refreshMe: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null);

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [meUser, setMeUser] = useState<MeUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Keep a stable getter reference for setAuthTokenGetter
  const sessionRef = useRef<Session | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch /api/auth/me
  // ---------------------------------------------------------------------------
  const fetchMe = useCallback(async (accessToken: string) => {
    try {
      const r = await fetch(`${BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!r.ok) { setMeUser(null); return; }
      const data = (await r.json()) as { user: MeUser };
      setMeUser(data.user ?? null);
    } catch {
      setMeUser(null);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const sb = await getSupabaseClient();

      // Register token getter for api-client-react's customFetch
      setAuthTokenGetter(async () => {
        const s = sessionRef.current;
        if (!s) return null;
        // Refresh if within 60 s of expiry
        const expiresAt = s.expires_at ?? 0;
        if (Date.now() / 1000 >= expiresAt - 60) {
          const { data } = await sb.auth.refreshSession();
          if (data.session) {
            sessionRef.current = data.session;
            return data.session.access_token;
          }
          return null;
        }
        return s.access_token;
      });

      // Get current session from storage
      const { data: { session: initial } } = await sb.auth.getSession();
      if (cancelled) return;

      sessionRef.current = initial ?? null;
      setSession(initial ?? null);
      setSupabaseUser(initial?.user ?? null);

      if (initial?.access_token) {
        await fetchMe(initial.access_token);
      }

      if (!cancelled) setIsLoading(false);

      // Listen for auth state changes
      const { data: { subscription } } = sb.auth.onAuthStateChange(async (_event, newSession) => {
        if (cancelled) return;
        sessionRef.current = newSession ?? null;
        setSession(newSession ?? null);
        setSupabaseUser(newSession?.user ?? null);

        if (newSession?.access_token) {
          await fetchMe(newSession.access_token);
        } else {
          setMeUser(null);
        }
        setIsLoading(false);
      });

      return () => {
        subscription.unsubscribe();
      };
    }

    const cleanup = bootstrap();
    return () => {
      cancelled = true;
      cleanup.then(fn => fn?.());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  const signIn = useCallback(async (email: string, password: string) => {
    const sb = await getSupabaseClient();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    const sb = await getSupabaseClient();
    await sb.auth.signOut();
    // State is updated by the onAuthStateChange listener above
  }, []);

  const refreshMe = useCallback(async () => {
    const token = sessionRef.current?.access_token;
    if (token) await fetchMe(token);
  }, [fetchMe]);

  const isLoaded = !isLoading;
  const isSignedIn = !!session && session !== null && session !== undefined;

  const value: AuthContextValue = {
    session: session,
    supabaseUser,
    meUser,
    isLoading,
    isLoaded,
    isSignedIn,
    signIn,
    signOut,
    refreshMe,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used inside <AuthProvider>');
  return ctx;
}
