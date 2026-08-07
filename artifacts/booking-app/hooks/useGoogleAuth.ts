/**
 * Google Sign-In hook using expo-auth-session.
 *
 * Requires EXPO_PUBLIC_GOOGLE_CLIENT_ID to be set.
 * In Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID (Web).
 * Add your Replit dev domain as an authorised redirect URI.
 */
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';

// Required for web OAuth redirect handling
WebBrowser.maybeCompleteAuthSession();

export type GoogleUser = {
  email: string;
  name: string;
  picture?: string;
  sub: string; // Google user ID
};

export function useGoogleAuth(onSuccess: (user: GoogleUser) => void) {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: clientId ?? 'NOT_CONFIGURED',
    webClientId: clientId ?? 'NOT_CONFIGURED',
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      if (authentication?.accessToken) {
        // Fetch user info from Google
        fetch(`https://www.googleapis.com/oauth2/v3/userinfo`, {
          headers: { Authorization: `Bearer ${authentication.accessToken}` },
        })
          .then((r) => r.json())
          .then((data: GoogleUser) => onSuccess(data))
          .catch(console.error);
      }
    }
  }, [response]);

  const isConfigured = Boolean(clientId && clientId.length > 10);

  return {
    request,
    promptAsync,
    isConfigured,
  };
}
