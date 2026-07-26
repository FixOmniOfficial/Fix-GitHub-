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
