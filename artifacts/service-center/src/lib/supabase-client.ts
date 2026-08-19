import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';

let _client: SupabaseClient | null = null;

function normalizeSupabaseUrl(value: string): string {
  try {
    const url = new URL(value);
    url.pathname = url.pathname.replace(/\/(?:rest\/v1|auth\/v1)\/?$/, '');
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return value.replace(/\/(?:rest\/v1|auth\/v1)\/?$/, '');
  }
}

/**
 * Returns a cached Supabase client.  If VITE env vars are present they are
 * used directly; otherwise the runtime config endpoint is consulted once and
 * the result is cached for the lifetime of the page.
 */
export async function getSupabaseClient(): Promise<SupabaseClient> {
  if (_client) return _client;

  const viteUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const viteKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (viteUrl && viteKey) {
    _client = createClient(normalizeSupabaseUrl(viteUrl), viteKey);
    return _client;
  }

  // Fallback: fetch from the runtime config endpoint
  const resp = await fetch(`${BASE}/api/auth/config`);
  if (!resp.ok) throw new Error('Supabase configuration is unavailable.');
  const config = (await resp.json()) as { url: string; anonKey: string };
  _client = createClient(normalizeSupabaseUrl(config.url), config.anonKey);
  return _client;
}

/**
 * Synchronously returns the cached client (throws if not yet initialised).
 * Use getSupabaseClient() for the first call.
 */
export function getSupabaseClientSync(): SupabaseClient {
  if (!_client) throw new Error('Supabase client is not yet initialised. Await getSupabaseClient() first.');
  return _client;
}
