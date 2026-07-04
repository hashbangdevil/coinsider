# Coinsider

**Think. Track. Thrive.** — a smart, self-hosted personal budget manager, packaged as an installable Progressive Web App (PWA).

Coinsider lets you track income and expenses, set per-category budgets, manage recurring transactions, save toward goals with savings buckets, and keep balances across multiple accounts — all on infrastructure you control. Your financial data can optionally be **end-to-end encrypted** in your browser, so the server never sees it in the clear.

## Features

- **Transactions** — log income and expenses, categorize, filter, and browse full history
- **Categories** — user-defined income/expense categories with icons, colors, and monthly budgets
- **Recurring transactions** — monthly/yearly recurring entries, with pause/resume
- **Savings buckets** — goal-based saving with allocations, withdrawals, and adjustments
- **Accounts** — track multiple accounts (bank, credit card, cash, savings, e-wallet, investment) and transfers between them
- **Insights** — summaries, spending trends, category drill-down, and budget-vs-actual comparison over flexible date ranges
- **Multi-currency** support (default ZAR)
- **Accounts & authentication** — signup/login, password reset, email verification (optional SMTP)
- **Client-side encryption** — optional AES-256-GCM encryption of your data with a recovery phrase for account recovery
- **PWA** — installable, offline-capable, mobile-first

## Tech stack

- **Frontend:** vanilla HTML/CSS/JavaScript (no framework, no build step), service worker for PWA
- **Backend:** PHP 8 REST API
- **Database:** SQLite
- **Email:** PHPMailer (optional, for password reset & verification)
- **Runtime:** Apache + PHP via Docker

## Running locally

The app runs in Docker (Apache + PHP 8.5).

### 1. Configure user permissions

The container runs as your host user so the bind-mounted files stay writable. Find your IDs:

```
id -u   # UID
id -g   # GID
```

Put them in `.env` (create it if it doesn't exist):

```
UID=502
GID=20
```

### 2. Start the app

```
docker compose up --build
```

(`--build` can be omitted on subsequent runs.)

The app is served at **http://localhost:8888**.

The SQLite database is created automatically at `data/budget.db` on first use. **To reset the installation, delete `data/budget.db`** — it will be recreated on the next request.

## Email configuration (optional)

Email sending (password reset, verification) is **disabled by default** — in development, reset links are shown directly. To enable real email:

1. Copy the example credentials file:
   ```
   cp smtpcreds.env.example smtpcreds.env
   ```
2. Fill in your SMTP settings in `smtpcreds.env`.

`smtpcreds.env` is loaded from the first location found:
1. One level **above** the project folder (most secure — outside the web root)
2. The project root
3. The `api/` folder (development only)

For Docker, you can also mount it:

```
-v /path/to/smtpcreds.env:/var/www/html/smtpcreds.env
```

## Testing

Two test suites, both run through Docker (no PHP or PHP tooling needed on the host):

**PHP — PHPUnit.** Unit tests of the SQLite data/aggregation layer plus HTTP-level
tests of the API handlers (auth, sessions, and per-user data isolation), run against
an isolated in-memory / throwaway database:

```
docker compose run --rm php composer test
```

**Browser — Playwright.** End-to-end tests that drive the real UI against a
disposable, isolated app instance (never your dev database): signup/login/logout,
adding transactions, and the full client-side **encryption round-trip**. Runs on the
host via Node:

```
npm install
npx playwright install chromium
npm run test:e2e
```

See [CLAUDE.md](CLAUDE.md) for how each layer is structured and a one-time setup note.

## Project structure

```
index.html        App shell (all screens and modals)
app.js            All client-side application logic
crypto.js         Client-side encryption (Web Crypto / AES-256-GCM)
styles.css        Styles
sw.js             Service worker
manifest.json     PWA manifest
api/              PHP REST API (api.php router, auth.php, db.php, config.php, email.php)
data/budget.db    SQLite database (web-inaccessible)
```

See [CLAUDE.md](CLAUDE.md) for architecture details and contributor notes.

## Security notes

Built-in protections:

- **Passwords** are hashed with bcrypt (`password_hash`); hashes never leave the server.
- **Brute-force throttling** on login and encryption-password checks (per-account lockout after repeated failures) and on password-reset requests.
- **SQL injection**: every query uses PDO prepared statements (parameterized).
- **Per-user isolation**: all data is scoped by `user_id`; a user cannot read or modify another account's data.
- **Sessions**: cookies are `HttpOnly` + `SameSite=Lax` (+ `Secure` over HTTPS), and the session ID is regenerated on login to prevent fixation.
- **Reset/verification tokens** are 32-byte random, time-limited, and single-use.
- Server error responses are generic (internal details are logged, not returned).
- The `data/` directory (SQLite DB) is blocked from web access via `.htaccess`, and security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy) are set there too.

Production checklist (Apache):

- Serve over HTTPS with a valid TLS certificate — the `.htaccess` HTTP→HTTPS redirect is enabled by default (localhost is excluded so local dev still works).
- Ensure `AllowOverride All` is set for the vhost so `.htaccess` (including the `data/` deny) is honored.
- Set the `APP_URL` and `MAIL_FROM` environment variables to your domain, and add your origin to the CORS allow-list in `api/config.php`.
- Keep `smtpcreds.env` outside the web root (one level above the project).

**Client-side encryption:** with encryption enabled the server stores only wrapped keys and ciphertext and cannot decrypt your data. Transaction *amounts* are intentionally left unencrypted so summaries and trends can be computed. **Keep your recovery phrase safe — losing both your password and recovery phrase means the data cannot be recovered.**

## License

Released into the public domain under [The Unlicense](LICENSE) — do whatever you like with it.
