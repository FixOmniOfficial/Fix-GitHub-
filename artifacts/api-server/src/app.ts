import express, { type Express } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import type { IncomingMessage, ServerResponse } from "http";
import {
  globalLimiter,
  authLimiter,
  adminLimiter,
  sandboxLimiter,
  publicLimiter,
} from "./middlewares/rateLimiter";
import { sanitizeInputs } from "./middlewares/sanitize";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// ── Trust proxy — required in Replit (proxied env) for rate-limiter to read ────
// the real client IP from X-Forwarded-For instead of crashing with ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
app.set("trust proxy", 1);

// ── Request logging ────────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: IncomingMessage) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res: ServerResponse) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ── Security headers ───────────────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  next();
});

// ── CORS ───────────────────────────────────────────────────────────────────────
app.use(cors({ credentials: true, origin: true }));

// ── Body parsers ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));           // reject payloads > 1 MB
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ── Input sanitization (after body parse, before routes) ─────────────────────
app.use(sanitizeInputs);

// ── Rate limiters (applied before routes) ─────────────────────────────────────

// Global baseline — all API routes
app.use("/api", globalLimiter);

// Stricter limits on specific path prefixes
app.use("/api/auth",            authLimiter);    // login / OTP
app.use("/api/booking/otp",     authLimiter);    // booking OTP endpoint
app.use("/api/booking/signup",  authLimiter);    // technician signup
app.use("/api/admin",           adminLimiter);   // admin panel operations
app.use("/api/admin/sandbox",   sandboxLimiter); // sandbox generate/clear (most restrictive)
app.use("/api/book",            publicLimiter);  // public booking form

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use("/api", router);

export default app;
