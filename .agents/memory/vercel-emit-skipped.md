---
name: Vercel "Emit skipped" build failures
description: Why Vercel reports "Emit skipped" on an innocent file and how to fix/push around it
---

# Vercel "Emit skipped" on api-server

**The rule:** "src/<file>.ts: Emit skipped" is NOT an error in that file. With `noEmitOnError: true` (tsconfig.base.json), TypeScript blocks emit for ALL files when ANY file in the program has an error. Find the real errors with `pnpm --filter @workspace/api-server exec tsc -p tsconfig.json --noEmit --pretty false` and fix those.

**Why:** Wasted multiple rounds "fixing" health.ts when the actual errors were in objectStorage/highlights/jobs/reminders/settings/super-admin (numeric-column string coercion, req.params string|string[] widening, response.json() unknown).

**How to apply:** When Vercel names a file with "Emit skipped", run the full local typecheck first; the named file is usually just the first alphabetical/graph victim. Keep the health route dependency-free (no @workspace/api-zod import) so deploy health checks never depend on generated schema state.

# Pushing to GitHub from this workspace

**The rule:** `git push origin main` fails — the HTTPS remote has no usable credential and the GITHUB_TOKEN env secret is rejected by GitHub. Use the authorized GitHub connection instead: `listConnections("github")` inside `"use impure"`, then `conn.proxyFetch` with the Contents API (`PUT /repos/FixOmniOfficial/Fix-GitHub-/contents/<path>` with base64 content + current blob sha). Afterwards `git fetch origin && git merge --ff-only origin/main` to re-sync local.

**Why:** Direct pushes failed twice with "Invalid username or token"; the connector proxy path worked immediately without exposing credentials.
