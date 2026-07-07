// @ts-check
const { test, expect } = require('@playwright/test');
const { signUp } = require('./helpers');

test.describe('Accounts ledger', () => {
  test('a new user gets a Default account and the transaction picker defaults to it', async ({ page }) => {
    await signUp(page, { name: 'Ledger User', prefix: 'ledger' });

    await page.locator('#add-transaction-btn').click();
    await expect(page.locator('#transaction-modal')).toBeVisible();

    // The account picker is shown (accounts are always on now)...
    await expect(page.locator('#transaction-account-group')).toBeVisible();
    // ...has no "No account" option...
    await expect(page.locator('#transaction-account option[value=""]')).toHaveCount(0);
    // ...and defaults to the auto-created "Default account".
    await expect(page.locator('#transaction-account option:checked')).toContainText('Default account');
  });

  test('a new user sees the onboarding prompt and can set up accounts', async ({ page }) => {
    await signUp(page, { name: 'Onboard User', prefix: 'onboard', skipOnboarding: false });

    await expect(page.locator('#onboarding-modal')).toBeVisible();

    // Rename the default account and add a Cash account.
    await page.locator('#onboarding-account-name').fill('Everyday');
    await page.locator('.onboarding-extra[data-name="Cash"]').check();
    await page.locator('#onboarding-done').click();
    await expect(page.locator('#onboarding-modal')).toBeHidden();

    // The accounts reflect the setup.
    const names = await page.evaluate(async () => {
      const r = await (await fetch('./api/api.php?resource=accounts')).json();
      return r.accounts.map((a) => a.name);
    });
    expect(names).toContain('Everyday');
    expect(names).toContain('Cash');

    // It does not reappear on reload.
    await page.reload();
    await expect(page.locator('#app-screen')).toBeVisible();
    await expect(page.locator('#onboarding-modal')).toBeHidden();
  });

  test('skipping onboarding does not reappear on reload', async ({ page }) => {
    await signUp(page, { name: 'Skip User', prefix: 'skip', skipOnboarding: false });
    await expect(page.locator('#onboarding-modal')).toBeVisible();
    await page.locator('#onboarding-skip').click();
    await expect(page.locator('#onboarding-modal')).toBeHidden();

    await page.reload();
    await expect(page.locator('#app-screen')).toBeVisible();
    await expect(page.locator('#onboarding-modal')).toBeHidden();
  });

  test('a transfer between accounts moves money without a category', async ({ page }) => {
    await signUp(page, { name: 'Transfer User', prefix: 'transfer' });

    // Create a second account so Transfer becomes available.
    await page.evaluate(async () => {
      await fetch('./api/api.php?resource=accounts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Savings', type: 'savings', starting_balance: 0 }),
      });
    });
    await page.reload();

    await page.locator('#add-transaction-btn').click();
    await expect(page.locator('#transaction-modal')).toBeVisible();

    // Switch to Transfer: category hides, "to account" shows.
    await expect(page.locator('#transaction-type-transfer')).toBeVisible();
    await page.locator('#transaction-type-transfer').click();
    await expect(page.locator('#transaction-category-group')).toBeHidden();
    await expect(page.locator('#transaction-transfer-to-group')).toBeVisible();

    // From defaults to the Default account, To to Savings; move 100.
    await page.locator('#transaction-amount').fill('100');
    await page.locator('#transaction-date').fill(new Date().toISOString().slice(0, 10));
    await page.locator('#transaction-submit-btn').click();
    await expect(page.locator('#transaction-modal')).toBeHidden();

    // Balances moved: -100 out of Default, +100 into Savings.
    const balances = await page.evaluate(async () => {
      const r = await (await fetch('./api/api.php?resource=accounts')).json();
      return Object.fromEntries(r.accounts.map((a) => [a.name, a.current_balance]));
    });
    expect(balances['Default account']).toBe(-100);
    expect(balances['Savings']).toBe(100);

    // The transfer shows up in the recent transactions list (from -> to).
    const transferRow = page.locator('#transactions-list .transaction-item').filter({ hasText: '→' });
    await expect(transferRow).toBeVisible();
    await expect(transferRow).toContainText('Default account');
    await expect(transferRow).toContainText('Savings');
  });

  test('the account detail view shows the balance, transactions and transfers', async ({ page }) => {
    await signUp(page, { name: 'Detail User', prefix: 'detail' });

    // Seed a second account, a transaction on Default, and a transfer out of it.
    await page.evaluate(async () => {
      const post = (resource, body) => fetch(`./api/api.php?resource=${resource}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }).then((r) => r.json());
      const accounts = (await (await fetch('./api/api.php?resource=accounts')).json()).accounts;
      const def = accounts.find((a) => a.name === 'Default account');
      const savings = await post('accounts', { name: 'Savings', type: 'savings', starting_balance: 0 });
      const cats = await (await fetch('./api/api.php?resource=categories')).json();
      const expenseCat = cats.find((c) => c.type === 'expense');
      const today = new Date().toISOString().slice(0, 10);
      await post('transactions', {
        type: 'expense', amount: 25, description: 'Groceries',
        category_id: expenseCat.id, account_id: def.id, date: today,
      });
      await post('account-transfers', {
        from_account_id: def.id, to_account_id: savings.id, amount: 40,
        description: 'Move to savings', date: today,
      });
    });
    await page.reload();

    // Open the accounts view and tap the Default account card.
    await page.locator('#menu-btn').click();
    await page.locator('[data-section="accounts"]').click();
    await expect(page.locator('#accounts-section')).toBeVisible();
    await page.locator('.account-card').filter({ hasText: 'Default account' }).click();

    // The detail modal shows the account and its combined activity.
    await expect(page.locator('#account-details-modal')).toBeVisible();
    await expect(page.locator('#account-details-title')).toContainText('Default account');
    await expect(page.locator('#account-details-list')).toContainText('Groceries');
    await expect(page.locator('#account-details-list')).toContainText('Move to savings');

    // Edit and Delete actions are available from the detail view.
    await expect(page.locator('#account-details-edit-btn')).toBeVisible();
    await expect(page.locator('#account-details-delete-btn')).toBeVisible();
  });

  test('deleting an account with transactions reassigns them to another account', async ({ page }) => {
    await signUp(page, { name: 'Reassign User', prefix: 'reassign' });

    // Set up a second account with a transaction on it (via the in-page API).
    const creditId = await page.evaluate(async () => {
      const acc = await (await fetch('./api/api.php?resource=accounts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Credit', type: 'credit_card' }),
      })).json();
      const cats = await (await fetch('./api/api.php?resource=categories')).json();
      const cat = cats.find((c) => c.type === 'expense');
      await fetch('./api/api.php?resource=transactions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'on credit', amount: 20, category_id: cat.id, type: 'expense', date: '2026-07-01', account_id: acc.id }),
      });
      return acc.id;
    });
    await page.reload();

    // Accounts section → open the Credit account → delete.
    await page.locator('#menu-btn').click();
    await page.locator('.nav-item[data-section="accounts"]').click();
    await page.locator(`.account-card[data-account-id="${creditId}"]`).click();
    await expect(page.locator('#account-details-modal')).toBeVisible();
    await page.locator('#account-details-delete-btn').click();

    // Confirm the delete → it has transactions → reassign modal appears.
    // (JS clicks: the stacked confirm/reassign modals animate, which trips
    // Playwright's actionability check — the handlers themselves are what matter.)
    await expect(page.locator('#confirm-modal')).toBeVisible();
    await page.evaluate(() => document.getElementById('confirm-accept').click());
    await expect(page.locator('#reassign-account-modal')).toBeVisible();

    // Target defaults to the only other account (Default account); confirm.
    await page.evaluate(() => document.getElementById('reassign-account-confirm').click());
    await expect(page.locator('#reassign-account-modal')).toBeHidden();

    // The Credit account is gone.
    await expect(page.locator(`.account-card[data-account-id="${creditId}"]`)).toHaveCount(0);
  });
});
