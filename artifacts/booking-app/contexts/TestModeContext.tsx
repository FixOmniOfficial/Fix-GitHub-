/**
 * TestModeContext — Developer/QA role switcher.
 *
 * Entering test mode:
 *   1. Saves the real logged-in user (if any) so it can be restored on exit.
 *   2. Calls AppAuthContext.login(testUser) so ALL existing route guards that
 *      check `user.userType` pass automatically — no guard changes needed.
 *   3. Sets `isTestMode = true` + persists the active profile.
 *
 * Exiting test mode restores the previous real user (or logs out if there was none).
 */
import React, {
  createContext, useContext, useState, useEffect, useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppUser, useAppAuth } from './AppAuthContext';

const TEST_MODE_KEY  = '@probook_test_mode_v1';
const PREV_USER_KEY  = '@probook_prev_user_v1';

// ── Profile shape ─────────────────────────────────────────────────────────────
export interface TestProfile {
  id: string;
  label: string;
  emoji: string;
  roleTag: string;            // displayed in the banner
  description: string;
  color: string;              // accent colour for the card
  user: AppUser;
}

// ── Preset profiles (always available, no real DB required) ───────────────────
export const PRESET_TEST_PROFILES: TestProfile[] = [
  {
    id: 'tech-ac',
    label: 'AC Technician',
    emoji: '❄️',
    roleTag: 'TECHNICIAN',
    description: 'Technician dashboard, customers, payments, reminders',
    color: '#06b6d4',
    user: {
      userType: 'technician',
      uniqueCode: 'TECH-TEST',
      name: 'Test AC Technician',
      phone: '9000000001',
      professionType: 'ac_technician',
    },
  },
  {
    id: 'tech-electrician',
    label: 'Electrician',
    emoji: '⚡',
    roleTag: 'TECHNICIAN',
    description: 'Electrician profile — same dashboard with electrical jobs',
    color: '#eab308',
    user: {
      userType: 'technician',
      uniqueCode: 'TECH-TEST',
      name: 'Test Electrician',
      phone: '9000000002',
      professionType: 'electrician',
    },
  },
  {
    id: 'tech-plumber',
    label: 'Plumber',
    emoji: '🔧',
    roleTag: 'TECHNICIAN',
    description: 'Plumber profile — technician view with plumbing jobs',
    color: '#3b82f6',
    user: {
      userType: 'technician',
      uniqueCode: 'TECH-TEST',
      name: 'Test Plumber',
      phone: '9000000003',
      professionType: 'plumber',
    },
  },
  {
    id: 'customer',
    label: 'Customer',
    emoji: '👤',
    roleTag: 'CUSTOMER',
    description: 'Customer home, booking flow, booking history',
    color: '#8b5cf6',
    user: {
      userType: 'customer',
      uniqueCode: 'CUST-TEST',
      name: 'Test Customer',
      phone: '9000000010',
    },
  },
];

// ── Context type ──────────────────────────────────────────────────────────────
type TestModeCtx = {
  isTestMode: boolean;
  activeProfile: TestProfile | null;
  enterTestMode: (profile: TestProfile) => Promise<void>;
  exitTestMode: () => Promise<void>;
  switchProfile: (profile: TestProfile) => Promise<void>;
};

const TestModeContext = createContext<TestModeCtx>({
  isTestMode: false,
  activeProfile: null,
  enterTestMode: async () => {},
  exitTestMode: async () => {},
  switchProfile: async () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────
export function TestModeProvider({ children }: { children: React.ReactNode }) {
  const { login, logout, user } = useAppAuth();
  const [isTestMode,    setIsTestMode]    = useState(false);
  const [activeProfile, setActiveProfile] = useState<TestProfile | null>(null);

  // Restore persisted test mode on app restart
  useEffect(() => {
    AsyncStorage.getItem(TEST_MODE_KEY).then(val => {
      if (!val) return;
      try {
        const saved: { profile: TestProfile } = JSON.parse(val);
        setIsTestMode(true);
        setActiveProfile(saved.profile);
        // Re-inject the test user so route guards still pass after a restart
        login(saved.profile.user);
      } catch {}
    });
  }, []);

  const enterTestMode = useCallback(async (profile: TestProfile) => {
    // Snapshot real user before overwriting (skip if already in test mode)
    if (!isTestMode && user) {
      await AsyncStorage.setItem(PREV_USER_KEY, JSON.stringify(user));
    }
    await AsyncStorage.setItem(TEST_MODE_KEY, JSON.stringify({ profile }));
    // This call sets AppAuthContext.user → existing route guards pass automatically
    await login(profile.user);
    setIsTestMode(true);
    setActiveProfile(profile);
  }, [user, isTestMode, login]);

  const exitTestMode = useCallback(async () => {
    const prevRaw = await AsyncStorage.getItem(PREV_USER_KEY);
    await AsyncStorage.multiRemove([TEST_MODE_KEY, PREV_USER_KEY]);
    setIsTestMode(false);
    setActiveProfile(null);
    if (prevRaw) {
      try { await login(JSON.parse(prevRaw)); } catch { await logout(); }
    } else {
      await logout();
    }
  }, [login, logout]);

  const switchProfile = useCallback(async (profile: TestProfile) => {
    await AsyncStorage.setItem(TEST_MODE_KEY, JSON.stringify({ profile }));
    await login(profile.user);
    setActiveProfile(profile);
  }, [login]);

  return (
    <TestModeContext.Provider value={{
      isTestMode, activeProfile, enterTestMode, exitTestMode, switchProfile,
    }}>
      {children}
    </TestModeContext.Provider>
  );
}

export function useTestMode() {
  return useContext(TestModeContext);
}
