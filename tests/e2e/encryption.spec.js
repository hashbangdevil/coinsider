// @ts-check
const { test, expect } = require('@playwright/test');
const { signUp, today } = require('./helpers');

// Coinsider's client-side E2E encryption uses the login password to derive a key
// (PBKDF2) that wraps a random Master Encryption Key; the server only ever stores
// wrapped keys + ciphertext. This suite proves the round-trip end-to-end:
//   - data written while encryption is on is CIPHERTEXT on the server, and
//   - the same data decrypts client-side in the UI, and survives a reload
//     (the MEK is restored from the localStorage session key on load).
// This logic lives entirely in crypto.js/app.js and is unreachable from the PHP
// suites, so it's the highest-value browser test.

const PASSWORD = 'password123';

/** Open the settings section via the nav drawer. */
async function openSettings(page) {
  await page.locator('#menu-btn').click();
  await page.locator('.nav-item[data-section="settings"]').click();
  await expect(page.locator('#settings-section')).toBeVisible();
}

/** Turn on encryption (login password confirms), dismissing the recovery phrase. */
async function enableEncryption(page, password) {
  await openSettings(page);
  await page.locator('#data-encryption-btn').click();
  await expect(page.locator('#encryption-settings-modal')).toBeVisible();

  await page.locator('#enable-encryption-btn').click();
  await expect(page.locator('#encryption-setup-modal')).toBeVisible();
  await page.locator('#encryption-setup-password').fill(password);
  await page.locator('#encryption-setup-form button[type="submit"]').click();

  // A 12-word recovery phrase is generated and shown; acknowledge it.
  await expect(page.locator('#recovery-phrase-modal')).toBeVisible();
  await expect(page.locator('#recovery-phrase-display')).not.toBeEmpty();
  await page.locator('#confirm-recovery-saved').click();
  await expect(page.locator('#recovery-phrase-modal')).toBeHidden();

  // Return to the dashboard (we're still in the settings section).
  await page.locator('#settings-back-btn').click();
  await expect(page.locator('#add-transaction-btn')).toBeVisible();
}

/** Add an expense with the given description via the transaction modal. */
async function addExpense(page, description, amount) {
  await page.locator('#add-transaction-btn').click();
  await expect(page.locator('#transaction-modal')).toBeVisible();
  await page.locator('#transaction-description').fill(description);
  await page.locator('#transaction-amount').fill(amount);
  await expect
    .poll(async () => page.locator('#transaction-category option').count())
    .toBeGreaterThan(1);
  await page.locator('#transaction-category').selectOption({ index: 1 });
  await page.locator('#transaction-date').fill(today());
  await page.locator('#transaction-submit-btn').click();
  await expect(page.locator('#transaction-modal')).toBeHidden();
}

test.describe('Client-side encryption', () => {
  test('data is ciphertext on the server but decrypts in the UI across a fresh login', async ({ page }) => {
    const email = await signUp(page, { name: 'Crypto User', prefix: 'crypto', password: PASSWORD });

    await enableEncryption(page, PASSWORD);

    // Written while encryption is on → stored encrypted.
    await addExpense(page, 'SecretCoffee', '13.37');
    await expect(page.locator('#transactions-list')).toContainText('SecretCoffee');

    // The RAW API response (fetched in-page, but NOT run through app.js's decrypt
    // layer) must not leak the plaintext description — proof the server holds only
    // ciphertext and cannot read it.
    const raw = await page.evaluate(async () => {
      const res = await fetch('./api/api.php?resource=transactions&limit=100', {
        credentials: 'include',
      });
      return res.text();
    });
    expect(raw).not.toContain('SecretCoffee');

    // Log out (clears the in-memory MEK + local key material), then log back in.
    // The password re-derives the key (PBKDF2 → unwrap MEK) and the data decrypts
    // again — the canonical cross-session round-trip.
    await page.locator('#logout-btn').click();
    await expect(page.locator('#auth-screen')).toBeVisible();

    await page.locator('#login-email').fill(email);
    await page.locator('#login-password').fill(PASSWORD);
    await page.locator('#login-form button[type="submit"]').click();

    await expect(page.locator('#app-screen')).toBeVisible();
    await expect(page.locator('#transactions-list')).toContainText('SecretCoffee');
  });
});
