# Proofica

> Protect every rental with proof.

Proofica is a multi-tenant rental management SaaS built for car, generator, equipment, tool, and electronics rental businesses. It records the exact condition of assets at handover and return — with photos, signatures, meter readings, and damage tracking — so every rental is backed by evidence.

---

## Table of Contents

- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [Pricing & Business Rules](#pricing--business-rules)
- [Inspection Flow](#inspection-flow)
- [API Routes](#api-routes)
- [Environment Variables](#environment-variables)
- [Testing](#testing)
- [Deployment](#deployment)
- [License](#license)

---

## Key Features

### Rental Management
- Full rental lifecycle: **Draft → Reserved → Awaiting Handover → Active → Due Soon → Overdue → Returned → Completed**
- Pricing models: hourly, daily, weekly, monthly, or custom
- Extensions, cancellations, and real-time overdue tracking
- Calendar view of all bookings
- Extra charges: late fees, damage, fuel, cleaning, delivery, pickup, missing items

### Inspections
- Multi-step inspection wizard for both **handover** and **return**
- Meter readings, visual checklists (auto-populated by asset kind)
- Damage recording with a **visual body-map** for positioning markers
- Photo capture with before/after comparison
- Customer and staff **digital signatures**
- Configurable required fields based on org settings

### Payments & Deposits
- Record payments with multiple methods (cash, bank transfer, card, online)
- Deposit lifecycle: pending → held → returned/deducted/forfeited
- Itemized deductions with authorization thresholds
- Full payment and deposit audit trail

### Assets & Customers
- Detailed asset fleet with 25+ fields (brand, model, VIN, mileage, fuel, status, custom fields)
- Asset categories with **custom field definitions** (handles vehicles, generators, cameras, tools, etc.)
- Availability conflict detection
- Customer records with ID/license verification and emergency contacts

### Maintenance & Finance
- Scheduled and preventive maintenance with reminders
- Expense tracking with categories
- Monthly/ yearly budgets with threshold alerts
- Revenue and expense reports with **CSV export**

### Team & Permissions
- Six roles: **Owner, Admin, Manager, Staff, Inspector, Accountant**
- 24 fine-grained permissions
- Sidebar dynamically filters based on role
- Server-side permission enforcement on all actions

### Sharing & PDF
- **Public share links** with cryptographically random tokens (30-day expiry, revocable)
- Printable rental reports and inspection reports
- PDF generation for rental agreements and inspection reports
- Customer PII redacted in shared reports

### Security
- Rate-limited login (5 attempts per 15 minutes)
- Password validation (12+ chars, uppercase, lowercase, digit, special character)
- CSP headers, X-Frame-Options DENY, nosniff, strict referrer policy
- File upload validation (MIME type + magic byte verification)
- Org-scoped data isolation on every query
- Immutable audit log for all mutations

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, React Server Components) |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS 4, shadcn/ui, lucide-react icons |
| Database | PostgreSQL via Prisma 7 (`@prisma/adapter-pg`) |
| Auth | Auth.js / next-auth v5 (Credentials provider, JWT strategy) |
| Forms | react-hook-form + @hookform/resolvers + Zod 4 |
| Charts | Recharts 3 |
| PDF | @react-pdf/renderer |
| Testing | Vitest 4 |
| Linting | ESLint 9 (eslint-config-next) |
| Other | date-fns, sonner (toasts), next-themes, cmdk, clsx + tailwind-merge |

---

## Getting Started

### Prerequisites

- **Node.js** 18+ (20 recommended)
- **PostgreSQL** 14+
- **npm** (or yarn/pnpm)

### 1. Install dependencies

```bash
git clone https://github.com/hussainmurtaza786/proofica.git
cd proofica
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set the required variables:

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:password@localhost:5432/proofica` |
| `AUTH_SECRET` | JWT signing secret (generate with `npx auth secret`) | Random 32+ char string |
| `AUTH_TRUST_HOST` | Trust the host header | `true` |
| `NEXT_PUBLIC_APP_URL` | Public base URL for share links | `http://localhost:3000` |
| `STORAGE_PROVIDER` | File storage backend | `local` |
| `STORAGE_LOCAL_DIR` | Local disk folder for uploads | `./storage` |

See [Environment Variables](#environment-variables) for the full reference.

### 3. Set up the database

```bash
npm run db:push
```

This syncs the Prisma schema to your PostgreSQL database.

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and register your first organization.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest unit tests |
| `npm run db:push` | Push Prisma schema to the database |
| `npm run db:generate` | Regenerate the Prisma client |

---

## Project Structure

```
proofica/
├── prisma/
│   └── schema.prisma             # Database schema (30+ models)
│
├── public/                       # Static assets (SVG icons)
│
└── src/
    ├── middleware.ts              # Route protection middleware
    │
    ├── auth/
    │   └── auth.ts               # Auth.js config (Credentials provider, JWT, callbacks)
    │
    ├── types/
    │   └── next-auth.d.ts        # TypeScript augmentation for Session & JWT
    │
    ├── lib/                      # Shared utilities and pure business logic
    │   ├── constants.ts          # Enums, roles, permissions, RBAC matrix
    │   ├── validators.ts         # Zod schemas for all forms/actions
    │   ├── rental-math.ts        # Pure pricing, late fee, fuel, deposit math
    │   ├── pricing-preview.ts    # Browser-safe pricing preview
    │   ├── storage.ts            # File storage abstraction (local/S3)
    │   ├── decimal.ts            # Server-only Prisma.Decimal helpers
    │   ├── money.ts              # Browser-safe money formatting
    │   ├── dates.ts              # Date formatting utilities
    │   ├── custom-fields.ts      # Custom field definitions/parsing
    │   └── __tests__/            # Unit tests
    │
    ├── services/                 # Server-only business services
    │   ├── access.ts             # Auth/session, requireOrg(), requirePermission()
    │   ├── audit.ts              # Immutable audit log writer
    │   ├── notify.ts             # In-app notification service
    │   ├── settings.ts           # Organization settings read/write
    │   ├── counters.ts           # Sequential ID generators (R-00001, AST-00001)
    │   ├── dashboard.ts          # Dashboard data aggregation
    │   ├── availability.ts       # Asset availability conflict detection
    │   ├── status-sync.ts        # Background jobs (overdue, reminders, notifications)
    │   └── rental-report.ts      # Public rental report data assembly
    │
    ├── server/actions/           # Next.js Server Actions ("use server")
    │   ├── auth.ts               # Registration (user + org + default categories)
    │   ├── login.ts              # Login with rate limiting
    │   ├── rentals.ts            # Create, extend, cancel, add charges
    │   ├── payments.ts           # Record payments, finalize deposits
    │   ├── inspections.ts        # Multi-step inspection flow
    │   ├── assets.ts             # Assets, categories, status changes
    │   ├── customers.ts          # Customer CRUD
    │   ├── expenses.ts           # Expenses, budgets, maintenance
    │   ├── settings.ts           # Org, rules, currency, team settings
    │   ├── share.ts              # Create/revoke share links
    │   └── pdf.ts                # PDF data assembly
    │
    ├── components/
    │   ├── ui/                   # shadcn/ui primitives (28 components)
    │   ├── shared/               # App-wide components (FormField, SignaturePad, etc.)
    │   ├── layout/               # App shell, sidebar, header
    │   ├── dashboard/            # Charts, range picker
    │   ├── rentals/              # Rental forms, calendar, report
    │   ├── inspections/          # Inspection wizard, damage body-map
    │   ├── assets/               # Asset/category forms, filters
    │   ├── customers/            # Customer forms, search
    │   ├── payments/             # Payment filters
    │   ├── expenses/             # Expense form
    │   ├── budgets/              # Budget form
    │   ├── maintenance/          # Maintenance forms
    │   ├── settings/             # Settings forms
    │   └── pdf/                  # PDF layouts and download buttons
    │
    └── app/                      # Next.js App Router pages
        ├── (auth)/               # Login, register (split-screen layout)
        ├── (app)/                # Authenticated pages
        │   ├── dashboard/
        │   ├── rentals/          # List, new, calendar, overdue, [id], report, inspections
        │   ├── assets/           # List, new, categories, [id]
        │   ├── customers/        # List, new, [id], edit
        │   ├── inspections/
        │   ├── payments/
        │   ├── expenses/
        │   ├── budgets/
        │   ├── maintenance/
        │   ├── reports/
        │   ├── notifications/
        │   ├── settings/
        │   └── search/
        ├── share/[token]/        # Public rental report (no auth)
        └── api/
            ├── auth/             # Auth.js handler
            ├── upload/           # File upload endpoint
            ├── files/            # File serving endpoint
            └── reports/export/   # CSV export
```

---

## Architecture

### Multi-Tenancy

Every database query is scoped to an `Organization`. The `requireOrg()` function extracts the authenticated user's org from the JWT session. There is no cross-org data leakage — all queries include `WHERE orgId = ...`.

### Server Actions Over REST

All mutations use **Next.js Server Actions** rather than traditional REST endpoints. Forms submit directly to server-side functions. Only file upload, file serving, CSV export, and auth require traditional API routes.

### Separation of Concerns

| Layer | Location | Responsibility |
|---|---|---|
| **Pure logic** | `src/lib/` | Functions, types, constants, browser-safe utilities |
| **Business services** | `src/services/` | Server-only logic (marked `server-only`) |
| **Actions** | `src/server/actions/` | Orchestrate services + Prisma |
| **UI** | `src/components/` | React components (shadcn primitives, shared, domain-specific) |

### Role-Based Access Control

| Role | Permissions |
|---|---|
| **Owner** | Full access to all 24 permissions |
| **Admin** | All permissions except `manageBilling` |
| **Manager** | Assets, customers, rentals, inspections, damages, payments, deposits, expenses, maintenance, budgets, disputes |
| **Staff** | Create customers/rentals, perform inspections, record payments, manage maintenance |
| **Inspector** | Perform inspections, manage damages |
| **Accountant** | Record payments, manage expenses, view financials/reports |

The sidebar dynamically shows/hides navigation items based on role via `roleCanAccessModule()`. Server Actions enforce permissions via `requirePermission()`.

### Background Jobs

`status-sync.ts` runs on every authenticated page load. It detects:

- Overdue rentals
- Due-soon reminders
- Pending deposits
- Outstanding balances
- Document expiries
- Maintenance due dates

Creates notifications as needed. Structured to be moved to a cron job in production.

### Custom Fields

Asset categories can define custom field definitions (stored as JSON). Per-asset values are stored in their own JSON field. This allows the same schema to handle vehicles, generators, cameras, power tools, etc., without schema changes.

### File Storage

Files are stored on local disk by default with an abstracted `StorageProvider` interface designed for future S3 compatibility. Uploads are validated by MIME type **and** magic byte verification. Files are served through `/api/files/` with org-scoped authorization and path traversal protection.

---

## Database Schema

### Core Models

```
Organization ──┬── OrganizationMember ── User
               ├── AssetCategory ── Asset ── AssetPhoto / AssetDocument
               ├── Customer ── CustomerDocument
               ├── Rental ──┬── RentalCharge
               │             ├── RentalExtension
               │             ├── Payment
               │             └── Deposit ── DepositTransaction
               ├── Inspection ──┬── InspectionItem
               │                 ├── InspectionPhoto
               │                 ├── Damage
               │                 ├── Signature
               │                 └── Dispute
               ├── Expense / Budget / Maintenance
               ├── Notification
               ├── AuditLog
               ├── ShareLink
               └── OrganizationSetting
```

### Key Enums

| Enum | Values |
|---|---|
| Rental Status | draft, reserved, awaiting_handover, active, due_soon, overdue, returned, inspection_pending, completed, cancelled, disputed |
| Asset Status | available, reserved, rented, inspection, maintenance, damaged, lost, retired |
| Pricing Model | hourly, daily, weekly, monthly, custom |
| Payment Method | cash, bank_transfer, card, online, other |
| Deposit Status | pending, held, partially_returned, returned, deducted, forfeited |
| Charge Type | late, damage, fuel, mileage, cleaning, delivery, pickup, missing, custom |
| Damage Severity | cosmetic, minor, moderate, major, critical |

---

## Pricing & Business Rules

- **Billing** rounds to full units (`full_unit_per_period`) or calendar units — configurable per org in Settings → Rental Rules.
- **Late fees** apply after a configurable grace period, billed hourly or daily, with an optional cap.
- **Deposit refunds** deduct itemized approved charges; balance never goes below zero.
- **Fuel shortage** is priced per percent below the required return level.
- All monetary values use `Prisma.Decimal` (arbitrary precision) on the server.

---

## Inspection Flow

Inspections follow a **6-step wizard** for both handover and return:

1. **Meter Readings** — Odometer, hours, fuel level, battery
2. **Checklist** — Auto-populated by asset kind:
   - Vehicles: AC, headlights, brakes, tires, body condition
   - Generators: voltage, frequency, oil level, fuel filter
3. **Damages** — Record with severity, category, repair cost, position on visual body-map
4. **Photos** — Capture with categorized labels (exterior, interior, dashboard, damage close-up)
5. **Signatures** — Customer and staff digital signatures via canvas
6. **Complete** — Validates required fields based on org settings, creates audit entries

Before/after photo comparison is available for return inspections.

---

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/auth/[...nextauth]` | GET/POST | Auth.js session/sign-in/sign-out handler |
| `/api/upload` | POST | File upload with MIME type + magic byte validation |
| `/api/files/[...key]` | GET | Serve stored files with org-scoped auth |
| `/api/reports/export` | GET | CSV export of revenue or expenses |

All other mutations use **Server Actions** (see `src/server/actions/`).

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | — | JWT signing secret (min 32 chars in production) |
| `AUTH_TRUST_HOST` | No | `true` | Trust the `X-Forwarded-Host` header |
| `NEXT_PUBLIC_APP_URL` | Yes | `http://localhost:3000` | Public base URL (used for share links) |
| `STORAGE_PROVIDER` | No | `local` | File storage backend (`local` or `s3`) |
| `STORAGE_LOCAL_DIR` | No | `./storage` | Local disk folder for uploads |
| `STORAGE_ENDPOINT` | No | — | S3-compatible endpoint URL |
| `STORAGE_REGION` | No | — | S3 region |
| `STORAGE_BUCKET` | No | — | S3 bucket name |
| `STORAGE_ACCESS_KEY` | No | — | S3 access key |
| `STORAGE_SECRET_KEY` | No | — | S3 secret key |

---

## Testing

Run the full test suite:

```bash
npm run test
```

Tests cover:
- **Rental math** — pricing, late fees, fuel charges, deposit calculations
- **Permissions** — RBAC roles, module access control

Tests use Vitest and are located in `src/lib/__tests__/`.

---

## Deployment

### Production Build

```bash
npm run build
npm run start
```

### Security Headers

The following headers are configured in `next.config.ts`:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy` — strict policy with no frame ancestors

### Production Considerations

- Replace the in-memory rate limiter with Redis or a similar store
- Move background jobs (`status-sync.ts`) to a cron scheduler
- Use S3-compatible storage (`STORAGE_PROVIDER=s3`) for file uploads
- Set a strong `AUTH_SECRET` (generate with `npx auth secret`)
- Enable HTTPS and set the correct `NEXT_PUBLIC_APP_URL`
- Use a managed PostgreSQL service for production

---

## License

This project is private and proprietary.
