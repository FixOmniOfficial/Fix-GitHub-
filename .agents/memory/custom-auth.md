---
name: Custom Auth System
description: Password+OTP based auth implementation replacing Replit Auth OIDC flow
---

## Architecture

- `lib/db/src/schema/auth.ts` — keeps `sessionsTable` (DO NOT DROP) + `usersTable` (Replit OIDC users, unused by custom auth)
- `lib/db/src/schema/users.ts` — `appUsersTable` is the auth source: has `passwordHash`, `otpCode`, `otpExpiresAt`, `otpType`, `username`, `phone`, `lastLoginAt`
- `artifacts/api-server/src/lib/custom-auth.ts` — session CRUD, password hash (bcrypt), OTP helpers, `ensureDefaultAdmin()`
- `artifacts/api-server/src/middlewares/authMiddleware.ts` — reads session cookie `sid`, loads `CustomSessionUser` onto `req.user`
- `artifacts/api-server/src/routes/auth.ts` — POST /auth/login, POST /auth/logout, POST /auth/send-otp, POST /auth/verify-otp, POST /auth/reset-password, GET /auth/user

## Frontend

- `artifacts/service-center/src/lib/use-auth.ts` — `useAuth()` hook fetches `/api/auth/user`; `authApi` object for login/logout/otp/reset
- `artifacts/service-center/src/pages/login.tsx` — 5-step UI: login → forgot → otp → reset → done
- `artifacts/service-center/src/App.tsx` — `AuthGate` component: shows Login page if not authenticated

## Key rules

**Why:** Replit Auth OIDC is not suitable for a private service-center app needing username+password+OTP.
**How to apply:** All auth goes through `appUsersTable`. Do NOT use `usersTable` (Replit OIDC) for app auth.

## Default credentials

Auto-seeded on first startup: username `admin`, password `admin123`.
`ensureDefaultAdmin()` called in routes/auth.ts on module load — idempotent.

## OTP delivery

OTP is returned in API response body in dev mode (`NODE_ENV !== 'production'`) and shown in the UI.
In production: add SMS/WhatsApp/email delivery inside `saveOtp()` or the `/auth/send-otp` route.
