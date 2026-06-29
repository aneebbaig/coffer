# Architecture

Coffer is a monorepo: a Next.js web app that owns the data and exposes a REST API, plus a Flutter Android client that consumes it.

```
┌─────────────┐      REST /api/v1 (Bearer)      ┌──────────────┐
│  Flutter    │ ──────────────────────────────▶ │  Next.js     │
│  Android    │                                  │  web + API   │
└─────────────┘                                  └──────┬───────┘
                                                         │ Prisma
                                                  ┌──────▼───────┐
                                                  │  PostgreSQL  │
                                                  │   (Neon)     │
                                                  └──────────────┘
```

The web app renders the UI **and** serves the API. The mobile app is a pure client — it has no database and stores only an auth token (in the Android keystore).

## Web (`apps/web`)

Next.js App Router. Key directories:

- `src/app/(app)/` — authenticated pages (server components fetch via server actions, render client components)
- `src/app/api/v1/` — REST API for the mobile client (Bearer auth via `requireBearerAuth`)
- `src/app/api/auth/`, `src/app/api/cron/` — session auth and the daily email-digest cron
- `src/actions/` — server actions (the web UI's data layer); each scopes queries by the session `userId`
- `src/components/` — UI, grouped by feature; shared primitives in `components/ui` and `components/shared`
- `src/lib/` — `prisma`, `session`/`tokens` (auth), `v1-auth`, `utils`, `constants`
- `prisma/` — schema + migrations + seed

**Auth.** Web pages use cookie-based session tokens (`getUserId()` / `requireUser()`); the v1 API uses `Authorization: Bearer <token>` (`requireBearerAuth`). Both verify the same signed access token.

> **Not the Next.js you may remember.** Route handler `params` are async — `{ params }: { params: Promise<{ id: string }> }` — and you must `await params`. Mirror the existing handlers in `src/app/api/v1/`. Bundled docs live under `node_modules/next/dist/docs/`.

### Money-flow invariants (read before touching financial logic)

Coffer enforces a strict zero-based model — money cannot enter or leave a bucket without a declared source.

- **Income** enters only through the Income page and increases that month's "Ready to Assign".
- **Every expense** is funded from a real source: monthly income or a savings pot. Pot-funded expenses atomically deduct from the pot and write a pot ledger entry. Editing/deleting a pot-funded expense reverses the prior movement first.
- **Savings pots** hold PKR and USD independently. Deposits require a declared source (income or a transfer from another pot) and are validated against available income. Transfers are atomic (deduct + credit in one transaction). There is no standalone "withdraw" — you spend from a pot by creating an expense funded by it.
- **Income deletion is blocked** if that month's income-funded expenses + income-funded pot deposits would exceed the remaining income (PKR and USD checked separately).
- **Amounts are integers in the smallest unit** ("paisas" = currency × 100). Never store floating-point money.
- USD↔PKR rate is auto-synced daily from a free public endpoint, and can be set manually.

### Database

Prisma + PostgreSQL. Migrations are hand-reviewed SQL in `prisma/migrations/`. Run `prisma migrate dev` locally; production uses `prisma migrate deploy` (see `apps/web/DEPLOYMENT.md`). Models are documented inline in `prisma/schema.prisma`.

## Mobile (`apps/mobile`)

Flutter with clean-architecture vertical slices. Each feature under `lib/features/<name>/`:

```
data/datasources/    Dio calls, return models/entities
data/models/         @freezed + fromJson
data/repositories/   implement domain interfaces
domain/entities/     pure Dart
domain/repositories/ abstract interfaces
presentation/pages/
presentation/providers/   @riverpod codegen
presentation/widgets/
```

- **State:** Riverpod 3 codegen. Read providers (`FutureProvider`) for lists/detail; mutations call the datasource directly from page code (see the auto-dispose note in [CONTRIBUTING.md](CONTRIBUTING.md)).
- **Networking:** Dio `ApiClient` with an `AuthInterceptor` (injects Bearer token; 401 → logout) and debug logging.
- **Navigation:** GoRouter with a `/splash` auth gate and `pendingLink` deep-link handling.
- **Core:** shared widgets (`App*`), theme tokens (`AppColors`, `AppTextStyles`), extensions (currency, dates, Lucide-name → icon), and services (toast, storage, connectivity).

## API contract

The mobile client depends on `/api/v1`. When you change an endpoint's shape, update both the route handler in `apps/web/src/app/api/v1/` and the corresponding `*_datasource.dart` in `apps/mobile/lib/features/`. Responses are envelopes: `{ "data": ... }` on success, `{ "error": "..." }` with an HTTP status on failure.
