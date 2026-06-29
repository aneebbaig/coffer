# Contributing to Coffer

Thanks for your interest in improving Coffer. This is a monorepo with two apps that share one backend — read the bit relevant to your change.

## Repository layout

- `apps/web` — Next.js app **and** the REST API (`/api/v1`). Owns the database (Prisma + Postgres).
- `apps/mobile` — Flutter Android client. Talks to the web API over Bearer-token auth.

A change to the API contract usually touches both apps in the same PR.

## Prerequisites

- **Web:** Node.js ≥ 20, a Postgres database (a free [Neon](https://neon.tech) branch is easiest)
- **Mobile:** Flutter SDK (see `apps/mobile/pubspec.yaml` for the pinned Dart SDK), Android toolchain

## Web setup

```bash
cd apps/web
cp .env.example .env.local      # fill DATABASE_URL, AUTH_SECRET, etc.
npm install
npx prisma migrate dev          # apply migrations to your dev database
npm run seed                    # seed your user(s)
npm run dev
```

> **Heads up — this is not stock Next.js behaviour you may remember.** This project targets a recent Next.js where route handler `params` are async (`{ params }: { params: Promise<{ id: string }> }`) and several conventions differ from older majors. When in doubt, read the bundled docs under `apps/web/node_modules/next/dist/docs/` and mirror the existing route/handler patterns rather than assuming.

Before pushing:

```bash
npx tsc --noEmit     # type-check
npm run build        # production build
npx eslint .         # lint
```

## Mobile setup

```bash
cd apps/mobile
flutter pub get
dart run build_runner build --delete-conflicting-outputs   # codegen (Riverpod, Freezed, json)
flutter analyze
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1   # emulator → host localhost
```

Re-run `build_runner` after changing any provider, model, or annotation.

### Mobile conventions (please follow)

- **No barrel files** — import the specific file path.
- **Custom widgets** — use the `App*` widgets in `core/widgets/` (`AppCard`, `AppButton`, `AppBadge`, …) rather than raw Flutter widgets in feature code.
- **No hardcoding** — API base via `--dart-define=API_BASE_URL`, colours via `AppColors`, text via `AppTextStyles`.
- **Manual `try/catch + rethrow`** in async notifiers — never `AsyncValue.guard` (it swallows exceptions).
- **CRUD mutations bypass mutation notifiers** in page code (call the datasource directly with a local `_loading` flag) — see existing pages. This avoids a known auto-dispose double-toast bug.
- Monetary values are `int` **paisas** (currency × 100). Never `double`.

## Coding standards

- Match the surrounding code's style, naming, and comment density.
- Keep PRs focused. One feature/fix per PR.
- Update docs when you change behaviour.
- Don't commit secrets. `.env*` files are gitignored; only `.env.example` is tracked.

## Commit & PR process

1. Branch off `main`.
2. Make your change; run the relevant checks above (CI runs them too).
3. Open a PR using the template. Describe what and why; link any issue.
4. CI must be green before merge.

## Reporting bugs / requesting features

Use the GitHub issue templates. For security issues, **do not** open a public issue — see [SECURITY.md](SECURITY.md).
