---
name: Supabase Project URL
description: Preventing invalid Supabase Auth request paths when configuration uses a REST endpoint URL.
---

Use the Supabase project root (`https://<project-ref>.supabase.co`) when creating Supabase clients. Do not use a resource path such as `/rest/v1/` or `/auth/v1/` as the configured project URL.

**Why:** Supabase client libraries append their own service paths. Starting from a REST endpoint makes an Auth sign-in request target an invalid nested path, which surfaces to users as “Invalid path specified in request URL.”

**How to apply:** Normalize incoming Supabase configuration before creating API or browser clients and return the normalized public URL from runtime configuration, so an accidentally pasted REST endpoint cannot break sign-in.