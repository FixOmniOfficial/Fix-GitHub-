---
name: Settings Extra Fields (shopName, logoUrl)
description: shopName and logoUrl are in the DB but not in the OpenAPI spec or generated Zod schemas
---

## Rule

`shopName` and `logoUrl` are columns in `appSettingsTable` but are NOT declared in `lib/api-spec/openapi.yaml` schemas (`AppSettings`, `AppSettingsUpdate`).

**Why:** Adding them to the spec causes codegen to include them in Zod validators which then strip unknown fields. Managing them outside the spec avoids a full codegen cycle for simple text fields.

**How to apply:** In `artifacts/api-server/src/routes/settings.ts`, destructure `{ shopName, logoUrl, ...rest }` from `req.body` BEFORE passing `rest` to Zod. Apply them manually to the DB update. On GET, serialize them alongside the Zod-parsed fields (the raw DB row includes them).

On the frontend, cast `settings` as `typeof settings & { shopName?: string; logoUrl?: string }` to access the extra fields.
