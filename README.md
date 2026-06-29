<div align="center">

# Coffer

**A self-hosted personal finance manager for individuals and couples.**

Zero-based budgeting, savings pots, goals, investments, loans, and more — on a stack you own. Web app + Android client, one database.

[![Web CI](https://github.com/aneebbaig/coffer/actions/workflows/web-ci.yml/badge.svg)](../../actions/workflows/web-ci.yml)
[![Mobile CI](https://github.com/aneebbaig/coffer/actions/workflows/mobile-ci.yml/badge.svg)](../../actions/workflows/mobile-ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

---

Coffer is a private finance app you host yourself. It runs free on Vercel + Neon (Postgres), with an optional Android companion app that talks to the same backend over a REST API. Your data lives in **your** database — no third party, no subscription.

> Built originally as a household finance tracker for two people. Open-sourced so anyone can self-host the same thing.

## Features

| Area | What it does |
|---|---|
| **Dashboard** | Monthly summary, spending charts, budget progress, goals, today's tasks |
| **Expenses & Income** | Full transaction management with categories, tags, recurring; every expense declares a funding source |
| **Budget** | Zero-based monthly budget with category allocations, savings plan, email alerts |
| **Savings pots** | PKR/USD pots (Emergency, Liquid, General); deposits require a declared source; spending from a pot creates an expense |
| **Goals** | Savings goals with progress tracking and item checklists |
| **Investments** | Portfolio tracker (funds, stocks, gold, crypto, fixed deposits) |
| **Loans** | Track money lent/borrowed; settling a loan auto-creates a funded expense |
| **Tasks** | Daily habits + one-time tasks with drag-to-reorder priority and milestone checklists |
| **Projects** | Freelance/client project management — projects → tasks with statuses, priorities, due dates |
| **Planner** | Life-event planning (weddings, trips, renovations) |
| **Calendar** | Events, reminders, deadlines |
| **Lists** | Want List (48-hour impulse cooling-off) and Need List (prioritised purchases) |
| **Vault** | Private surprise/gift planner (admin only) |

Multi-currency (PKR/USD) with a daily auto-synced exchange rate. Two roles: **Super Admin** (full access) and **Admin**.

## Monorepo layout

```
coffer/
├── apps/
│   ├── web/      # Next.js + Prisma + Postgres — the app and the REST API
│   └── mobile/   # Flutter Android client (consumes /api/v1)
├── docs/
├── .github/workflows/   # path-filtered CI (web vs mobile)
├── ARCHITECTURE.md
├── CONTRIBUTING.md
├── SECURITY.md
└── LICENSE
```

The **web app is the source of truth** — it owns the database and exposes the REST API under `/api/v1` that the mobile client consumes. You can run web-only and never touch the mobile app.

## Quick start

**Web** (the app + API):

```bash
cd apps/web
cp .env.example .env.local      # fill in your Neon database URL + secrets
npm install
npx prisma migrate dev          # create tables
npm run seed                    # create your user(s)
npm run dev                     # → http://localhost:3000
```

You need a free [Neon](https://neon.tech) Postgres database. Full walkthrough: [`apps/web/README.md`](apps/web/README.md) · Deployment: [`apps/web/DEPLOYMENT.md`](apps/web/DEPLOYMENT.md).

**Mobile** (optional Android client):

```bash
cd apps/mobile
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter run --dart-define=API_BASE_URL=https://your-coffer-instance.com/api/v1
```

Details: [`apps/mobile/README.md`](apps/mobile/README.md).

## Tech stack

- **Web:** Next.js 16, React 19, Prisma 7, PostgreSQL (Neon), NextAuth v5, Tailwind CSS v4
- **Mobile:** Flutter, Riverpod, GoRouter, Dio — clean-architecture vertical slices
- **Hosting:** Vercel + Neon (both have free tiers)

## Documentation

- [Architecture & money-flow rules](ARCHITECTURE.md) — read this before changing financial logic
- [Contributing guide](CONTRIBUTING.md) — dev setup, conventions, PR process
- [Security policy](SECURITY.md) — how to report a vulnerability

## License

[MIT](LICENSE) — do what you like, no warranty.
