/**
 * useCallerDetection
 *
 * Subscribes to CallerIdModule native events and:
 *  1. Normalises the incoming phone number.
 *  2. Matches it against the technician's customer list (in-memory — no server call).
 *  3. Drives the "incomingCall" banner state.
 *  4. Persists matched calls to useCallHistory (only known customers, never unknowns).
 *
 * State machine:
 *   IDLE  ──► RINGING  : New incoming call. Lookup customer, show banner.
 *   RINGING ──► OFFHOOK: Call answered — save as "Completed".
 *   RINGING ──► IDLE   : No answer — save as "Missed".
 *   OFFHOOK ──► IDLE   : Call ended after pickup (already saved on OFFHOOK).
 *
 * Play Store compliance:
 *   - No number is sent to the server.
 *   - Only matched customer numbers appear in history (unknowns discarded).
 *   - Works silently (no-op) if permission is not granted or on web/iOS.
 *
 * @param customers  The technician's current customer list (from home.tsx state).
 * @param isGranted  Output of useCallerIdPermission().isGranted.
 * @param addEntry   Output of useCallHistory().addEntry.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import CallerIdModule, { addCallerIdListener, CallState } from 'expo-caller-id';

export interface IncomingCallInfo {
  /** Matched customer name, or null if the number wasn't in the customer list. */
  customerName: string | null;
  /** Raw phone number from the OS. Null on Android 10+ without READ_CALL_LOG. */
  phoneNumber: string | null;
  /** Current telephony state. */
  state: CallState;
}

// ── Phone normalisation (Indian numbers + general) ────────────────────────────
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  // Strip Indian country code (91 prefix makes 12 digits)
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 13 && digits.startsWith('091')) return digits.slice(3);
  // Default: last 10 digits (covers most mobile numbers)
  return digits.length > 10 ? digits.slice(-10) : digits;
}

interface Customer {
  name: string;
  phone: string;
  [key: string]: any;
}

export function useCallerDetection(
  customers: Customer[],
  isGranted: boolean,
  addEntry: (e: { customerName: string; phoneNumber: string; timestamp: number; callStatus: 'Missed' | 'Completed' }) => void
) {
  const [incomingCall, setIncomingCall] = useState<IncomingCallInfo | null>(null);

  // Track previous state to determine Missed vs Completed
  const prevStateRef  = useRef<CallState | null>(null);
  const pendingRef    = useRef<{ customerName: string | null; phoneNumber: string | null } | null>(null);

  // ── Customer phone lookup ────────────────────────────────────────────────
  const findCustomer = useCallback((rawNumber: string | null): string | null => {
    if (!rawNumber) return null;
    const normalized = normalizePhone(rawNumber);
    if (!normalized || normalized.length < 6) return null;

    const match = customers.find(c => normalizePhone(c.phone) === normalized);
    return match?.name ?? null;
  }, [customers]);

  // ── Native event handler ─────────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'android' || !isGranted) return;

    CallerIdModule.startListening();

    const sub = addCallerIdListener(({ state, number }) => {
      const prev = prevStateRef.current;

      if (state === 'RINGING') {
        const customerName = findCustomer(number);
        pendingRef.current = { customerName, phoneNumber: number };
        setIncomingCall({ customerName, phoneNumber: number, state });

      } else if (state === 'OFFHOOK') {
        // Call answered — save to history if the ringing call had a known customer
        if (prev === 'RINGING' && pendingRef.current?.customerName) {
          addEntry({
            customerName: pendingRef.current.customerName,
            phoneNumber: pendingRef.current.phoneNumber ?? '',
            timestamp: Date.now(),
            callStatus: 'Completed',
          });
        }
        // Clear banner (they've picked up — no need to show who's calling)
        setIncomingCall(null);

      } else if (state === 'IDLE') {
        // Missed call: was ringing, nobody picked up
        if (prev === 'RINGING' && pendingRef.current?.customerName) {
          addEntry({
            customerName: pendingRef.current.customerName,
            phoneNumber: pendingRef.current.phoneNumber ?? '',
            timestamp: Date.now(),
            callStatus: 'Missed',
          });
        }
        pendingRef.current = null;
        setIncomingCall(null);
      }

      prevStateRef.current = state;
    });

    return () => {
      sub.remove();
      CallerIdModule.stopListening();
    };
  }, [isGranted, findCustomer, addEntry]);

  // ── Dismiss banner manually (e.g. technician taps ✕) ────────────────────
  const dismissBanner = useCallback(() => setIncomingCall(null), []);

  return { incomingCall, dismissBanner };
}
