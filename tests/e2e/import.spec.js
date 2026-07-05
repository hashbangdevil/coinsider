// @ts-check
const { test, expect } = require('@playwright/test');
const { signUp } = require('./helpers');

function csv(rows) {
  return ['Date,Description,Amount', ...rows].join('\n');
}

async function openImport(page) {
  await page.locator('#menu-btn').click();
  await page.locator('#nav-import').click();
  await expect(page.locator('#import-modal')).toBeVisible();
  await expect(page.locator('#import-step-source')).toBeVisible();
}

/** Upload a CSV and advance through the (auto-guessed) mapping to the preview. */
async function uploadToPreview(page, content) {
  await page.locator('#import-file').setInputFiles({
    name: 'bank.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(content),
  });
  await page.locator('#import-next-btn').click(); // -> map
  await expect(page.locator('#import-step-map')).toBeVisible();

  // Headers "Date,Description,Amount" should auto-map to columns 0/1/2.
  await expect(page.locator('[data-imp-map="date"]')).toHaveValue('0');
  await expect(page.locator('[data-imp-map="description"]')).toHaveValue('1');
  await expect(page.locator('[data-imp-map="amount"]')).toHaveValue('2');

  await page.locator('#import-next-btn').click(); // -> preview
  await expect(page.locator('#import-step-preview')).toBeVisible();
}

test.describe('CSV import', () => {
  test('imports rows and confirms categories in review', async ({ page }) => {
    await signUp(page, { name: 'Import User', prefix: 'import' });

    await openImport(page);
    await uploadToPreview(page, csv([
      '2026-07-01,WOOLWORTHS SANDTON,-250.00',
      '2026-07-02,SALARY ACME,10000.00',
    ]));

    await expect(page.locator('#import-preview-table tbody tr')).toHaveCount(2);

    await page.locator('#import-next-btn').click(); // Import
    await expect(page.locator('#import-step-review')).toBeVisible();
    await expect(page.locator('#import-review-table tbody tr')).toHaveCount(2);

    // Assign a category to each pending row, then confirm all.
    const selects = page.locator('#import-review-table select');
    await selects.nth(0).selectOption({ index: 1 });
    await selects.nth(1).selectOption({ index: 1 });
    await page.locator('#import-next-btn').click(); // Confirm all
    await expect(page.locator('#import-review-summary')).toContainText('All caught up');

    await page.locator('#import-modal .modal-close').click();
    await expect(page.locator('#transactions-list')).toContainText('WOOLWORTHS');
  });

  test('flags likely duplicates on re-import', async ({ page }) => {
    await signUp(page, { name: 'Dup User', prefix: 'dup' });
    const data = csv(['2026-07-01,WOOLWORTHS SANDTON,-250.00']);

    // First import.
    await openImport(page);
    await uploadToPreview(page, data);
    await page.locator('#import-next-btn').click(); // Import
    await expect(page.locator('#import-step-review')).toBeVisible();
    await page.locator('#import-modal .modal-close').click();

    // Re-import the same file: the row is flagged duplicate and left unticked.
    await openImport(page);
    await uploadToPreview(page, data);
    await expect(page.locator('#import-preview-table tbody tr.import-dup')).toHaveCount(1);
    await expect(page.locator('[data-imp-include="0"]')).not.toBeChecked();
  });

  test('learns the category from confirmed history', async ({ page }) => {
    await signUp(page, { name: 'Learn User', prefix: 'learn' });

    // Import and confirm a WOOLWORTHS expense with a chosen category.
    await openImport(page);
    await uploadToPreview(page, csv(['2026-07-01,WOOLWORTHS SANDTON,-250.00']));
    await page.locator('#import-next-btn').click(); // Import
    await expect(page.locator('#import-step-review')).toBeVisible();
    const reviewSelect = page.locator('#import-review-table select').first();
    await reviewSelect.selectOption({ index: 1 });
    const chosenCategory = await reviewSelect.inputValue();
    await page.locator('#import-next-btn').click(); // Confirm all
    await expect(page.locator('#import-review-summary')).toContainText('All caught up');
    await page.locator('#import-modal .modal-close').click();

    // A later WOOLWORTHS transaction should be pre-suggested the same category.
    await openImport(page);
    await uploadToPreview(page, csv(['2026-08-15,WOOLWORTHS CAPE TOWN,-99.00']));
    await expect(page.locator('#import-preview-table select').first()).toHaveValue(chosenCategory);
  });
});
