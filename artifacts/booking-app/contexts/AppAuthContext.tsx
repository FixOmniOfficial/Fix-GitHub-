import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@probook_user_v1';
const GOOGLE_MAP_KEY = '@probook_google_map_v1'; // email → uniqueCode mapping

export type AppUser = {
  userType: 'customer' | 'technician';
  uniqueCode: string;
  name: string;
  phone?: string;
  email?: string;
  avatar?: string;      // Google profile picture URL
  loginMethod?: 'code' | 'google' | 'password';
  professionalId?: number;
  professionType?: string;
  /** Set to true when technician logs in with a temp passcode — forces password change */
  requirePasswordChange?: boolean;
};

type AppAuthCtx = {
  user: AppUser | null;
  loading: boolean;
  login: (user: AppUser) => Promise<void>;
  logout: () => Promise<void>;
  /** Patch fields on the current user (persists to AsyncStorage) */
  updateUser: (patch: Partial<AppUser>) => Promise<void>;
  /** Look up uniqueCode from Google email (for repeat sign-ins) */
  getCodeByEmail: (email: string) => Promise<string | null>;
  /** Save email → uniqueCode mapping */
  saveEmailMapping: (email: string, code: string) => Promise<void>;
};

const AppAuthContext = createContext<AppAuthCtx>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  updateUser: async () => {},
  getCodeByEmail: async () => null,
  saveEmailMapping: async () => {},
});

export function AppAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  // Ref so login() can always read the current user without stale closure
  const userRef = React.useRef<AppUser | null>(null);
  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val) {
        try { setUser(JSON.parse(val)); } catch {}
      }
      setLoading(false);
    });
  }, []);

  const login = useCallback(async (u: AppUser) => {
    // Preserve locally-edited avatar/name if the API response doesn't include them
    const prev = userRef.current;
    const sameUser = prev?.uniqueCode === u.uniqueCode && prev?.userType === u.userType;
    const merged: AppUser = sameUser
      ? { ...u, avatar: u.avatar ?? prev?.avatar, name: u.name || prev?.name || u.name }
      : u;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    setUser(merged);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  const updateUser = useCallback(async (patch: Partial<AppUser>) => {
    setUser(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const getCodeByEmail = useCallback(async (email: string): Promise<string | null> => {
    try {
      const raw = await AsyncStorage.getItem(GOOGLE_MAP_KEY);
      if (!raw) return null;
      const map: Record<string, string> = JSON.parse(raw);
      return map[email.toLowerCase()] ?? null;
    } catch {
      return null;
    }
  }, []);

  const saveEmailMapping = useCallback(async (email: string, code: string) => {
    try {
      const raw = await AsyncStorage.getItem(GOOGLE_MAP_KEY);
      const map: Record<string, string> = raw ? JSON.parse(raw) : {};
      map[email.toLowerCase()] = code;
      await AsyncStorage.setItem(GOOGLE_MAP_KEY, JSON.stringify(map));
    } catch {}
  }, []);

  return (
    <AppAuthContext.Provider value={{ user, loading, login, logout, updateUser, getCodeByEmail, saveEmailMapping }}>
      {children}
    </AppAuthContext.Provider>
  );
}

export function useAppAuth() {
  return useContext(AppAuthContext);
}
