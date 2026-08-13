/**
 * useCallHistory
 *
 * Persists and retrieves the "Recent Customer Calls" list in AsyncStorage.
 *
 * Storage contract:
 *   Key: @callerid_history_v1
 *   Value: JSON array of CallHistoryEntry (max MAX_ENTRIES, newest first)
 *
 * Only entries where customerName is non-null are ever stored — unknown
 * numbers (no match in the customer list) are filtered OUT by useCallerDetection
 * before addEntry() is called. This hook itself imposes no filter — it trusts
 * the caller.
 */
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY  = '@callerid_history_v1';
const MAX_ENTRIES  = 50; // keep last 50 matched customer calls

export type CallStatus = 'Missed' | 'Completed';

export interface CallHistoryEntry {
  id: string;          // uuid-like: timestamp + random
  customerName: string;
  phoneNumber: string;
  timestamp: number;   // epoch ms
  callStatus: CallStatus;
}

export function useCallHistory() {
  const [history, setHistory] = useState<CallHistoryEntry[]>([]);
  const [loaded,  setLoaded]  = useState(false);

  // ── Load from AsyncStorage on mount ─────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setHistory(JSON.parse(raw));
      } catch {}
      setLoaded(true);
    })();
  }, []);

  // ── Persist helper ───────────────────────────────────────────────────────
  const persist = useCallback(async (entries: CallHistoryEntry[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {}
  }, []);

  // ── addEntry ─────────────────────────────────────────────────────────────
  const addEntry = useCallback((entry: Omit<CallHistoryEntry, 'id'>) => {
    const full: CallHistoryEntry = {
      ...entry,
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    };
    setHistory(prev => {
      const updated = [full, ...prev].slice(0, MAX_ENTRIES);
      persist(updated);
      return updated;
    });
  }, [persist]);

  // ── clearHistory ─────────────────────────────────────────────────────────
  const clearHistory = useCallback(async () => {
    setHistory([]);
    try { await AsyncStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  return { history, loaded, addEntry, clearHistory };
}
