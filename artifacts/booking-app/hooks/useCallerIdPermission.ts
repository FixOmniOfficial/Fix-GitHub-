/**
 * useCallerIdPermission
 *
 * Manages the READ_PHONE_STATE permission lifecycle for Caller ID:
 *   1. Checks AsyncStorage for a prior decision → avoids re-asking.
 *   2. Shows an in-app rationale sheet (CallerIdPermissionSheet) first.
 *   3. Calls PermissionsAndroid.request() after user taps "Enable".
 *   4. Records the outcome so the sheet never reappears on subsequent opens.
 *
 * Returns:
 *   - status:           'unknown' | 'granted' | 'denied' | 'never_ask_again'
 *   - showRationale:    whether the in-app rationale sheet should be visible
 *   - requestPermission(): call this when user taps "Enable Caller ID"
 *   - dismissRationale(): call this when user taps "Maybe Later"
 *
 * Play Store compliance:
 *   - We show the rationale BEFORE the system dialog, fulfilling the
 *     "prominent disclosure" requirement for sensitive permissions.
 *   - No repeated prompts: once denied, we surface a Settings link only.
 *   - Permission is optional: the app works fully without it.
 */
import { useEffect, useState, useCallback } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PERM_KEY     = '@callerid_perm_status_v1';
const ASKED_KEY    = '@callerid_rationale_shown_v1';

export type CallerIdPermStatus =
  | 'unknown'         // first launch, haven't checked yet
  | 'granted'         // READ_PHONE_STATE granted
  | 'denied'          // user denied — can show "go to Settings"
  | 'never_ask_again' // user ticked "don't ask again"
  | 'unavailable';    // non-Android platform — feature not applicable

export function useCallerIdPermission() {
  const [status,         setStatus]         = useState<CallerIdPermStatus>('unknown');
  const [showRationale,  setShowRationale]  = useState(false);
  const [isChecking,     setIsChecking]     = useState(true);

  // ── 1. Boot: restore persisted status + decide whether to show rationale ──
  useEffect(() => {
    if (Platform.OS !== 'android') {
      setStatus('unavailable');
      setIsChecking(false);
      return;
    }
    (async () => {
      try {
        const [saved, rationaleSeen] = await Promise.all([
          AsyncStorage.getItem(PERM_KEY),
          AsyncStorage.getItem(ASKED_KEY),
        ]);

        if (saved === 'granted') {
          setStatus('granted');
        } else if (saved === 'never_ask_again') {
          setStatus('never_ask_again');
        } else if (saved === 'denied') {
          setStatus('denied');
        } else {
          // First run: show rationale sheet if not already seen
          if (!rationaleSeen) setShowRationale(true);
          setStatus('unknown');
        }
      } catch {}
      setIsChecking(false);
    })();
  }, []);

  // ── 2. Request the actual Android permission ──────────────────────────────
  const requestPermission = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    setShowRationale(false);

    try {
      await AsyncStorage.setItem(ASKED_KEY, '1');

      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
        {
          title: 'Caller ID Permission',
          message:
            'Fix Omni can show your customer\'s name when they call — ' +
            'so you always know who is calling before you pick up.\n\n' +
            'No call data leaves your device.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        }
      );

      let newStatus: CallerIdPermStatus;
      switch (result) {
        case PermissionsAndroid.RESULTS.GRANTED:
          newStatus = 'granted'; break;
        case PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN:
          newStatus = 'never_ask_again'; break;
        default:
          newStatus = 'denied';
      }

      await AsyncStorage.setItem(PERM_KEY, newStatus);
      setStatus(newStatus);
    } catch {
      setStatus('denied');
    }
  }, []);

  // ── 3. Dismiss rationale without requesting ───────────────────────────────
  const dismissRationale = useCallback(async () => {
    setShowRationale(false);
    try {
      await AsyncStorage.setItem(ASKED_KEY, '1');
      await AsyncStorage.setItem(PERM_KEY, 'denied');
      setStatus('denied');
    } catch {}
  }, []);

  return {
    status,
    isChecking,
    showRationale,
    requestPermission,
    dismissRationale,
    isGranted:     status === 'granted',
    isUnavailable: status === 'unavailable',
  };
}
