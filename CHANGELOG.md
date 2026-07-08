# Changelog

All notable changes to Coinsider are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html):
given a version `MAJOR.MINOR.PATCH`, bump

- **MAJOR** for incompatible changes (e.g. a breaking API or data-migration change),
- **MINOR** for new, backwards-compatible functionality,
- **PATCH** for backwards-compatible bug fixes.

Releases are cut with `scripts/release.sh` (see the README), which is the single
command that keeps every version surface in sync — do not hand-edit versions.

## [Unreleased]

### Changed
- **Net worth moved to Reports.** It now lives in a dedicated card at the top of
  the Reports section (all-accounts total plus a per-account breakdown) instead of
  on the home balance card, where it was easy to confuse with the period balance.

## [1.4.0] - 2026-07-08

### Added
- **Account detail view.** Tapping an account opens a screen showing its current
  balance and type, its combined transaction and transfer history, and Edit/Delete
  actions.
- **Transfer history.** A History button on the Accounts page lists every transfer
  between accounts, newest first.
- **Net worth** is now shown on the home balance card alongside the period balance,
  so your all-accounts total is visible independent of the selected period.

### Changed
- Transfers now appear in the recent transactions list, interleaved with
  transactions by date.
- The back/home chevron is larger and higher-contrast, making it easier to see and tap.

### Fixed
- Transfers now honour the encryption setting: transfer descriptions for encrypted
  accounts are decrypted on read instead of showing ciphertext.
- Removed a stray "click here to reset password" link (pointing at a hardcoded URL)
  from the forgot-password confirmation screen.
- The password-reset and encryption screens now note that your recovery phrase stays
  valid after use, so you are not prompted to save a new one.
- Spacing between the Transfer button and the account list on the Accounts page.

## [1.3.0] - 2026-07-06

### Changed
- **Accounts are now a mandatory ledger.** Every user always has at least one
  account (an auto-created "Default account"), and every transaction, recurring
  rule, and import is recorded against an account — the optional "Accounts
  module" toggle is retired. Existing users migrate automatically and transparently
  on next login: they get a Default account, their account-less history folds into
  it (balance rolled up), and recurring rules are attached. See
  `docs/accounts-ledger.md`.

### Added
- First-login **onboarding** to name the default account and quick-add others
  (Cash, Credit card, Savings), or skip.
- **Transfer** type in the add-transaction modal (From/To accounts, no category),
  available once you have two or more accounts.
- **Reassign on delete**: deleting an account that has transactions prompts you to
  move them (and its balance) to another account. The account edit screen also
  gains a Delete button (previously missing).
- Recurring transactions carry an account; generated transactions inherit it and
  update the account balance.

## [1.2.0] - 2026-07-06

### Added
- **CSV import** (e.g. bank statements): pick an account, upload a CSV, map its
  columns (remembered per bank layout), preview with likely duplicates flagged,
  and import. Imported transactions are marked for review, then confirmed with a
  category. Category suggestions are learned client-side from your own history and
  improve as you confirm. Parsing and learning run entirely in the browser, so
  end-to-end encryption is preserved.

## [1.1.0] - 2026-07-05

### Changed
- `scripts/release.sh --push` now also creates the GitHub release from the
  promoted changelog section (via the `gh` CLI), skipping gracefully with
  instructions if `gh` is missing or unauthenticated.

## [1.0.0] - 2026-07-05

First versioned release. Coinsider is a self-hosted personal budget manager PWA:
transactions, categories with budgets, recurring transactions, savings buckets,
multiple accounts, and optional client-side end-to-end encryption.

### Added
- PHPUnit test suite: SQLite data/aggregation layer plus HTTP-level API handler
  tests (auth, sessions, per-user isolation).
- Playwright end-to-end tests, including the client-side encryption round-trip.
- Semantic versioning: single-source `VERSION` file, `scripts/release.sh`, and
  this changelog. The API root response now reports the version from `VERSION`.

### Security
- Brute-force throttling on login, password-reset, and encryption-password checks.
- Session ID regeneration on login/signup (session fixation).
- Generic server error responses; internal details are logged, not returned.
- HTML-escaping of user-controlled name/description/icon fields in the UI.
- Raised the signup password minimum to 10; removed the unauthenticated
  `api/test.php` diagnostics endpoint.

### Changed
- `APP_URL`, `MAIL_FROM`, and `MAIL_FROM_NAME` are environment-configurable.
- Enabled the `.htaccess` HTTP→HTTPS redirect (localhost excluded for dev).
- Clarified PWA scope in the README (installable app shell; viewing/editing data
  requires a server connection).

### Notes
- Supersedes the informal pre-semver markers (UI `v1.0.60`, service-worker
  `coinsider-v74`, API `1.0`), which are now unified under this version.
