---
name: Auth v2 Routes Complete
description: Full customer + technician password-based auth with email OTP recovery and admin recovery tools — all routes, mobile screens, and admin UI are implemented.
---

## What's implemented

**API routes in booking.ts (all under /booking/):**
- `POST /booking/customer/register` — name+phone+email+password → CUST-XXXX
- `POST /booking/customer/login-v2` — mobileOrEmail + password
- `POST /booking/customer/forgot-password` — sends email OTP
- `POST /booking/customer/verify-otp-email`
- `POST /booking/customer/reset-password`
- `POST /booking/technician/register` — name+phone+email+password+profType → TECH-XXXX
- `POST /booking/technician/login-v2` — mobileOrEmail + techId + password (all 3 required)
- `POST /booking/technician/forgot-password`
- `POST /booking/technician/verify-otp-email`
- `POST /booking/technician/reset-password`
- `POST /booking/technician/temp-passcode-login` → `{ requirePasswordChange: true }`

**API routes in admin.ts:**
- `POST /admin/technicians/:id/send-otp` — sends email OTP, returns `demoOtp` if no SMTP
- `POST /admin/technicians/:id/temp-passcode` — 8-char passcode, 10-min expiry
- `GET /admin/technicians/:id/tech-id` — returns uniqueCode + contact info

**Mobile screens:**
- `app/auth/customer.tsx` — 2-field login + register + forgot-password flow
- `app/auth/technician.tsx` — 3-field login + register + temp-passcode + forgot-password
- `app/(tabs)/more.tsx` — language toggle using useLanguage()
- `app/booking/new.tsx` — guest auth gate modal on Confirm Booking; doSubmit() separated from handleSubmit()

**Service center:**
- `technicians.tsx` — 3 admin tool buttons per card: Eye (recall Tech ID), KeyRound (temp passcode dialog), Mail (send OTP)

## Critical import rule
`sendOtpEmail` and `bcrypt` imports must be at the TOP of booking.ts and admin.ts — NOT inline or mid-file. TypeScript/ESM does not allow mid-file import statements.

## SMTP fallback
If SMTP env vars are not set, `sendOtpEmail()` returns `{ ok: false, demoOtp }` and routes pass `demoOtp` back in the response body. This matches existing phone-OTP dev behavior.
