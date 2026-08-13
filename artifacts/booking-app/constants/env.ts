/**
 * Fix Omni — Environment configuration
 *
 * Single source of truth for all env-dependent values.
 * Switching from local → Supabase / production:
 *   just update EXPO_PUBLIC_API_URL in .env or EAS Secrets.
 */

/** Base URL of the API server. Never hardcode localhost in app code. */
export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://fallback-not-set.invalid';

/** Current app environment */
export const APP_ENV: 'development' | 'production' =
  (process.env.EXPO_PUBLIC_APP_ENV as any) ?? (__DEV__ ? 'development' : 'production');

export const IS_DEV = APP_ENV === 'development';
export const IS_PROD = APP_ENV === 'production';

/**
 * Safe console logger — silent in production builds.
 * Usage: import { log } from '@/constants/env';
 *        log('booking created', data);
 */
export const log = IS_DEV
  ? (...args: any[]) => console.log('[FixOmni]', ...args)
  : () => {};

export const warn = IS_DEV
  ? (...args: any[]) => console.warn('[FixOmni]', ...args)
  : () => {};
