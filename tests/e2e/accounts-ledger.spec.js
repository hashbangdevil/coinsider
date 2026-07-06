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
});
