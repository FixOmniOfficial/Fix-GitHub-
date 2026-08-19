# सर्विस सेंटर मैनेजर (Service Center Manager)

AC, फ्रिज, वॉशिंग मशीन और अन्य अप्लायंस रिपेयर शॉप के लिए बिलिंग और कस्टमर मैनेजमेंट ऐप।

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server (port 8080)
- `pnpm --filter @workspace/service-center run dev` — Frontend (port 24492)
- `pnpm run typecheck` — full typecheck
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Supabase migration / cutover runbook

1. **Prepare the owner safely.** Keep the legacy `DATABASE_URL` database as the rollback source and take a backup before cutover. Store `DATABASE_URL`, `SUPABASE_DB_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and the exact owner email in `SUPABASE_BOOTSTRAP_SUPER_ADMIN_EMAIL` as workspace secrets. Never put the service-role key in code, chat, or shell history.
2. **Apply schema protections first.** Run `pnpm --filter @workspace/db run migrate:supabase`. It applies the ordered Supabase schema migrations with checksums, transactions, and an advisory lock. Do not use the dev-only `push` command for production.
3. **Invite and reconcile users.** Run `SUPABASE_BOOTSTRAP_SUPER_ADMIN_EMAIL=owner@example.com pnpm --filter @workspace/api-server run reconcile:users`. It reconciles stable domain identifiers, imports bcrypt password hashes, clears legacy OTP/temp-passcode data, creates or links Supabase Auth identities, and invites the configured owner as `super_admin`.
4. **Verify and recover.** Re-run the reconciliation command to confirm it creates no duplicate data, verify the invited owner can sign in and has the `super_admin` role, then start the API. A failed in-flight migration/reconciliation rolls back its own work; a completed cutover is reverted by restoring the pre-cutover legacy backup and prior deployment. Do not delete Auth users or drop tables as an ad-hoc rollback.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + TailwindCSS + shadcn/ui + wouter routing
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (zod/v4), drizzle-zod
- API codegen: Orval (from OpenAPI spec)

## Where things live

- `artifacts/service-center/` — React frontend (Hindi+English UI)
- `artifacts/api-server/src/routes/` — API routes: customers, appliances, jobs, highlights, reminders, users, settings, dashboard
- `lib/db/src/schema/` — DB schema: customers, appliances, jobs, highlights, reminders, users (app_users), settings (app_settings)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth)
- `lib/api-client-react/src/generated/` — Generated React Query hooks (do NOT edit manually)
- `lib/api-zod/src/generated/` — Generated Zod schemas for server validation (do NOT edit manually)

## Architecture decisions

- All 25 features are implemented: customizable home, WhatsApp integration, customer/payment history, appliance history, highlight system with caption sizing/zoom, secure edit/delete confirmations, single-page customer detail, WhatsApp DP, auto job numbering, in-built calculator, payment tick, notification highlights, reminders/alarms, backup/sync placeholder, reporting with recharts, user roles, global edit, wallpaper customization, numbered highlights, tick marks, global/personal wallpaper control, edit later, highlight add/delete, zoomable caption, WhatsApp auto-form.
- Job numbers auto-generated as JOB-0001, JOB-0002, etc.
- WhatsApp integration: wa.me links with prefilled Hindi message template + service form fields.
- Settings singleton pattern: getOrCreateSettings() ensures one settings row always exists.

## Product

Appliance repair service center management app:
- Customers: add, search, WhatsApp contact, payment status
- Service Jobs: create, track status (pending/in_progress/completed), payment tick marks
- Appliance History: per-customer appliance records
- Highlights: colored numbered labels with tick marks and zoom control
- Reminders & Alarms: schedule notifications for follow-ups
- Dashboard: summary stats, recent jobs, revenue
- Reports: charts by status, payment, revenue trend
- Calculator: in-built for billing math
- Settings: wallpaper, theme, language, font size

## User preferences

- Language: Hindi + English (bilingual UI)
- Business type: Appliance repair / service center

## Gotchas

- After OpenAPI spec changes, ALWAYS run codegen: `pnpm --filter @workspace/api-spec run codegen`
- After lib/* changes, run `pnpm run typecheck:libs` before leaf typechecks
- Don't edit generated files in lib/api-client-react or lib/api-zod directly
- Settings uses singleton pattern (getOrCreateSettings in settings route)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
