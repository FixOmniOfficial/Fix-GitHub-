---
name: Clerk Auth Setup
description: Clerk authentication + admin role system — Email+Password+Google; routing pattern and admin control flow
---

## Architecture

- `artifacts/api-server/src/app.ts` — uses `clerkProxyMiddleware` (before body parsers) + `clerkMiddleware` from `@clerk/express`
- `artifacts/api-server/src/middlewares/clerkProxyMiddleware.ts` — copied from Clerk skill template, do not modify
- `artifacts/api-server/src/middlewares/requireAuth.ts` — `requireAuth` (checks Clerk session) + `requireAdmin` (checks publicMetadata.role)
- `artifacts/api-server/src/routes/admin.ts` — GET /admin/users, PATCH /admin/users/:id/role, POST /admin/users/:id/ban, POST /admin/ensure-first-admin
- `artifacts/service-center/src/App.tsx` — ClerkProvider with baseTheme:shadcn, amber variables; EnsureFirstAdmin component
- `artifacts/service-center/src/pages/sign-in.tsx` — `<SignIn routing="path" path={basePath+'/sign-in'}>`
- `artifacts/service-center/src/pages/sign-up.tsx` — `<SignUp routing="path" path={basePath+'/sign-up'}>`
- `artifacts/service-center/src/lib/use-role.ts` — `useRole()` hook reading publicMetadata.role
- `artifacts/service-center/public/logo.svg` — wrench icon shown in Clerk modal

## Critical routing rule

**Why:** `<SignIn routing="path">` only renders when the URL matches its `path` prop. Rendering it on a different route (like `/`) produces a blank screen.

**How to apply:**
- `/sign-in/*?` and `/sign-up/*?` route to their pages directly.
- All other routes fall through to `ProtectedLayout` which uses `useAuth()` and redirects to `/sign-in` if not signed in.
- Do NOT render `<SignIn>` inside a catch-all route.

## Admin role system

Roles stored in Clerk `publicMetadata.role`: `'admin' | 'technician' | 'viewer' | 'user'`.

**First-admin flow:** `EnsureFirstAdmin` component (in App.tsx) calls `POST /api/admin/ensure-first-admin` after every sign-in. If no admin exists yet, the calling user is promoted to admin and `user.reload()` is called to refresh the Clerk session.

**API protection:** `requireAdmin` middleware fetches the Clerk user by ID and checks `publicMetadata.role === 'admin'`. Expensive (one Clerk API call), but only used on admin endpoints.

**Frontend role check:** `useRole()` from `@/lib/use-role` reads `user.publicMetadata.role` synchronously from the cached Clerk session.

## Clerk appearance

Uses `baseTheme: shadcn` (NOT `theme: shadcn` — that field doesn't exist). Color variables use amber (#f59e0b) as primary. CSS layer order: `@layer theme, base, clerk, components, utilities` must come BEFORE `@import 'tailwindcss'` in index.css. Vite config must have `tailwindcss({ optimize: false })` to prevent prod build CSS breakage.

## Auth state in components

Use `useAuth()` for `isLoaded`/`isSignedIn`. Use `useUser()` for user profile data. Use `useClerk()` for `signOut`. Do NOT use custom `authApi` or `useAuth` from `@/lib/use-auth` — those are the old custom system.

## Clerk app ID

`app_3HUlrWlKkyNBa3CDLfyOELPS3Az` — provisioned automatically, do not recreate.
