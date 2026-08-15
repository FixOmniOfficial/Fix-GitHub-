import React, { createContext, useContext, useEffect, useState } from 'react';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? '';

export interface ScreenVisibilityRow {
  screenKey: string;
  label: string;
  userType: string;
  isEnabled: boolean;
  sortOrder: number;
}

interface ScreenVisibilityContextValue {
  screens: ScreenVisibilityRow[];
  isLoaded: boolean;
  isScreenEnabled: (key: string) => boolean;
}

const ScreenVisibilityContext = createContext<ScreenVisibilityContextValue>({
  screens: [],
  isLoaded: false,
  isScreenEnabled: () => true,   // default: everything enabled until loaded
});

export function ScreenVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [screens, setScreens] = useState<ScreenVisibilityRow[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/public/screen-visibility`)
      .then(r => r.ok ? r.json() : [])
      .then((data: ScreenVisibilityRow[]) => {
        setScreens(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        // Network error → default all enabled
        setScreens([]);
      })
      .finally(() => setIsLoaded(true));
  }, []);

  const isScreenEnabled = (key: string): boolean => {
    if (!isLoaded || screens.length === 0) return true; // fail-open until loaded
    const row = screens.find(s => s.screenKey === key);
    if (!row) return true;   // unknown key → enabled by default
    return row.isEnabled;
  };

  return (
    <ScreenVisibilityContext.Provider value={{ screens, isLoaded, isScreenEnabled }}>
      {children}
    </ScreenVisibilityContext.Provider>
  );
}

export function useScreenVisibility() {
  return useContext(ScreenVisibilityContext);
}
