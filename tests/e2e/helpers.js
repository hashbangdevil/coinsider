// @ts-check
const { expect } = require('@playwright/test');

let counter = 0;

/** A unique email per call, so tests stay independent within a shared DB. */
function uniqueEmail(prefix = 'user') {
  counter += 1;
  return `${prefix}+${Date.now()}-${counter}@example.com`;
}

/** Today's date as YYYY-MM-DD for <input type="date"> fields. */
function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Sign up a fresh user through the UI and wait for the dashboard.
 * Returns the email used.
 */
async function signUp(page, { name = 'E2E User', password = 'password123', prefix = 'user' } = {}) {
  const email = uniqueEmail(prefix);
  await page.goto('/');
  await page.locator('[data-show="signup"]').click();
  await page.locator('#signup-name').fill(name);
  await page.locator('#signup-email').fill(email);
  await page.locator('#signup-password').fill(password);
  await page.locator('#signup-form button[type="submit"]').click();
  await expect(page.locator('#app-screen')).toBeVisible();
  return email;
}

module.exports = { uniqueEmail, today, signUp };
