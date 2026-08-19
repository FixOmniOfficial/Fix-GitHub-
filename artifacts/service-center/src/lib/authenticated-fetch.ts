/**
 * authenticated-fetch.ts
 *
 * A thin wrapper around `fetch` that automatically injects the current
 * Supabase Bearer token into the `Authorization` header.
 *
 * Usage:
 *   import { authenticatedFetch } from '@/lib/authenticated-fetch';
 *   const r = await authenticatedFetch('/api/admin/users');
 *   const r = await authenticatedFetch('/api/admin/users/123/role', {
 *     method: 'PATCH',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ role }),
 *   });
 */

import { getSupabaseClient } from '@/lib/supabase-client';

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';

/**
 * Returns the active Supabase access_token, or null if the user is not signed in.
 * Automatically refreshes the session if it is close to expiry.
 */
async function getAccessToken(): Promise<string | null> {
  try {
    const sb = await getSupabaseClient();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;

    // Refresh if within 60 seconds of expiry
    const expiresAt = session.expires_at ?? 0;
    if (Date.now() / 1000 >= expiresAt - 60) {
      const { data } = await sb.auth.refreshSession();
      return data.session?.access_token ?? null;
    }

    return session.access_token;
  } catch {
    return null;
  }
}

/**
 * Fetch wrapper that prepends BASE_URL to relative paths and injects a
 * Supabase Bearer token into every request.
 *
 * - Relative paths (starting with `/api`) are automatically prefixed with BASE.
 * - The caller's headers are merged safely — existing `Authorization` values
 *   are overwritten with the live token.
 * - `credentials: 'include'` is deliberately removed; auth is via Bearer token.
 */
export async function authenticatedFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getAccessToken();

  // Build merged headers
  const existingHeaders = new Headers(init.headers as HeadersInit | undefined);
  if (token) {
    existingHeaders.set('Authorization', `Bearer ${token}`);
  }

  // Resolve URL — prepend BASE for relative /api paths
  const url = path.startsWith('/') ? `${BASE}${path}` : path;

  // Strip credentials:include (legacy) and replace with Bearer
  const { credentials: _removed, ...restInit } = init as RequestInit & { credentials?: unknown };

  return fetch(url, {
    ...restInit,
    headers: existingHeaders,
  });
}
