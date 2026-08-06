---
name: Clerk Auth Setup
description: Clerk integrated for Email+Password+Google; key routing fix; also api-zod codegen gotcha.
---

## Clerk routing
- ProtectedLayout in `artifacts/service-center/src/App.tsx` catches all routes and redirects unauthenticated users to /sign-in.
- Public routes (customer-form, booking) must be declared BEFORE ProtectedLayout.

## api-zod codegen gotcha
Orval codegen CLEANS the output folder before regenerating. Any manually-written Zod schemas in `lib/api-zod/src/generated/api.ts` will be wiped. Always put custom schemas in the OpenAPI spec so they are regenerated.

**Why:** After adding new booking paths to openapi.yaml, running codegen wiped the hand-written `GenerateShareTokenParams`, `GetPublicCustomerFormParams`, etc. schemas. Had to fix route files to use inline validation instead.

**How to apply:** Never hand-edit `lib/api-zod/src/generated/api.ts`. If a route needs Zod validation for a custom endpoint, either add it to the OpenAPI spec or do inline validation in the route file.

## Booking routes as public
Booking router (`artifacts/api-server/src/routes/booking.ts`) is registered before auth-gated routes in `routes/index.ts` — no auth required for booking creation.
