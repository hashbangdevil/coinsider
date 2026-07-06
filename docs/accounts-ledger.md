# Accounts as a mandatory ledger

**Status:** proposed (design agreed in discussion; pending build)

## Summary

Coinsider becomes ledger-first: every user always has at least one account, and
every transaction and recurring rule is recorded against an account. The optional
"Accounts module" toggle is retired. Casual users are unaffected in practice — they
get a single auto-created **"Default account"** and simply never add more.

## Principles

- **Always ≥ 1 account.** A "Default account" is auto-created on signup. It can be
  renamed, but a user can never delete their way below one account.
- **Every transaction has an account.** Manual entry, recurring, and CSV import all
  carry an `account_id`. No account-less transactions exist.
- **The account picker is always visible** (pre-filled with the default / last-used
  account) — deliberately kept front-of-mind so users know accounts are a thing.
  No hide-when-only-one rule.
- **Transfers** move money between two accounts — no category, no effect on net
  worth — via the existing `account_transfers` system.

## Onboarding (first login)

Prompt the user to (a) rename "Default account" and (b) optionally add more accounts
(Cash, Credit card, …). Fully skippable — skipping keeps the single default.

## Data model

- `users.accounts_enabled` is retired (accounts are always on). *Open:* drop the
  column, or keep it and force to 1 to avoid a destructive migration (lean: keep).
- `transactions.account_id` becomes effectively required — enforced in the API/app;
  the column stays nullable for legacy rows until they are migrated.
- `recurring_transactions` gains `account_id`; generated instances inherit it.
- Transfers are unchanged — `account_transfers` already stores from/to and moves the
  two balances (−from / +to).
- Deleting an account is blocked when it would leave the user with zero accounts.

## Migration (existing users — one-time, idempotent)

For each user: ensure ≥ 1 account (create "Default account", opening balance 0 if
none); assign every account-less transaction to that account; recalc its balance.
Runs lazily per-user on login (or as a batch). Must be safe to re-run.

## Transfers in the transaction entry

Add a **Transfer** type to the add-transaction modal alongside Expense / Income:
pick a destination account → creates an `account_transfer`. Only meaningful with 2+
accounts; with a single account the Transfer type is disabled with a hint to add
another. The existing Accounts-section transfer button can be kept or consolidated.

## Balances (unchanged, but clearer)

Two figures remain, now clearly distinct:
- **Net Balance** (dashboard) — a *flow*: income − expense across transactions.
- **Total across accounts** — a *stock*: Σ account `current_balance`, which includes
  opening balances. For a single account with opening balance 0 these coincide.

## Phasing (each testable, behind tests, on `feature/accounts-mandatory`)

1. **Core model** — auto-create "Default account"; enforce an account on all
   transactions; existing-user migration; retire the toggle; always-visible picker;
   block deleting the last account.
2. **Onboarding prompt** — rename the default + add accounts on first login.
3. **Recurring honours accounts** — `account_id` on rules + generated instances.
4. **Transfer mode** in the transaction entry.
