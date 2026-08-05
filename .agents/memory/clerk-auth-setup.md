---
name: Clerk Auth Setup
description: Clerk authentication integration — Email+Password+Google; routing pattern that works
---

## Architecture

- `artifacts/api-server/src/app.ts` — uses `clerkProxyMiddleware` (before body parsers) + `clerkMiddleware` from `@clerk/express`
- `artifacts/api-server/src/middlewares/clerkProxyMiddleware.ts` — copied from Clerk skill template, do not modify
- `artifacts/service-center/src/App.tsx` — `ClerkProvider` with `baseTheme: shadcn`, amber color variables
- `artifacts/service-center/src/pages/sign-in.tsx` — `<SignIn routing="path" path={basePath+'/sign-in'}>`
- `artifacts/service-center/src/pages/sign-up.tsx` — `<SignUp routing="path" path={basePath+'/sign-up'}>`
- `artifacts/service-center/public/logo.svg` — wrench icon shown in Clerk modal

## Critical routing rule

**Why:** `<SignIn routing="path">` only renders when the URL matches its `path` prop. Rendering it on a different route (like `/`) produces a blank screen.

**How to apply:** 
- `/sign-in/*?` and `/sign-up/*?` route to their pages directly.
- All other routes fall through to `ProtectedLayout` which calls `useAuth()` and redirects to `/sign-in` if not signed in.
- Do NOT render `<SignIn>` inside a catch-all route — always give it a dedicated `/sign-in/*?` route.

## Clerk appearance

Uses `baseTheme: shadcn` (NOT `theme: shadcn`). Color variables use amber (#f59e0b) as primary. CSS layer order: `@layer theme, base, clerk, components, utilities` must come BEFORE `@import 'tailwindcss'` in index.css. Vite config must have `tailwindcss({ optimize: false })` to prevent prod build CSS breakage.

## Auth state in components

Use `useAuth()` for `isLoaded`/`isSignedIn`. Use `useUser()` for user profile data. Use `useClerk()` for `signOut`. Do NOT use custom `authApi` or `useAuth` from `@/lib/use-auth` — those are the old custom system.

## Google OAuth

Enabled by default in Clerk dev tenant. Users see "Continue with Google" button automatically.

## Clerk app ID

`app_3HUlrWlKkyNBa3CDLfyOELPS3Az` — provisioned automatically, do not recreate.
