/**
 * expo-caller-id — cross-platform JS entry point
 *
 * On Android: wraps the native expo-modules-core module + EventEmitter.
 * On web/iOS: returns a silent no-op stub (caller ID is Android-only).
 *
 * Usage:
 *   import CallerIdModule, { addCallerIdListener } from 'expo-caller-id';
 *   CallerIdModule.startListening();
 *   const sub = addCallerIdListener(({ state, number }) => { ... });
 *   sub.remove();
 *   CallerIdModule.stopListening();
 */
import { Platform } from 'react-native';

export type CallState = 'RINGING' | 'OFFHOOK' | 'IDLE';

export interface CallStateEvent {
  /** Current telephony state. */
  state: CallState;
  /**
   * Caller's phone number.
   * Available on Android ≤9 with READ_PHONE_STATE.
   * Will be null on Android 10+ (OS policy; requires READ_CALL_LOG which we don't request).
   */
  number: string | null;
}

export type CallerIdSubscription = { remove: () => void };

// ── Platform-aware module loading ─────────────────────────────────────────────
let _module: any = null;
let _emitter: any = null;

function getModule() {
  if (_module) return _module;
  if (Platform.OS !== 'android') {
    // Return the web stub — import() not supported in synchronous context,
    // so we inline the stub here.
    _module = {
      startListening: () => {},
      stopListening: () => {},
      isListening: () => false,
    };
    return _module;
  }
  try {
    // expo-modules-core requireNativeModule — available in managed/bare Expo builds
    const { requireNativeModule, EventEmitter } = require('expo-modules-core');
    const nativeMod = requireNativeModule('CallerIdModule');
    _module = nativeMod;
    _emitter = new EventEmitter(nativeMod);
  } catch {
    // Not available in Expo Go — return silent stub
    _module = {
      startListening: () => {},
      stopListening: () => {},
      isListening: () => false,
    };
  }
  return _module;
}

// ── Public API ────────────────────────────────────────────────────────────────

const CallerIdModule = {
  /** Register the BroadcastReceiver. Call after permission is granted. */
  startListening(): void {
    getModule().startListening();
  },

  /** Unregister the BroadcastReceiver. Call on unmount. */
  stopListening(): void {
    getModule().stopListening();
  },

  /** Whether the receiver is currently registered. */
  isListening(): boolean {
    return getModule().isListening?.() ?? false;
  },
};

export default CallerIdModule;

/**
 * Subscribe to call state changes.
 * Returns a subscription with a .remove() method.
 * Safe to call on any platform — returns a no-op on web.
 */
export function addCallerIdListener(
  listener: (event: CallStateEvent) => void
): CallerIdSubscription {
  getModule(); // ensure module is initialised
  if (!_emitter) return { remove: () => {} };
  try {
    return _emitter.addListener('onCallStateChanged', listener);
  } catch {
    return { remove: () => {} };
  }
}
