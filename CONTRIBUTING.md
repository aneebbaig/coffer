# Contributing

Thanks for taking a look. This is a monorepo with two apps that share one backend, so read whichever part your change touches.

`apps/web` is the Next.js app and also the REST API under `/api/v1`. It owns the database. `apps/mobile` is the Flutter client that talks to that API with a bearer token. If you change the shape of an API response, you usually need to touch both apps in the same PR.

## Getting the web app running

You need Node 20 or newer, [pnpm](https://pnpm.io) (the pinned version is in `apps/web/package.json`'s `packageManager` field), and a Postgres database. A free Neon branch is the easiest way to get one.

```bash
cd apps/web
cp .env.example .env.local     # fill in DATABASE_URL, AUTH_SECRET, etc.
pnpm install
pnpm exec prisma migrate dev
pnpm seed
pnpm dev
```

One thing to watch out for: this targets a recent Next.js where route handler `params` are async. So handlers look like `{ params }: { params: Promise<{ id: string }> }` and you have to `await params`. If something about routing surprises you, copy an existing handler in `src/app/api/v1/` instead of guessing, and check the docs bundled under `node_modules/next/dist/docs/`.

Before you push, run the same checks CI runs:

```bash
pnpm exec tsc --noEmit
pnpm run lint
pnpm test
pnpm run build
```

## Getting the mobile app running

You need the Flutter SDK (the Dart version is pinned in `apps/mobile/pubspec.yaml`) and the Android toolchain.

```bash
cd apps/mobile
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter analyze
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1
```

`10.0.2.2` is how the Android emulator reaches localhost on your machine. Re-run `build_runner` any time you change a provider, model, or annotation.

A few conventions the mobile code sticks to:

- No barrel files. Import the specific file.
- Use the `App*` widgets in `core/widgets/` (`AppCard`, `AppButton`, and so on) instead of raw Flutter widgets in feature code.
- Nothing hardcoded: API base comes from `--dart-define`, colours from `AppColors`, text styles from `AppTextStyles`.
- In async notifiers, catch and rethrow by hand. Don't use `AsyncValue.guard`, it swallows the error.
- For CRUD mutations in a page, call the datasource directly with a local loading flag rather than going through a mutation notifier. There's an auto-dispose quirk that otherwise fires a false error toast. Existing pages show the pattern.
- Money is always an `int` in paisas (the currency times 100). Never a double.

## Sending a change

Branch off `main`, make the change, run the checks above, and open a PR with the template. Keep it to one thing. Update the docs if you changed how something behaves, and don't commit secrets. Only `.env.example` is tracked; the real `.env` files are ignored.

For anything security-related, don't open a public issue. See [SECURITY.md](SECURITY.md).
