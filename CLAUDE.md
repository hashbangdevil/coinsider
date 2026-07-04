# CLAUDE.md

Guidance for working in this repository.

## What this is

**Coinsider** ("Think. Track. Thrive.") — a self-hosted personal budget manager, packaged as an installable PWA. Single-user-per-account finance tracking: transactions, categories with budgets, recurring transactions, savings buckets, and multiple accounts. Optional end-to-end client-side encryption.

## Architecture

No build step, no framework. The frontend is plain HTML/CSS/JS served as static files; the backend is a small PHP REST API over SQLite.

```
index.html        Single-page app shell (all screens/modals are in here)
app.js            ~6,100 lines of vanilla JS — all client logic (no modules/bundler)
crypto.js         Client-side AES-256-GCM encryption (Web Crypto API)
styles.css        All styles (cache-busted via ?v=N in index.html)
sw.js             Service worker (PWA offline/caching)
manifest.json     PWA manifest
icons/, img/      App icons and images

api/
  api.php         REST router for app data (see Resources below)
  auth.php        Auth + account settings + encryption key management
  db.php          SQLite connection (singleton) + schema/migrations
  config.php      Config, session setup, CORS, JSON helpers, requireAuth()
  email.php       Email sending (PHPMailer)
  smtp_config.php Loads SMTP creds from smtpcreds.env
  test.php        Diagnostics endpoint

data/budget.db    SQLite database (gitignored data dir; protected by .htaccess)
```

### Request flow
- Browser calls `./api/...` via the `api()` helper in `app.js` (fetch, `credentials: 'include'`, JSON).
- `.htaccess` rewrites `api/(.*)` → `api/api.php/$1`, but **routing is by query string**, not path: `?resource=...&id=...`. Auth is a separate script: `api/auth.php?action=...`.
- PHP sessions (cookie-based) carry auth. `requireAuth()` in `config.php` gates every data handler.

### API resources (`api/api.php`, `?resource=`)
`categories`, `transactions`, `recurring` (supports `pause`/`resume`), `summary`, `trends`, `budget-comparison`, `savings-buckets`, `savings-transactions`, `accounts` (supports `activate`/`deactivate`), `account-transfers`. Standard GET/POST/PUT/DELETE per resource.

### Auth actions (`api/auth.php`, `?action=`)
`signup`, `login`, `logout`, `status`, `forgot-password`, `reset-password`, `change-password`, `update-settings`, `verify-email`, `resend-verification`, `verification-status`, and encryption: `get-encryption`, `enable-encryption`, `disable-encryption`, `update-encryption-key`, `update-recovery-key`, `verify-password`, `get-encryption-by-token`.

## Database

SQLite, schema created/migrated in `api/db.php::initializeTables()`. There are **no migration files** — schema changes are done by adding `CREATE TABLE IF NOT EXISTS` and idempotent `ALTER TABLE ... ADD COLUMN` (wrapped in try/catch) directly in that method. Follow that pattern for new columns.

Tables: `users`, `transactions`, `categories`, `recurring_transactions`, `savings_buckets`, `savings_transactions`, `accounts`, `account_transfers`. Per-user data is scoped by `user_id` with `ON DELETE CASCADE`.

## Client-side encryption (`crypto.js`)

Optional, opt-in per user. AES-256-GCM via Web Crypto. A random Master Encryption Key (MEK) is wrapped by a key derived from the user's password (PBKDF2, 600k iterations, SHA-256), and also by a recovery key (word-phrase based) for account recovery. The server only ever stores wrapped keys/salts (`encryption_*` columns on `users`) and ciphertext — it cannot decrypt.

Which fields get encrypted is defined by `ENCRYPTED_FIELDS` in `app.js`. **Amounts are intentionally left plaintext** so the DB can do numeric aggregation (summary/trends/budget-comparison run SQL on amounts). `category_name` is kept for decryption of joined API responses. Keep these constraints in mind before encrypting a new field.

## Running

Local dev via Docker (Apache + PHP 8.5):

```
cp example.env .env   # if needed; set UID/GID (id -u / id -g)
docker compose up --build
```

App at **http://localhost:8888** (mapped to container :80). The repo is bind-mounted, so edits are live.

To reset the database, delete `data/budget.db` (it's recreated on next request).

### Email (optional)
Email is off by default (`EMAIL_ENABLED` in `config.php`; reset links shown directly in dev). For real sending, copy `smtpcreds.env.example` → `smtpcreds.env` and fill it. It's loaded from (in order): one level above the project, project root, or `api/`.

## Tests

Two independent suites: **PHPUnit** (PHP: DB + HTTP layers) and **Playwright**
(browser E2E). Both need Docker; the host has no PHP.

### PHPUnit (`composer test`)

PHPUnit (dev dependency) drives a `tests/` suite in two layers.

**DB layer** — exercises the `api/db.php` data/aggregation functions directly
against an **in-memory SQLite** database (no HTTP server, session, or on-disk DB):

- `tests/bootstrap.php` sets `COINSIDER_DB_PATH=:memory:` (honored by the
  `DB_PATH` define in `config.php`) and requires `api/db.php`. It also calls
  `restore_error_handler()`/`restore_exception_handler()` to pop config.php's
  throw-on-warning / exit-on-exception handlers, which are meant for serving real
  requests and would otherwise hijack the test runner.
- `DatabaseTestCase` calls `Database::reset()` in `setUp()` so every test gets a
  fresh connection + freshly created schema (full isolation, order-independent).
- Add DB-layer tests by extending `DatabaseTestCase`; use the `makeUser()` /
  `makeCategory()` helpers. Cover per-user scoping (`user_id`) on anything new —
  several existing tests assert one user can't read another's rows.

**HTTP layer** (`tests/Http/`) — exercises the handler layer end-to-end: query-string
routing, `requireAuth()`, PHP session cookies, and the JSON contracts the frontend
reads. `HttpTestCase` boots PHP's built-in server (`php -S`, one per test class, on
port 8899) pointed at a throwaway **file-based** SQLite DB via `COINSIDER_DB_PATH`,
and drives it with a cookie-carrying Guzzle client so login/session behaviour is
real. A file DB (not `:memory:`) is required because the server is a separate
process; `setUp()` deletes the file so each test recreates a fresh schema. Extend
`HttpTestCase` and use `client()` (isolated cookie jar per "user") and `signup()`.

Run it in the container (host has no PHP):

```
docker compose run --rm php composer test        # or ./vendor/bin/phpunit
```

First-time setup: the base `php:8.5-apache` image ships without the zip
extension, so `composer install` can't extract archives. Install `unzip` once in
a root container, then install deps:

```
docker compose run --rm -u root php bash -c "apt-get update && apt-get install -y unzip && composer install"
```

This is the same reason the Dockerfile's build-time `composer install --no-dev`
is suffixed with `|| true`.

### Playwright E2E (`npm run test:e2e`)

Browser tests in `tests/e2e/` drive the real UI (`app.js`/`index.html`) against a
**disposable, isolated app container** — never the dev `data/budget.db`.
`tests/e2e/global-setup.js` starts a detached `docker compose run` container named
`coinsider-e2e` on port **8890** with an empty throwaway DB (`COINSIDER_DB_PATH`
under `/tmp`), waits for it, and `global-teardown.js` force-removes it (setup also
clears any leftover first, so a crashed run self-heals). Lifecycle is managed here
rather than via Playwright's `webServer` so teardown survives a killed run.

- Runs on the host (Node); needs a one-time `npm install` + `npx playwright install chromium`.
- Serial (`workers: 1`) against the one shared container; `helpers.js` `uniqueEmail()`
  keeps tests independent within the shared DB. `signUp()` is the common entry.
- Coverage: auth (signup/login/logout/session), transactions, and the client-side
  **encryption round-trip** (`encryption.spec.js`): enable encryption → the written
  description is ciphertext over the raw API but plaintext in the UI → log out and
  back in → it still decrypts. Note: with encryption on, a full page **reload** logs
  the user out (`init()` requires a session/remembered key to auto-unlock and falls
  back to re-login), so the round-trip is tested via explicit logout→login, not reload.

## Conventions / gotchas

- **No build tooling.** Edit `app.js`/`styles.css`/`index.html` directly. After CSS/JS changes, bump the `?v=` query param in `index.html` so clients (and the service worker) pick up the new file.
- `app.js` is one large file organized by `// ====` section banners (search those to navigate). Functions used in inline `onclick=` handlers are exposed on `window` at the bottom of the file — add new ones there if referenced from HTML.
- API routing is **query-string based**, not RESTful paths. New resources go in the `switch` in `api.php` plus a `handleX()` function.
- All money math that needs aggregation must keep amounts unencrypted (see encryption section).
- Default currency is `ZAR`; currency list is in `CURRENCIES` in `app.js`.
- `data/` is blocked from web access by `.htaccess` — don't move the DB out of it.
