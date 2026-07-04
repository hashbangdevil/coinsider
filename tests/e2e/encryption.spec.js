// @ts-check
const { test, expect } = require('@playwright/test');
const { signUp } = require('./helpers');

/**
 * Client-side E2E encryption round-trip — the highest-value browser test,
 * because this logic lives entirely in crypto.js/app.js and cannot be reached
 * from the PHP suites. Left as test.fixme: the flow spans several modals and
 * should be authored against a live app run (npm run test:e2e:headed) so each
 * step and its post-condition can be confirmed rather than guessed.
 *
 * Intended flow (real selectors, verified to exist in index.html):
 *   1. signUp(page)
 *   2. Open settings → click #data-encryption-btn
 *      → #encryption-settings-modal becomes visible
 *   3. Click #enable-encryption-btn → #encryption-setup-modal
 *      → fill #encryption-setup-password (+ confirm field) → submit
 *        #encryption-setup-form
 *   4. Capture the recovery phrase shown in #recovery-phrase-display
 *      (needed for the recovery-key branch), then dismiss the modal
 *   5. Add a transaction with a recognisable description (e.g. "SecretCoffee")
 *   6. page.reload() → expect #encryption-unlock-modal
 *      → fill #encryption-unlock-password → submit #encryption-unlock-form
 *   7. assert #transactions-list contains "SecretCoffee" (decrypted client-side)
 *
 * Also worth covering once the happy path is green:
 *   - Recovery branch: #use-recovery-btn → #encryption-recovery-form
 *     → #encryption-recovery-phrase unlocks without the password.
 *   - Wrong unlock password keeps #encryption-unlock-modal visible.
 */
test.fixme('encrypted data round-trips across a reload (unlock with password)', async ({ page }) => {
  await signUp(page, { name: 'Crypto User', prefix: 'crypto' });

  // TODO: implement per the flow documented above.
  await expect(page.locator('#app-screen')).toBeVisible();
});
