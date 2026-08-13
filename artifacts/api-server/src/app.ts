import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
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

// ── Request logging ────────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
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

// ── Clerk proxy MUST come before body parsers (streams raw bytes) ──────────────
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// ── CORS ───────────────────────────────────────────────────────────────────────
app.use(cors({ credentials: true, origin: true }));

// ── Body parsers ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));           // reject payloads > 1 MB
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ── Input sanitization (after body parse, before routes) ─────────────────────
app.use(sanitizeInputs);

// ── Clerk session ──────────────────────────────────────────────────────────────
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

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
