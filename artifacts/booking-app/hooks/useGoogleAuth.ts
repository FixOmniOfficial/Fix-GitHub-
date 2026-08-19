/**
 * Google Sign-In hook via Supabase OAuth PKCE.
 *
 * Uses Supabase's `signInWithOAuth` which handles the PKCE code-exchange
 * internally and stores the resulting session in expo-secure-store via the
 * custom adapter in lib/supabase.ts.
 *
 * Falls back gracefully when Supabase is not yet configured (no error thrown —
 * `isConfigured` will be false and `promptAsync` is a no-op).
 */
import { useEffect, useRef, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { getSupabaseConfig, getSupabaseClient } from '@/lib/supabase';
import { type SupabaseClient, type Session } from '@supabase/supabase-js';

// Required for expo-web-browser OAuth redirect completion on native
WebBrowser.maybeCompleteAuthSession();

export type GoogleUser = {
  email: string;
  name: string;
  picture?: string;
  sub: string; // Supabase user id
};

export function useGoogleAuth(onSuccess: (user: GoogleUser) => void) {
  const [isConfigured, setIsConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const clientRef = useRef<SupabaseClient | null>(null);

  // Resolve config and build client once on mount
  useEffect(() => {
    getSupabaseConfig().then((config) => {
      if (config) {
        clientRef.current = getSupabaseClient(config);
        setIsConfigured(true);
      }
    });
  }, []);

  // Listen for the deep-link callback that completes the OAuth exchange
  useEffect(() => {
    if (!isConfigured) return;

    const handleUrl = async (event: { url: string }) => {
      const client = clientRef.current;
      if (!client) return;
      // Let Supabase parse the URL and complete the PKCE exchange
      const { data, error } = await client.auth.exchangeCodeForSession(event.url);
      if (error || !data.session) return;
      buildGoogleUser(data.session, onSuccess);
    };

    const subscription = Linking.addEventListener('url', handleUrl);
    return () => subscription.remove();
  }, [isConfigured, onSuccess]);

  const promptAsync = async () => {
    const client = clientRef.current;
    if (!client || !isConfigured) return;
    setLoading(true);
    try {
      const redirectTo = Linking.createURL('auth/callback');
      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true, // we open the browser ourselves
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });
      if (error || !data.url) {
        console.warn('[useGoogleAuth] OAuth initiation failed', error?.message);
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success' && result.url) {
        const parsed = new URL(result.url);
        const code = parsed.searchParams.get('code');
        if (code) {
          const { data: sessionData, error: sessionError } =
            await client.auth.exchangeCodeForSession(result.url);
          if (!sessionError && sessionData.session) {
            buildGoogleUser(sessionData.session, onSuccess);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return { promptAsync, isConfigured, loading };
}

// ── Helper ─────────────────────────────────────────────────────────────────

function buildGoogleUser(session: Session, onSuccess: (user: GoogleUser) => void) {
  const { user } = session;
  const meta = user.user_metadata ?? {};
  const googleUser: GoogleUser = {
    email: user.email ?? meta.email ?? '',
    name: meta.full_name ?? meta.name ?? user.email ?? '',
    picture: meta.avatar_url ?? meta.picture ?? undefined,
    sub: user.id,
  };
  if (googleUser.email) onSuccess(googleUser);
}
