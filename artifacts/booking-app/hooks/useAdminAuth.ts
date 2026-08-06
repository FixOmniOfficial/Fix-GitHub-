import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback } from 'react';

const ADMIN_PIN = '9999';
const STORAGE_KEY = 'probook_admin_auth_v1';

export function useAdminAuth() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      setIsAdmin(val === 'true');
      setLoading(false);
    });
  }, []);

  const login = useCallback(async (pin: string): Promise<boolean> => {
    if (pin === ADMIN_PIN) {
      await AsyncStorage.setItem(STORAGE_KEY, 'true');
      setIsAdmin(true);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setIsAdmin(false);
  }, []);

  return { isAdmin, loading, login, logout };
}
