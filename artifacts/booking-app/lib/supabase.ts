/**
 * Supabase client for the booking app.
 *
 * Session storage: expo-secure-store (encrypted on-device, not AsyncStorage).
 * Config: reads EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY first;
 *         if absent, fetches /api/auth/config from the API server at runtime.
 */
import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// ── SecureStore adapter (required by supabase-js for React Native) ─────────

const MAX_SECURE_STORE_VALUE_LENGTH = 2048;

/**
 * Large session tokens exceed SecureStore's 2 KB limit on some devices.
 * We chunk them with an index-based key scheme.
 */
const SecureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try { return localStorage.getItem(key); } catch { return null; }
    }
    // Try chunked first, fall back to direct
    const chunk0 = await SecureStore.getItemAsync(`${key}.0`).catch(() => null);
    if (chunk0 !== null) {
      const parts: string[] = [chunk0];
      let i = 1;
      while (true) {
        const part = await SecureStore.getItemAsync(`${key}.${i}`).catch(() => null);
        if (part === null) break;
        parts.push(part);
        i++;
      }
      return parts.join('');
    }
    return SecureStore.getItemAsync(key).catch(() => null);
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { localStorage.setItem(key, value); } catch {}
      return;
    }
    if (value.length <= MAX_SECURE_STORE_VALUE_LENGTH) {
      await SecureStore.setItemAsync(key, value);
      // Clear any old chunks
      await SecureStore.deleteItemAsync(`${key}.0`).catch(() => {});
      return;
    }
    // Chunk large values
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += MAX_SECURE_STORE_VALUE_LENGTH) {
      chunks.push(value.slice(i, i + MAX_SECURE_STORE_VALUE_LENGTH));
    }
    await Promise.all(chunks.map((chunk, i) => SecureStore.setItemAsync(`${key}.${i}`, chunk)));
    // Remove old direct key
    await SecureStore.deleteItemAsync(key).catch(() => {});
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try { localStorage.removeItem(key); } catch {}
      return;
    }
    await SecureStore.deleteItemAsync(key).catch(() => {});
    let i = 0;
    while (true) {
      const existed = await SecureStore.getItemAsync(`${key}.${i}`).catch(() => null);
      if (existed === null) break;
      await SecureStore.deleteItemAsync(`${key}.${i}`).catch(() => {});
      i++;
    }
  },
};

// ── Config resolution ──────────────────────────────────────────────────────

export type SupabaseConfig = { url: string; anonKey: string };

let _cachedConfig: SupabaseConfig | null = null;
let _configFetchPromise: Promise<SupabaseConfig | null> | null = null;

/** Fetch Supabase public config from the API server. */
async function fetchConfigFromApi(apiBase: string): Promise<SupabaseConfig | null> {
  try {
    const r = await fetch(`${apiBase}/api/auth/config`);
    if (!r.ok) return null;
    const data = await r.json() as { url?: string; anonKey?: string };
    if (data?.url && data?.anonKey) return { url: data.url, anonKey: data.anonKey };
    return null;
  } catch {
    return null;
  }
}

export async function getSupabaseConfig(): Promise<SupabaseConfig | null> {
  // 1. EXPO_PUBLIC_ vars baked in at build time
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (url && anonKey) return { url, anonKey };

  // 2. Already resolved
  if (_cachedConfig) return _cachedConfig;

  // 3. Deduplicated fetch
  if (!_configFetchPromise) {
    const apiBase = process.env.EXPO_PUBLIC_API_URL
      ?? (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : '');
    _configFetchPromise = fetchConfigFromApi(apiBase).then((cfg) => {
      if (cfg) _cachedConfig = cfg;
      return cfg;
    });
  }
  return _configFetchPromise;
}

// ── Singleton client ───────────────────────────────────────────────────────

let _client: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase client.
 * Must be called after `getSupabaseConfig()` resolves.
 */
export function getSupabaseClient(config: SupabaseConfig): SupabaseClient {
  if (_client) return _client;
  _client = createClient(config.url, config.anonKey, {
    auth: {
      storage: SecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return _client;
}

/**
 * Get the current Supabase session's access token, if any.
 * Returns null when the user is not authenticated via Supabase.
 */
export async function getSupabaseAccessToken(): Promise<string | null> {
  if (!_client) return null;
  try {
    const { data } = await _client.auth.getSession();
    return data?.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export type { Session };
