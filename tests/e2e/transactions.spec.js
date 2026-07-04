// @ts-check
const { test, expect } = require('@playwright/test');
const { signUp, today } = require('./helpers');

test.describe('Transactions', () => {
  test('adding an expense shows it in the list and updates totals', async ({ page }) => {
    await signUp(page, { name: 'Txn User', prefix: 'txn' });

    await page.locator('#add-transaction-btn').click();
    await expect(page.locator('#transaction-modal')).toBeVisible();

    // Expense is the default type; the category select is seeded on signup.
    await page.locator('#transaction-description').fill('Coffee');
    await page.locator('#transaction-amount').fill('42.50');

    // Wait for categories to populate, then pick the first real option.
    await expect
      .poll(async () => page.locator('#transaction-category option').count())
      .toBeGreaterThan(1);
    await page.locator('#transaction-category').selectOption({ index: 1 });

    await page.locator('#transaction-date').fill(today());
    await page.locator('#transaction-submit-btn').click();

    await expect(page.locator('#transaction-modal')).toBeHidden();
    await expect(page.locator('#transactions-list')).toContainText('Coffee');
    await expect(page.locator('#total-expenses')).toContainText('42');
  });

  test('adding income increases the balance', async ({ page }) => {
    await signUp(page, { name: 'Income User', prefix: 'income' });

    await page.locator('#add-transaction-btn').click();
    await expect(page.locator('#transaction-modal')).toBeVisible();

    // Switch to the income type — scope to this form (budget/recurring forms
    // reuse the same .type-btn markup). This reloads the category options.
    await page.locator('#transaction-form .type-btn[data-type="income"]').click();
    await page.locator('#transaction-description').fill('Salary');
    await page.locator('#transaction-amount').fill('1000');

    await expect
      .poll(async () => page.locator('#transaction-category option').count())
      .toBeGreaterThan(1);
    await page.locator('#transaction-category').selectOption({ index: 1 });

    await page.locator('#transaction-date').fill(today());
    await page.locator('#transaction-submit-btn').click();

    await expect(page.locator('#transaction-modal')).toBeHidden();
    await expect(page.locator('#transactions-list')).toContainText('Salary');
    await expect(page.locator('#total-income')).toContainText('1');
  });
});
