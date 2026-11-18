# Inventaria — Inventory & Point-of-Sale (public demo)

Multi-warehouse inventory and invoicing (POS) web app. This branch runs a
**public demo with 100% fictional data** — it is a portfolio instance of a
system originally built for a private company, rebranded and seeded with
invented warehouses, products and sales.

> 🧪 Public demo running on 100% fictional data.

## Try it

Sign in from the login page with either demo account:

| User         | Password    | Role                        |
|--------------|-------------|-----------------------------|
| `admin`      | `Demo1234!` | Full access (users, stock, reports) |
| `facturador` | `Demo1234!` | Invoicing only, 2 warehouses |

Everything is safe to touch — the demo database is isolated from any real
system and can be re-seeded at any time.

## Features

- **Roles & access control** — admin / invoicer / seller, enforced in
  Route Handlers and Postgres Row Level Security.
- **Multi-warehouse inventory** — each warehouse keeps its own products,
  prices and stock; staff can be assigned per warehouse.
- **POS with dual currency** — prices in USD converted to CUP with a
  manually-set daily rate; totals always recomputed server-side.
- **Atomic invoicing** — stock validation, invoice creation, stock decrease
  and movement logging in a single SQL transaction (row-level locking, so
  concurrent sales can never produce negative stock).
- **Stock movements** — entries, exits, transfers between warehouses
  (destination product auto-created by name) and adjustments.
- **Invoice lifecycle** — history, editing with stock reconciliation,
  soft delete with stock return, audit trail.
- **Thermal vouchers** — printable 58/80 mm receipts, saved before printing.
- **Reports** — sold-products report by period in both currencies
  (converted per invoice with its own rate), exported to PDF and Word.
- **Bulk inventory import** from Excel, PDF and Word files.

## Stack

| Layer     | Technology                                     |
|-----------|------------------------------------------------|
| Framework | Next.js 16 (App Router, Server Components)     |
| Database  | Supabase (PostgreSQL, RLS, SQL functions)      |
| Auth      | Supabase Auth with username-based login        |
| Language  | TypeScript strict mode                         |
| Styling   | Tailwind CSS 4, custom gold/black/ivory tokens |
| Exports   | pdf-lib, docx                                  |

## Local development (pointing at the DEMO database)

```bash
npm install
cp .env.local.example .env.local   # fill in the DEMO Supabase project keys
npm run dev                        # http://localhost:3000
```

To create the demo database locally or in a fresh Supabase project, run the
migrations in `supabase/migrations/` followed by `supabase/seed.sql`.

## Architecture notes

- Reads happen in Server Components via `lib/services/`; writes go through
  Route Handlers in `app/api/`.
- Every multi-row stock operation is a single Postgres function called with
  `rpc()` — supabase-js cannot span transactions, so atomicity lives in SQL.
- Invoices store snapshots (rate, user, warehouse, per-line prices) so later
  edits to products or rates never rewrite history.
- All amounts use integer-cent-safe rounding (`lib/money.ts`), all dates are
  cut and shown in `America/Havana`, stored in UTC.
- User-facing text is centralized in `lib/messages.ts` (Spanish UI, English
  code).

## Disclaimer

This is a demonstration build. The original system was developed for a
private company; names, brands, logos and all data here are fictional.
