/**
 * Input sanitization middleware
 *
 * Applied globally (before routes) in app.ts.
 * Defends against:
 *   - XSS via script/HTML tags in JSON/form bodies
 *   - Null-byte injection
 *   - Excessively nested objects (prototype pollution)
 *
 * Strategy: walk req.body, req.query, req.params recursively;
 * strip HTML tags, null bytes, and control characters from strings.
 * Leaves numbers/booleans/null untouched.
 */
import type { Request, Response, NextFunction } from 'express';

const HTML_TAG_RE    = /<[^>]*>/g;
const NULL_BYTE_RE   = /\x00/g;
// Control chars except tab (\x09), newline (\x0A), carriage return (\x0D)
const CONTROL_RE     = /[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

function cleanString(value: string): string {
  return value
    .replace(HTML_TAG_RE, '')       // strip <script>, <img onerror=...>, etc.
    .replace(NULL_BYTE_RE, '')      // remove null bytes
    .replace(CONTROL_RE, '');       // remove non-printable control chars
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  // Guard: max nesting depth 10 to prevent prototype pollution bombs
  if (depth > 10) return '[DEPTH_EXCEEDED]';

  if (typeof value === 'string') return cleanString(value);
  if (Array.isArray(value))     return value.map((v) => sanitizeValue(v, depth + 1));

  if (value !== null && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // Reject __proto__ / constructor / prototype keys (prototype pollution)
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      sanitized[cleanString(k)] = sanitizeValue(v, depth + 1);
    }
    return sanitized;
  }

  // numbers, booleans, null — pass through unchanged
  return value;
}

/** Mutate an existing object in-place with sanitized values (used for req.query / req.params
 *  which are getters in Express 5 and cannot be reassigned). */
function sanitizeInPlace(obj: Record<string, unknown>): void {
  const sanitized = sanitizeValue(obj) as Record<string, unknown>;
  // Update existing keys with sanitized values
  for (const key of Object.keys(obj)) {
    if (key in sanitized) {
      obj[key] = sanitized[key];
    } else {
      delete obj[key]; // key was stripped (e.g. __proto__)
    }
  }
}

export function sanitizeInputs(req: Request, _res: Response, next: NextFunction): void {
  // req.body is writable (set by body-parser) — reassign is safe
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }

  // req.query / req.params are Express 5 getters — mutate values in-place
  if (req.query && typeof req.query === 'object') {
    sanitizeInPlace(req.query as Record<string, unknown>);
  }
  if (req.params && typeof req.params === 'object') {
    sanitizeInPlace(req.params as Record<string, unknown>);
  }

  next();
}
