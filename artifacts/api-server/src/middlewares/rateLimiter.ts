/**
 * Rate limiters — express-rate-limit
 *
 * Applied at the app level in app.ts.
 * Different limits for different risk profiles:
 *   globalLimiter   — all /api/* requests (generous baseline)
 *   authLimiter     — login / OTP routes (strict, prevents brute-force)
 *   adminLimiter    — /api/admin/* (tighter than global)
 *   sandboxLimiter  — sandbox generate/clear (prevent DB flooding)
 *   publicLimiter   — public booking form (moderate, no auth)
 */
import { rateLimit, type Options } from 'express-rate-limit';

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR        = 60 * 60 * 1000;

const baseOptions: Partial<Options> = {
  standardHeaders: 'draft-7', // RateLimit-* headers (RFC draft)
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: 'Too many requests. Please slow down and try again later.',
      retryAfter: res.getHeader('RateLimit-Reset'),
    });
  },
};

/** Global baseline: 300 requests per 15 min per IP */
export const globalLimiter = rateLimit({
  ...baseOptions,
  windowMs: FIFTEEN_MINUTES,
  limit: 300,
  message: undefined, // handled by handler above
});

/** Auth routes: 10 requests per 15 min per IP (brute-force guard) */
export const authLimiter = rateLimit({
  ...baseOptions,
  windowMs: FIFTEEN_MINUTES,
  limit: 10,
  skipSuccessfulRequests: false,
});

/** Admin routes: 120 requests per 15 min per IP */
export const adminLimiter = rateLimit({
  ...baseOptions,
  windowMs: FIFTEEN_MINUTES,
  limit: 120,
});

/** Sandbox generate/clear: 20 per hour per IP — prevent DB spam */
export const sandboxLimiter = rateLimit({
  ...baseOptions,
  windowMs: ONE_HOUR,
  limit: 20,
});

/** Public booking form: 30 requests per 15 min per IP */
export const publicLimiter = rateLimit({
  ...baseOptions,
  windowMs: FIFTEEN_MINUTES,
  limit: 30,
});
