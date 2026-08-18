# Proofica

Multi-tenant rental management SaaS for car / generator / equipment rental businesses. Built with Next.js (App Router), Prisma, PostgreSQL, and Auth.js.

## Features

- **Rentals** — create rentals with daily/hourly/weekly/monthly pricing, deposit collection, extensions, cancellations, and overdue tracking.
- **Inspections** — handover & return inspections with checklist, damages, photos, fuel levels, and customer/staff signatures; before/after comparison.
- **Payments & deposits** — payments, charges, and deposit refunds with itemized deductions and authorization thresholds.
- **Assets & customers** — asset fleet with availability conflicts, customer records with ID/verification fields.
- **Maintenance** — scheduled & preventive maintenance with reminders.
- **Finance** — expenses, budgets, revenue/expense reports, CSV export.
- **Team & permissions** — role-based access (Owner / Admin / Manager / Staff / Inspector / Accountant).
- **Public share links** — printable rental reports shared with customers via expiring, revocable tokens.

## Tech stack

- **Next.js 16** (App Router, React Server Components)
- **Prisma 7** with PostgreSQL
- **Auth.js (next-auth v5)** — email/password with bcrypt
- **Tailwind CSS 4**, shadcn-style UI, lucide-react, recharts
- **date-fns, zod, sonner, radix-ui**
- **Vitest** for unit tests

## Getting started

### 1. Install & configure

```bash
npm install
cp .env.example .env   # or edit .env directly
```

Key env vars (see `.env`):

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Generate with: `npx auth secret` |
| `AUTH_TRUST_HOST` | `true` for local dev |
| `NEXT_PUBLIC_APP_URL` | Public base URL (used for share links) |
| `STORAGE_PROVIDER` | `local` (default) or `s3` for S3-compatible storage |
| `STORAGE_LOCAL_DIR` | Local disk folder for uploads (`./storage`) |

### 2. Set up the database

```bash
npm run db:push      # sync schema to DB
```

### 3. Run

```bash
npm run dev
```

Open http://localhost:3000.

## Scripts

```bash
npm run dev            # dev server
npm run build          # production build
npm run lint           # eslint
npm run test           # vitest unit tests
npm run db:push        # push schema to DB
```

## Project structure

```
prisma/
  schema.prisma        # data model
src/
  app/                 # App Router pages + API routes
  auth/                # Auth.js config, credential provider, signIn helper
  components/
    shared/            # FormField, SelectField, FileUploader, SignaturePad, etc.
    ui/                # shadcn primitives (button, card, dialog, ...)
    pdf/               # PDF generation (inspection reports, rental agreements)
  lib/
    constants.ts       # currencies, roles, permissions, statuses
    rental-math.ts     # pure pricing / late fee / deposit / fuel math
    validators.ts      # zod schemas
    storage.ts         # file storage abstraction (local disk / S3)
  server/actions/      # server actions (rentals, payments, expenses, ...)
  services/            # access, availability, settings, audit, rental-report
  generated/prisma/    # generated Prisma client
```

## Pricing & business rules

- Billing rounds to full units (`full_unit_per_period`) or calendar units — configurable per org in **Settings → Rental rules**.
- Late fees apply after a grace period, billed hourly or daily, with an optional cap.
- Deposit refunds deduct itemized approved charges; never go below zero.
- Fuel shortage is priced per percent below the required return level.

## Data model overview

`Organization` → `OrganizationMember`/`User`, `Asset`, `Customer`, `Rental`, `Deposit`, `Payment`, `Charge`, `Inspection` (+ items/damages/photos/signatures), `Maintenance`, `Expense`, `Budget`, `Notification`, `AuditLog`, `ShareLink`, `OrganizationSetting`.
