---
name: Table Separation — Technicians vs Professionals
description: Which DB table stores which kind of user; previously had a wrong note.
---

# Table Separation

## The Rule
Mobile-app **technicians** (who log in with a TECH-XXXX code) are stored in **`professionalsTable`**, NOT `appCustomersTable`.

- `professionalsTable` — mobile app technicians/professionals. `uniqueCode` is TECH-XXXX format. Has `visitingCharge`, `name`, `phone`, `avatarEmoji`, `professionType`. Login via `/api/booking/technician/login`.
- `appCustomersTable` — stores something with CUST-XXXX codes (a separate concept, NOT the mobile-app technician).
- `techCustomersTable` — the customers that technicians collect. Has `techCode` (references the TECH-XXXX uniqueCode from professionalsTable).

**Why:** Earlier memory note had this backwards ("Mobile-app technicians in appCustomersTable"), which caused `public-form.ts` to look up by the wrong table and always return 404.

## How to Apply
- Any route that validates a WhatsApp form link (TECH-XXXX) must look up in `professionalsTable`.
- `professionalsTable.visitingCharge` is the right column for visiting charge shown on the customer form.
- When a customer submits the form, insert into `techCustomersTable` with `techCode = professional.uniqueCode`.
