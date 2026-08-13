---
name: Test Mode Context Pattern
description: How TestModeContext bypasses route guards without modifying them — call login(testUser) rather than changing every guard.
---

## Rule
When entering test mode, call `AppAuthContext.login(testUser)` directly. This sets the real `user` state so **all existing route guards pass automatically** — no guard changes needed.

**Why:** Every technician screen checks `user.userType === 'technician'` from `AppAuthContext`. Rather than patching each guard, we just inject the test user into the real auth context. Exit restores the previous real user from a separate storage key.

## How to apply
- `TestModeContext.enterTestMode(profile)` saves real user to `@probook_prev_user_v1`, calls `login(profile.user)`, persists to `@probook_test_mode_v1`.
- `exitTestMode()` restores prev user (or calls `logout()`), clears both storage keys.
- `switchProfile()` just calls `login(newProfile.user)` + updates storage — prev user key is untouched.
- On app restart, context re-hydrates from storage and re-calls `login()` so route guards still pass.

## Files
- `artifacts/booking-app/contexts/TestModeContext.tsx` — context + PRESET_TEST_PROFILES
- `artifacts/booking-app/components/TestModeBanner.tsx` — floating purple pill when active
- `artifacts/booking-app/app/test-mode/index.tsx` — profile picker screen
- Entry point: `app/(tabs)/index.tsx` — "🧪 Developer / Test Mode" dashed link, visible only when not logged in and not in test mode
