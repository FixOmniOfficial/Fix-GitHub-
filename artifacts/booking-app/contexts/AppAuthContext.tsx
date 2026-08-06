import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@probook_user_v1';

export type AppUser = {
  userType: 'customer' | 'technician';
  uniqueCode: string;
  name: string;
  phone?: string;
  professionalId?: number;
  professionType?: string;
};

type AppAuthCtx = {
  user: AppUser | null;
  loading: boolean;
  login: (user: AppUser) => Promise<void>;
  logout: () => Promise<void>;
};

const AppAuthContext = createContext<AppAuthCtx>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
});

export function AppAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val) {
        try { setUser(JSON.parse(val)); } catch {}
      }
      setLoading(false);
    });
  }, []);

  const login = useCallback(async (u: AppUser) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  return (
    <AppAuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AppAuthContext.Provider>
  );
}

export function useAppAuth() {
  return useContext(AppAuthContext);
}
