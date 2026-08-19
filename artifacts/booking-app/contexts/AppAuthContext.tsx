import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import {
  getSupabaseConfig,
  getSupabaseClient,
  getSupabaseAccessToken,
  type SupabaseConfig,
  type Session,
} from '@/lib/supabase';
import { type SupabaseClient } from '@supabase/supabase-js';

// ── Secure storage helpers (web fallback to localStorage) ─────────────────

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  return SecureStore.getItemAsync(key).catch(() => null);
}

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try { localStorage.setItem(key, value); } catch {}
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function secureRemove(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try { localStorage.removeItem(key); } catch {}
    return;
  }
  await SecureStore.deleteItemAsync(key).catch(() => {});
}

const STORAGE_KEY    = 'probook_user_v2';      // v2 = SecureStore (was @probook_user_v1 in AsyncStorage)
const GOOGLE_MAP_KEY = 'probook_google_map_v2'; // email → uniqueCode mapping

export type AppUser = {
  userType: 'customer' | 'technician';
  uniqueCode: string;
  name: string;
  phone?: string;
  email?: string;
  avatar?: string;      // Google profile picture URL
  loginMethod?: 'code' | 'google' | 'password' | 'supabase_oauth';
  professionalId?: number;
  professionType?: string;
  /** Set to true when technician logs in with a temp passcode — forces password change */
  requirePasswordChange?: boolean;
};

/** Serialised session returned by the API after login/register */
export type ApiSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

type AppAuthCtx = {
  user: AppUser | null;
  loading: boolean;
  /** Supabase session (present only for OAuth / Supabase-auth sign-ins) */
  supabaseSession: Session | null;
  /** Supabase client, once config is resolved */
  supabase: SupabaseClient | null;
  login: (user: AppUser) => Promise<void>;
  /**
   * Apply a Supabase session token-pair returned by the API after
   * password login/register, so Bearer auth works for subsequent calls.
   */
  applyApiSession: (session: ApiSession) => Promise<void>;
  logout: () => Promise<void>;
  /** Patch fields on the current user (persists to SecureStore) */
  updateUser: (patch: Partial<AppUser>) => Promise<void>;
  /** Look up uniqueCode from Google email (for repeat sign-ins) */
  getCodeByEmail: (email: string) => Promise<string | null>;
  /** Save email → uniqueCode mapping */
  saveEmailMapping: (email: string, code: string) => Promise<void>;
  /** Returns the Supabase access token, or null if not using Supabase auth */
  getAccessToken: () => Promise<string | null>;
};

const AppAuthContext = createContext<AppAuthCtx>({
  user: null,
  loading: true,
  supabaseSession: null,
  supabase: null,
  login: async () => {},
  applyApiSession: async () => {},
  logout: async () => {},
  updateUser: async () => {},
  getCodeByEmail: async () => null,
  saveEmailMapping: async () => {},
  getAccessToken: async () => null,
});

export function AppAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]                       = useState<AppUser | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [supabaseSession, setSupabaseSession] = useState<Session | null>(null);
  const [supabase, setSupabase]               = useState<SupabaseClient | null>(null);

  // Ref so login() can always read the current user without stale closure
  const userRef = useRef<AppUser | null>(null);
  useEffect(() => { userRef.current = user; }, [user]);

  // ── Bootstrap: load persisted AppUser + init Supabase client ────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // 1. Restore persisted AppUser from SecureStore
      const stored = await secureGet(STORAGE_KEY);
      if (stored && !cancelled) {
        try { setUser(JSON.parse(stored)); } catch {}
      }

      // 2. Initialize Supabase client (non-blocking — config may need a network call)
      try {
        const config: SupabaseConfig | null = await getSupabaseConfig();
        if (config && !cancelled) {
          const client = getSupabaseClient(config);
          setSupabase(client);

          // Restore existing session
          const { data } = await client.auth.getSession();
          if (data?.session && !cancelled) setSupabaseSession(data.session);

          // Listen for auth state changes
          const { data: { subscription } } = client.auth.onAuthStateChange(
            (_event, session) => {
              if (!cancelled) setSupabaseSession(session);
            },
          );

          return () => subscription.unsubscribe();
        }
      } catch {
        // Supabase not configured — continue without it
      }

      if (!cancelled) setLoading(false);
    }

    const cleanup = init().then((unsubscribe) => {
      if (!cancelled) setLoading(false);
      return unsubscribe;
    });

    return () => {
      cancelled = true;
      cleanup.then((unsubscribe) => unsubscribe?.());
    };
  }, []);

  // ── login: persist AppUser to SecureStore ────────────────────────────────
  const login = useCallback(async (u: AppUser) => {
    // Preserve locally-edited avatar/name if the API response doesn't include them
    const prev = userRef.current;
    const sameUser = prev?.uniqueCode === u.uniqueCode && prev?.userType === u.userType;
    const merged: AppUser = sameUser
      ? { ...u, avatar: u.avatar ?? prev?.avatar, name: u.name || prev?.name || u.name }
      : u;
    await secureSet(STORAGE_KEY, JSON.stringify(merged));
    setUser(merged);
  }, []);

  // ── applyApiSession: hydrate the Supabase client from a server-issued session
  const applyApiSession = useCallback(async (apiSession: ApiSession) => {
    if (!supabase) return;
    try {
      await supabase.auth.setSession({
        access_token: apiSession.access_token,
        refresh_token: apiSession.refresh_token,
      });
      // onAuthStateChange listener will update supabaseSession state
    } catch {
      // Non-fatal — app still works, Bearer token just won't be sent
    }
  }, [supabase]);

  // ── logout: clear SecureStore + Supabase session ─────────────────────────
  const logout = useCallback(async () => {
    await secureRemove(STORAGE_KEY);
    setUser(null);
    // Sign out from Supabase if a session exists
    if (supabase && supabaseSession) {
      try { await supabase.auth.signOut(); } catch {}
    }
  }, [supabase, supabaseSession]);

  // ── updateUser: patch + persist ──────────────────────────────────────────
  const updateUser = useCallback(async (patch: Partial<AppUser>) => {
    setUser(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      secureSet(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // ── getCodeByEmail: email → uniqueCode map (SecureStore) ─────────────────
  const getCodeByEmail = useCallback(async (email: string): Promise<string | null> => {
    try {
      const raw = await secureGet(GOOGLE_MAP_KEY);
      if (!raw) return null;
      const map: Record<string, string> = JSON.parse(raw);
      return map[email.toLowerCase()] ?? null;
    } catch {
      return null;
    }
  }, []);

  // ── saveEmailMapping ──────────────────────────────────────────────────────
  const saveEmailMapping = useCallback(async (email: string, code: string) => {
    try {
      const raw = await secureGet(GOOGLE_MAP_KEY);
      const map: Record<string, string> = raw ? JSON.parse(raw) : {};
      map[email.toLowerCase()] = code;
      await secureSet(GOOGLE_MAP_KEY, JSON.stringify(map));
    } catch {}
  }, []);

  // ── getAccessToken: returns Supabase JWT when available ──────────────────
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    return getSupabaseAccessToken();
  }, []);

  return (
    <AppAuthContext.Provider
      value={{
        user,
        loading,
        supabaseSession,
        supabase,
        login,
        applyApiSession,
        logout,
        updateUser,
        getCodeByEmail,
        saveEmailMapping,
        getAccessToken,
      }}
    >
      {children}
    </AppAuthContext.Provider>
  );
}

export function useAppAuth() {
  return useContext(AppAuthContext);
}
