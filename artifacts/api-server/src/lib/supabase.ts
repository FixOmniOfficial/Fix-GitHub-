import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured for the API server.",
  );
}

/**
 * Service-role admin client.  Used for privileged operations: creating users,
 * reading auth.users, etc.  Never exposed to end-users.
 */
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

/**
 * Anon-key client.  Used ONLY to call signInWithPassword() after the server
 * has already validated credentials against the domain tables, so that we can
 * return a proper Supabase session (access_token + refresh_token) to the
 * mobile caller without the caller ever talking to Supabase directly.
 *
 * This client is only available when SUPABASE_ANON_KEY is configured; callers
 * must check for null before use.
 */
export const supabaseAnon: ReturnType<typeof createClient> | null =
  anonKey && supabaseUrl
    ? createClient(supabaseUrl, anonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      })
    : null;

export type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

/**
 * Sign in via the anon client and return a serialisable session object.
 * Returns null if SUPABASE_ANON_KEY is not configured or sign-in fails.
 */
export async function signInAndGetSession(
  email: string,
  password: string,
): Promise<SupabaseSession | null> {
  if (!supabaseAnon) return null;
  const { data, error } = await supabaseAnon.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session) return null;
  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
  };
}
