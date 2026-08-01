import { useCallback, useEffect, useState } from 'react';

export interface AppUser {
  id: number;
  name: string;
  username: string | null;
  email: string | null;
  phone: string | null;
  role: string;
}

interface AuthState {
  user: AppUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refetch: () => void;
}

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';

export function useAuth(): AuthState {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetch(`${BASE}/api/auth/user`, { credentials: 'include' })
      .then(r => r.json())
      .then((data: { user: AppUser | null }) => {
        if (!cancelled) { setUser(data.user ?? null); setIsLoading(false); }
      })
      .catch(() => { if (!cancelled) { setUser(null); setIsLoading(false); } });
    return () => { cancelled = true; };
  }, [tick]);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  return { user, isLoading, isAuthenticated: !!user, refetch };
}

// Standalone API calls
export const authApi = {
  login: (login: string, password: string) =>
    fetch(`${BASE}/api/auth/login`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password }),
    }).then(r => r.json()),

  logout: () =>
    fetch(`${BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' })
      .then(r => r.json()),

  sendOtp: (login: string) =>
    fetch(`${BASE}/api/auth/send-otp`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login }),
    }).then(r => r.json()),

  verifyOtp: (userId: number, otp: string) =>
    fetch(`${BASE}/api/auth/verify-otp`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, otp }),
    }).then(r => r.json()),

  resetPassword: (userId: number, newPassword: string) =>
    fetch(`${BASE}/api/auth/reset-password`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, newPassword }),
    }).then(r => r.json()),
};
