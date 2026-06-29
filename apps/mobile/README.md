# Coffer Management — Android App

Flutter Android companion app for the Coffer personal finance platform ([your-coffer-instance.com](https://your-coffer-instance.com)). Distributed via [Obtainium](https://github.com/ImranR98/Obtainium) from this private GitHub repo — no Play Store.

---

## Table of Contents

1. [What the App Does](#what-the-app-does)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Clean Architecture](#clean-architecture)
5. [Key Patterns & Conventions](#key-patterns--conventions)
6. [State Management — Riverpod](#state-management--riverpod)
7. [Navigation — GoRouter](#navigation--gorouter)
8. [HTTP Client — Dio](#http-client--dio)
9. [Design System](#design-system)
10. [Icons](#icons)
11. [Constants & Extensions](#constants--extensions)
12. [Home Screen Widget](#home-screen-widget)
13. [Deep Links](#deep-links)
14. [Running Locally](#running-locally)
15. [Release / Deployment](#release--deployment)
16. [CI Pipeline](#ci-pipeline)
17. [Adding a New Feature](#adding-a-new-feature)
18. [Known Gotchas](#known-gotchas)

---

## What the App Does

Mobile companion to the Coffer web app. All data lives on the server — the app is a client-only read/write layer.

| Screen | Purpose |
|--------|---------|
| Dashboard | Budget summary, income vs spend bar, recent transactions, "See All" → `/money` |
| Expenses | Paginated list of current-period expenses with pull-to-refresh |
| Income | Income transactions for current period |
| Quick Add (Expense) | `/quick-add` — amount, category, description, notes, date; modal, outside ShellRoute |
| Quick Add (Income) | `/quick-add-income` — income-category, amount, description, date |
| Quick Add (Task) | `/quick-add-task` — title, priority, due date |
| Quick Add (Loan) | `/quick-add-loan` — person name, GIVEN/RECEIVED, amount, dates |
| Budget | Per-category budget allocations with progress bars |
| Savings | Savings pots with targets and progress |
| Loans | Active loans; explicit "Record Payment" button per card; `RecordPaymentPage` pre-fills remaining balance |
| Tasks | Daily / One-Time / Milestone tabs; optimistic toggle + item check; milestone inline checklist with "Add step" |
| Settings | App version (matches git tag), logout |
| Projects *(planned)* | Freelance/client project list and per-project task management — see `## Planned: Projects` below |

**Home screen widget** (4-button, responsive): Expense · Tasks · Loans · Income shortcuts. Row layout at wide widths, 2×2 grid at narrow. Tapping deep-links to the corresponding page or quick-add modal.

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Flutter | 3.44.4 (FVM, pinned) | Cross-platform; FVM pins exact version for CI reproducibility |
| Dart | 3.12.2 | Null-safe, strong types |
| State | Riverpod 3.x codegen | Compile-safe providers, no Provider/BLoC boilerplate |
| Navigation | GoRouter 17.x | Deep link support, shell routes, redirect-based auth gate |
| HTTP | Dio 5.x | Interceptors for auth injection + structured error handling |
| Auth storage | `flutter_secure_storage` | Android Keystore-backed AES-GCM encryption |
| Models | `freezed` + `json_serializable` | Immutable value objects, JSON codegen |
| Home widget | `home_widget` | Kotlin bridge for Android app widgets |
| Icons | Material Icons (mapped from Lucide names) | Web app stores Lucide string names in DB |
| Fonts | Outfit Variable (bundled) | No Google Fonts CDN at runtime |
| Toasts | `toastification` | Consistent short error/success messages |

**All Flutter/Dart CLI commands use `fvm` prefix** — e.g. `fvm flutter run`, `fvm dart run build_runner build`.

---

## Project Structure

```
lib/
├── main.dart                      # Entry point: ProviderScope wraps app
├── app.dart                       # GoRouter definition + CofferApp MaterialApp
├── app.g.dart                     # Codegen output
├── shell/
│   └── app_scaffold.dart          # Bottom-nav ShellRoute scaffold
│
├── core/                          # No feature logic — shared infrastructure
│   ├── constants/
│   │   ├── api_constants.dart     # Every API path string in one place
│   │   ├── app_constants.dart     # App-level constants
│   │   └── storage_keys.dart      # Keys for flutter_secure_storage
│   │
│   ├── errors/
│   │   ├── app_exception.dart     # Sealed class: AuthException, NetworkException, etc.
│   │   ├── error_handler.dart     # Maps Dio DioException → AppException
│   │   └── failure.dart           # UI-facing failure value object
│   │
│   ├── extensions/                # Dart extensions instead of utility functions
│   │   ├── async_value_ext.dart
│   │   ├── currency_ext.dart      # int.formatPKR(), double.toPaisas, String.parsePaisas
│   │   ├── datetime_ext.dart      # DateTime.toRelativeDay, isSameDay
│   │   └── lucide_ext.dart        # String.lucideIcon → IconData (Material)
│   │                               # String.toEmoji → emoji for Android widget
│   │
│   ├── network/
│   │   ├── api_client.dart        # Dio instance as Riverpod provider; base URL from --dart-define
│   │   └── interceptors/
│   │       ├── auth_interceptor.dart   # QueuedInterceptorsWrapper: inject token; 401 → logout
│   │       └── log_interceptor.dart    # Coloured request/response logging (debug only)
│   │
│   ├── services/
│   │   ├── connectivity_service.dart   # connectivity_plus wrapper
│   │   ├── storage_service.dart        # flutter_secure_storage wrapper (read/write/delete)
│   │   └── toast_service.dart          # success(ctx, msg) / error(ctx, msg) via toastification
│   │
│   ├── theme/
│   │   ├── app_colors.dart        # Colour palette — single source of truth
│   │   ├── app_text_styles.dart   # Typography scale using Outfit font
│   │   └── app_theme.dart         # ThemeData (dark only)
│   │
│   └── widgets/                   # Shared UI primitives — always use these, not raw Flutter widgets
│       ├── app_badge.dart         # Pill badge (neutral/success/warning/destructive variants)
│       ├── app_button.dart        # Primary/secondary/text button
│       ├── app_card.dart          # Rounded card container
│       ├── app_divider.dart
│       ├── app_empty_state.dart   # Icon + message + optional retry callback
│       ├── app_icon_box.dart      # Icon avatar: takes IconData OR emoji string
│       ├── app_list_row.dart      # Leading icon + title + subtitle + trailing
│       ├── app_progress_bar.dart  # Thin progress bar (0.0–1.0)
│       ├── app_section.dart       # Section header wrapper
│       ├── app_skeleton.dart      # Loading placeholder shimmer
│       ├── app_text_field.dart    # Styled text input
│       ├── async_value_widget.dart # AsyncValue<T> → data/loading/error widget
│       ├── error_view.dart
│       └── loading_overlay.dart
│
└── features/                      # One folder per vertical slice
    ├── auth/
    ├── budget/
    ├── dashboard/
    ├── expenses/
    ├── home_widget/               # Flutter side of Android widget (WidgetService)
    ├── income/
    ├── loans/
    ├── savings/
    └── settings/

android/
├── app/
│   ├── build.gradle.kts           # Release signing config; R8 minify+shrink enabled
│   ├── keystore.jks               # NEVER commit — local only / CI secret
│   └── src/main/
│       ├── AndroidManifest.xml    # INTERNET, ACCESS_NETWORK_STATE, deep link filter, widget receiver
│       ├── kotlin/.../
│       │   └── QuickExpenseWidgetProvider.kt   # AppWidgetProvider Kotlin impl
│       └── res/
│           ├── layout/quick_expense_widget.xml
│           ├── drawable/widget_background.xml
│           ├── drawable/widget_chip_bg.xml
│           ├── xml/quick_expense_widget_info.xml
│           └── values/colors.xml, strings.xml, styles.xml
│
└── gradle/wrapper/gradle-wrapper.properties    # Gradle 8.14

assets/
├── fonts/Outfit-Variable.ttf
└── images/logo.svg, logo.png

.github/workflows/release.yml      # CI: build + sign + release APK on git tag
```

---

## Clean Architecture

Every feature follows **vertical slice clean architecture** with three layers:

```
features/<name>/
├── data/
│   ├── datasources/    # Network calls via Dio — single responsibility
│   ├── models/         # Freezed + JSON models (extend domain entities with fromJson/toJson)
│   └── repositories/   # Implement domain interface; map model → entity
├── domain/
│   ├── entities/       # Pure Dart value objects — no JSON, no framework imports
│   ├── repositories/   # Abstract interface (the contract)
│   └── usecases/       # Optional; used when business logic > 1 step
└── presentation/
    ├── pages/          # Screen widgets (ConsumerWidget or ConsumerStatefulWidget)
    ├── providers/      # Riverpod providers (codegen)
    └── widgets/        # Feature-scoped UI components
```

### Data layer

Datasources make raw HTTP calls and return models. Repositories transform models into entities and implement the domain interface. This decoupling means the UI never imports `dio` directly — it only ever touches domain entities.

```dart
// Datasource — raw API call
class ExpenseRemoteDatasource {
  Future<String> createExpense({...}) async {
    final res = await _dio.post(ApiConstants.expenses, data: {...});
    return (res.data['data'] as Map)['id'] as String;
  }
}

// Repository — wraps datasource, implements domain contract
class ExpenseRepositoryImpl implements ExpenseRepository {
  Future<String> createExpense({...}) =>
      _datasource.createExpense(...);
}
```

### Domain layer

Entities are plain Dart classes with no framework deps. Repository interfaces are abstract classes. Usecases exist only when there's meaningful business logic to isolate (most simple CRUD features skip them).

### Presentation layer

Pages use `ref.watch()` for reactive state and `ref.read()` for one-shot actions. Providers use codegen — never manual `StateProvider` or `ChangeNotifierProvider`.

---

## Key Patterns & Conventions

### No barrel files
Always import the specific file:
```dart
// Correct
import '../../../../core/theme/app_colors.dart';

// Never do this
import '../../../../core/index.dart';
```

### Extensions over utils
Logic that operates on a type belongs as an extension on that type:
```dart
// Extension (correct)
extension CurrencyInt on int {
  String formatPKR() => 'Rs ${_pkrFmt.format(this ~/ 100)}';
}

// Avoid static utility class
class CurrencyUtils {
  static String formatPKR(int paisas) => ...;
}
```

### Custom widgets over raw Flutter widgets
All UI elements use `AppCard`, `AppButton`, `AppIconBox` etc. Raw `Container`, `ElevatedButton`, `Card` are never used in feature code. This ensures the design system is applied consistently and can be changed in one place.

### Amounts always in paisas
All monetary values are `int` representing paisas (₨ × 100). Never `double`. Never store rupees.

```dart
final paisas = (rupeesDouble * 100).round();  // toPaisas extension
final formatted = paisas.formatPKR();          // "Rs 1,500"
```

### Error handling
```dart
// Correct — errors propagate to UI
try {
  final result = await repo.doSomething();
  state = AsyncData(result);
} catch (e, st) {
  state = AsyncError(e, st);
  rethrow;
}

// WRONG — silently swallows exceptions
state = await AsyncValue.guard(() => repo.doSomething());
```

### Short, meaningful toasts only
Never dump raw exception messages or stack traces on the UI. Every error goes through `ErrorHandler.handle(e)` which maps it to a typed `AppException` with a short user-facing message.

---

## State Management — Riverpod

### Codegen syntax

```dart
// Async data provider (auto-disposed)
@riverpod
Future<List<ExpenseEntity>> expensesList(Ref ref) async {
  return ref.watch(expenseRepositoryProvider).getExpenses();
}

// State machine (class notifier)
@riverpod
class CreateExpense extends _$CreateExpense {
  @override
  AsyncValue<String?> build() => const AsyncData(null);

  Future<String?> submit({required int amountPaisas, ...}) async {
    state = const AsyncLoading();
    try {
      final id = await ref.read(expenseRepositoryProvider).createExpense(...);
      state = AsyncData(id);
      return id;
    } catch (e, st) {
      state = AsyncError(e, st);
      rethrow;
    }
  }
}

// Keep-alive singleton (services)
@Riverpod(keepAlive: true)
WidgetService widgetService(Ref ref) => WidgetService();
```

### RouterNotifier

`RouterNotifier` is a special `AsyncNotifier<bool>` that implements `Listenable`. GoRouter uses it as `refreshListenable`. When auth state changes, the router re-evaluates its redirect.

`Future.microtask(() => _routerListener?.call())` defers the GoRouter notification until after Riverpod has committed the new state — calling it synchronously during `build()` would fire GoRouter before state is updated.

---

## Navigation — GoRouter

Routes defined in `lib/app.dart`:

| Path | Screen | Notes |
|------|--------|-------|
| `/splash` | SplashPage | Initial location; shown during auth check |
| `/login` | LoginPage | |
| `/dashboard` | DashboardPage | Inside ShellRoute (bottom nav) |
| `/expenses` | ExpensesListPage | Inside ShellRoute |
| `/income` | IncomeListPage | Inside ShellRoute |
| `/budget` | BudgetPage | Inside ShellRoute |
| `/savings` | SavingsPage | Inside ShellRoute |
| `/loans` | LoansPage | Inside ShellRoute |
| `/settings` | SettingsPage | Inside ShellRoute |
| `/quick-add` | QuickAddExpensePage | Top-level modal (outside ShellRoute, no bottom nav) |

Auth redirect logic in GoRouter:
1. If URI scheme is `coffer://` → strip scheme, convert to path
2. While auth loading → stay on `/splash`
3. Not authenticated + not on login → redirect to `/login`
4. Authenticated + on login or splash → redirect to `/dashboard`

---

## HTTP Client — Dio

`ApiClient` (Riverpod `keepAlive` provider) provides the configured `Dio` instance:

- `baseUrl` from `--dart-define=API_BASE_URL` compile-time constant
- `connectTimeout` / `receiveTimeout` / `sendTimeout` set
- `AuthInterceptor` using `QueuedInterceptorsWrapper`:
  - Reads Bearer token from `flutter_secure_storage`
  - Injects `Authorization: Bearer <token>` on every request
  - On 401 response: clears token from storage + triggers auth provider logout
- `LogInterceptor`: coloured request/response logging in debug builds only

Error mapping (`error_handler.dart`):
- `DioExceptionType.connectionError` → `NetworkException`
- HTTP 401 → `AuthException`
- HTTP 404 → `NotFoundException`
- HTTP 422 / 400 → `ValidationException` (parses server message)
- HTTP 5xx → `ServerException`
- All others → `UnknownException`

---

## Design System

Single source of truth in `lib/core/theme/`.

### Colours (`AppColors`)

| Token | Hex | Usage |
|-------|-----|-------|
| `background` | `#0A0A0A` | Page backgrounds |
| `card` | `#141414` | Cards, inputs |
| `border` | `#262626` | Borders, dividers |
| `foreground` | `#FAFAFA` | Primary text |
| `mutedForeground` | `#737373` | Secondary text, placeholders |
| `primary` | `#F59E0B` | Amber — CTAs, highlights, active states |
| `destructive` | `#EF4444` | Errors, delete actions |

### Typography (`AppTextStyles`)

All styles use **Outfit Variable** font (bundled in `assets/fonts/`).

| Style | Use |
|-------|-----|
| `displayLarge` | Amount display (Quick Add amount field) |
| `headlineMedium` | Page section headers |
| `headlineSmall` | AppBar titles |
| `bodyLarge` | Primary body text |
| `bodyMedium` | Secondary body, form labels |
| `bodySmall` | Captions, metadata |
| `labelLarge` | Buttons |
| `labelMedium` | Chips, badges |
| `labelSmall` | Date group headers |
| `currencySmall/Medium/Large` | Monetary amounts |

### Shared widgets

Always use these — never raw Flutter equivalents:

| Widget | Replaces |
|--------|---------|
| `AppCard` | `Card` / raw `Container` |
| `AppButton` | `ElevatedButton` / `TextButton` |
| `AppIconBox` | Manual icon containers |
| `AppBadge` | `Chip` |
| `AppListRow` | `ListTile` |
| `AppEmptyState` | Custom empty state code |
| `AppProgressBar` | `LinearProgressIndicator` |
| `AppTextField` | Raw `TextField` |

---

## Icons

The web app stores **Lucide icon names** as strings in the database (e.g. `"Utensils"`, `"Car"`, `"BookOpen"`). Flutter can't use Lucide directly, so icons are mapped at render time.

**`lib/core/extensions/lucide_ext.dart`** has two extensions:

```dart
// For in-app UI — maps to Material IconData
category.icon.lucideIcon  // → Icons.restaurant

// For Android widget RemoteViews — maps to emoji string
category.icon.toEmoji     // → "🍽"
```

When a new category with an unmapped icon appears, add the mapping to both extensions in `lucide_ext.dart`.

---

## Constants & Extensions

### Constants

| File | Contains |
|------|---------|
| `api_constants.dart` | All endpoint paths as `static const String` |
| `app_constants.dart` | App-wide constants (pagination limits etc.) |
| `storage_keys.dart` | Keys used with `flutter_secure_storage` |

Never hardcode strings in feature code — always reference a constant.

### Extensions

Extensions are preferred over utility classes or standalone functions. They live in `core/extensions/`:

| Extension | On type | Provides |
|-----------|---------|---------|
| `CurrencyInt` | `int` | `formatPKR()`, `formatPKRCompact()`, `toRupees` |
| `CurrencyDouble` | `double` | `toPaisas` |
| `CurrencyString` | `String` | `parsePaisas` |
| `LucideIconEmoji` | `String` | `toEmoji` |
| `LucideIconName` | `String` | `lucideIcon` |
| `DateTimeExt` | `DateTime` | `toRelativeDay`, `isSameDay` |

---

## Home Screen Widget

Android 3×2 app widget — quick access without opening the app.

### Flutter side (`lib/features/home_widget/widget_service.dart`)

`WidgetService.update()` is called after every expense creation:
1. Saves `today_spend` (formatted string) to `HomeWidgetPlugin` SharedPreferences
2. Saves `cat_1_icon`, `cat_1_name` ... `cat_3_*` using the **emoji** value (not Lucide name)
3. Calls `HomeWidget.updateWidget()` to trigger Android redraw

### Kotlin side (`QuickExpenseWidgetProvider.kt`)

- `onUpdate()` wraps `updateWidget()` in try/catch — prevents "can't load widget" error banner on crash
- Reads SharedPreferences via `HomeWidgetPlugin.getData(context)`
- Sets text on RemoteViews text views
- Sets `PendingIntent` on each category card → deep link `coffer://quick-add?category=<name>`
- Request codes use `.and(0x7FFFFFFF)` to ensure non-negative

### Widget XML (`quick_expense_widget.xml`)

Critical constraint: **`<View>` is banned in RemoteViews on Android API 31+** (Pixel 7a runs API 37). Use `<TextView>` for dividers:
```xml
<!-- Divider: TextView not View — View is banned in RemoteViews on API 31+ -->
<TextView
    android:layout_width="match_parent"
    android:layout_height="1dp"
    android:background="#22FFFFFF" />
```

---

## Deep Links

Custom URI scheme: `coffer://`

| URI | Effect |
|-----|--------|
| `coffer://quick-add?category=<name>` | Opens Quick Add with category pre-selected |

Registered in `AndroidManifest.xml` intent-filter with `android:scheme="coffer"` and `android:category.BROWSABLE`.

GoRouter redirect strips the scheme and maps host → path:
```dart
// coffer://quick-add?category=Food → /quick-add?category=Food
// URI parser: scheme=coffer, host=quick-add, query=category=Food
if (state.uri.scheme == 'coffer') {
  final host = state.uri.host;
  final query = state.uri.hasQuery ? '?${state.uri.query}' : '';
  return '/$host$query';
}
```

`QuickAddExpensePage` reads `state.uri.queryParameters['category']` to pre-select the category.

---

## Running Locally

### Prerequisites

```bash
brew install fvm
fvm install 3.44.4
fvm use 3.44.4
```

### Run on device

```bash
fvm flutter pub get
fvm dart run build_runner build --delete-conflicting-outputs
fvm flutter devices
fvm flutter run -d <device-id> --dart-define=API_BASE_URL=https://your-coffer-instance.com/api/v1
```

### Keystore setup (one-time, local release builds)

```bash
keytool -genkey -v -keystore android/app/keystore.jks \
  -alias coffer -keyalg RSA -keysize 2048 -validity 10000
```

Create `android/key.properties` (never commit):
```
storePassword=<password>
keyPassword=<password>
keyAlias=coffer
storeFile=keystore.jks
```

Local release build:
```bash
fvm flutter build apk --release \
  --dart-define=API_BASE_URL=https://your-coffer-instance.com/api/v1 \
  --target-platform android-arm64
```

---

## Release / Deployment

No Play Store — distributed via **Obtainium** from this private GitHub repo.

### Tag a release

```bash
git tag v1.x.y && git push origin v1.x.y
```

CI builds the signed APK, creates a GitHub Release. Obtainium on the Pixel detects it and prompts update.

### Obtainium configuration (Pixel 7a)

- Source type: GitHub
- Repo: `https://github.com/your-username/coffer-management-app`
- Auth: Personal Access Token (from `gh auth token`) in source-specific settings
- APK filter: `app-release.apk`

### GitHub Secrets

| Secret | Value |
|--------|-------|
| `KEYSTORE_BASE64` | `base64 -i android/app/keystore.jks` |
| `STORE_PASSWORD` | Keystore password |
| `KEY_PASSWORD` | Key password |
| `KEY_ALIAS` | `coffer` |
| `API_BASE_URL` | `https://your-coffer-instance.com/api/v1` |

---

## CI Pipeline

File: `.github/workflows/release.yml` — triggers on `v*` tags only.

```
Checkout
  ↓
Java 17 (Temurin) + Gradle cache
  ↓
Flutter 3.44.4 (pinned, cached — stable cache key)
  ↓
Pub package cache restore (key: pubspec.lock hash)
  ↓
Android SDK CMake 3.22.1 cache restore
  ↓
flutter pub get
  ↓
dart run build_runner (codegen)
  ↓
Decode keystore.jks from KEYSTORE_BASE64 secret
  ↓
Write key.properties from secrets
  ↓
flutter build apk --release
  --no-pub
  --target-platform android-arm64   ← arm64 only; saves ~40% AOT time
  --obfuscate
  --split-debug-info=build/debug-symbols
  ↓
Create GitHub Release + upload APK
```

Build time: ~5–8 min warm caches, ~12 min cold.

---

## Adding a New Feature

1. Create `lib/features/<name>/` with full layer structure
2. Datasource: `@riverpod` annotated class making Dio calls
3. Model: `@freezed` class with `fromJson`; domain entity without JSON
4. Repository: abstract interface in domain, impl in data
5. Providers: `@riverpod` in presentation/providers/
6. Page: `ConsumerWidget` or `ConsumerStatefulWidget`
7. Add route to `lib/app.dart` `routes` list
8. Add bottom-nav entry in `lib/shell/app_scaffold.dart` if it needs a tab
9. Run codegen: `fvm dart run build_runner build --delete-conflicting-outputs`
10. If feature has categories with icons, add any new Lucide names to `lucide_ext.dart`

---

## Planned: Projects (Freelance PM)

**Status: NOT YET BUILT.** Web app is built first (one migration, one feature branch); mobile follows with its own feature slice.

### Why

Milestone tasks were being used for freelance/client project tracking but are fundamentally wrong for it: items are a JSON blob (no per-item due dates/priority/status), "project" is just a freetext `category` string, and client work is mixed with personal to-dos.

### What to build (mobile)

New feature slice: `lib/features/projects/`

```
features/projects/
├── data/
│   ├── datasources/projects_datasource.dart   # GET /projects, POST /projects, etc.
│   └── repositories/projects_repository_impl.dart
├── domain/
│   └── entities/
│       ├── project_entity.dart     # id, name, client, color, status, dueDate, taskCount, doneCount
│       └── project_task_entity.dart # id, title, status (TODO|IN_PROGRESS|REVIEW|DONE), priority, dueDate, order
└── presentation/
    ├── pages/
    │   ├── projects_page.dart       # list of project cards
    │   ├── project_detail_page.dart # task list grouped by status, push route
    │   └── quick_add_project_task_page.dart  # modal for new task
    ├── providers/
    │   ├── projects_provider.dart
    │   └── project_detail_provider.dart
    └── widgets/
        ├── project_card.dart
        └── project_task_item.dart
```

### API endpoints consumed

| Method | Endpoint |
|---|---|
| GET | `/api/v1/projects` |
| POST | `/api/v1/projects` |
| GET | `/api/v1/projects/:id` |
| PATCH | `/api/v1/projects/:id` |
| DELETE | `/api/v1/projects/:id` |
| GET | `/api/v1/projects/:id/tasks` |
| POST | `/api/v1/projects/:id/tasks` |
| PATCH | `/api/v1/projects/:id/tasks/:taskId` |
| DELETE | `/api/v1/projects/:id/tasks/:taskId` |

Add to `ApiConstants`:
```dart
static const projects = '$base/projects';
static String projectById(String id) => '$base/projects/$id';
static String projectTasks(String id) => '$base/projects/$id/tasks';
static String projectTaskById(String pid, String tid) => '$base/projects/$pid/tasks/$tid';
```

### New routes in `app.dart`

```dart
GoRoute(path: '/projects', builder: (_, __) => const ProjectsPage()),
GoRoute(path: '/projects/:id', builder: (_, s) => ProjectDetailPage(id: s.pathParameters['id']!)),
GoRoute(path: '/projects/:id/add-task', builder: (_, s) => QuickAddProjectTaskPage(projectId: s.pathParameters['id']!)),
```

Add "Projects" entry to `More` tab in `app_scaffold.dart` (or dedicated bottom-nav tab — decide when building).

### Widget (future)

No widget changes needed for v1. Future: add a "Projects" shortcut button as 5th widget button if the grid supports it.

---

## Known Gotchas

| Issue | Detail |
|-------|--------|
| `AsyncValue.guard` | Silently swallows exceptions — never use for mutations. Always manual `try/catch + rethrow`. |
| **Auto-dispose double-toast** | `@riverpod` mutation notifiers (no `keepAlive`) get disposed mid-async when nothing watches them — causes false error toast even though DB write succeeded. **Fix: bypass mutation notifiers entirely in page code.** Call datasource directly, use local `bool _loading`. Applies to all quick-add pages, `tasks_page`, `record_payment_page`. |
| **Modal black screen from widget** | Widget uses `context.go()` which replaces the entire nav stack. Popping the modal on an empty stack → black screen. **Fix:** all quick-add pages use `_close()` with `canPop()` guard — falls back to `context.go('/dashboard')`. |
| **Widget deep link cold start** | `coffer://` deep link on cold start gets overwritten by auth splash redirect, losing destination. **Fix:** `pendingLink` pattern in `app.dart` — park on `/splash`, deliver after auth resolves. |
| RouterNotifier timing | `_routerListener?.call()` inside `build()` fires before Riverpod commits state. Must be `Future.microtask(() => _routerListener?.call())`. |
| `<View>` in widget XML | Banned in RemoteViews on Android API 31+. Use `<TextView>` even for dividers. |
| INTERNET permission | Must be in main `AndroidManifest.xml`. Debug overlay manifest does NOT merge into release builds. |
| Lucide icon strings | Web app stores Lucide icon names. Map them in `lucide_ext.dart` for Material Icons and emoji. |
| Amounts in paisas | All monetary values are `int` (paisas). Never `double`. Format via `int.formatPKR()`. |
| `--dart-define` mandatory | `API_BASE_URL` must be passed at build time. No fallback. |
| `fvm` prefix | All Flutter and Dart commands use `fvm` — never raw `flutter` or `dart`. |
| No barrel files | Never create `index.dart` re-exports. Import the specific file path. |
| Extensions over utils | Logic on a type → extension on that type. Never static utility classes. |
| Custom widgets always | Never use raw Flutter widgets (`Card`, `ElevatedButton`, etc.) in feature code. |
| Keystore backup | `android/app/keystore.jks` must be backed up to Filen cloud. Losing it = can't update the app. |
| Widget today_spend | Hardcoded to 0 on expense add. A background task would be needed for accurate real-time spend. |
| Optimistic UI flash | Don't remove optimistic state immediately on API success — the provider hasn't reloaded yet, causing a 1-frame revert. Keep optimistic entry until provider data lands with matching status; clean up via `addPostFrameCallback` in the `data()` callback. |
| `pubspec.yaml` version | Must be bumped manually to match git tag before releasing, OR CI passes `--build-name` extracted from tag. Currently CI does both. |
