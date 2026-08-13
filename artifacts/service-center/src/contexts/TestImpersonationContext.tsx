/**
 * TestImpersonationContext — Service Center side of Test Mode.
 *
 * When a super admin clicks "Login as this User (Web)" in the sandbox,
 * this context records who is being tested so the banner can show it.
 * Persisted in localStorage so it survives a page reload.
 *
 * The actual user session lives in the BOOKING APP (opened in a new tab).
 * This context only tracks it for the banner in the service center.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'sc_test_impersonation_v1';

export type TestRole = 'technician' | 'customer';

export interface ImpersonatedUser {
  name: string;
  code: string;
  role: TestRole;
  professionType?: string;
  emoji: string;
  bookingAppUrl: string;   // URL that was opened
}

type TestImpersonationCtx = {
  isActive: boolean;
  activeUser: ImpersonatedUser | null;
  startImpersonation: (user: ImpersonatedUser) => void;
  stopImpersonation: () => void;
};

const TestImpersonationContext = createContext<TestImpersonationCtx>({
  isActive: false,
  activeUser: null,
  startImpersonation: () => {},
  stopImpersonation: () => {},
});

export function TestImpersonationProvider({ children }: { children: React.ReactNode }) {
  const [activeUser, setActiveUser] = useState<ImpersonatedUser | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setActiveUser(JSON.parse(raw));
    } catch {}
  }, []);

  const startImpersonation = useCallback((user: ImpersonatedUser) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    setActiveUser(user);
  }, []);

  const stopImpersonation = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setActiveUser(null);
  }, []);

  return (
    <TestImpersonationContext.Provider value={{
      isActive: !!activeUser,
      activeUser,
      startImpersonation,
      stopImpersonation,
    }}>
      {children}
    </TestImpersonationContext.Provider>
  );
}

export function useTestImpersonation() {
  return useContext(TestImpersonationContext);
}
