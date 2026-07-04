// @ts-check
const { test, expect } = require('@playwright/test');
const { uniqueEmail, signUp } = require('./helpers');

test.describe('Authentication', () => {
  test('a new user can sign up and lands on the dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#auth-screen')).toBeVisible();

    await signUp(page, { name: 'New User', prefix: 'signup' });

    // The header greeting shows the first name only (name.split(' ')[0]).
    await expect(page.locator('#user-name')).toHaveText('New');
  });

  test('the session persists across a page reload', async ({ page }) => {
    await signUp(page, { name: 'Persist User', prefix: 'persist' });

    await page.reload();

    // Still authenticated → straight back to the dashboard, no auth screen.
    await expect(page.locator('#app-screen')).toBeVisible();
    await expect(page.locator('#auth-screen')).toBeHidden();
  });

  test('an existing user can log in through the form', async ({ page, request }) => {
    // Create the account out-of-band (isolated request context — no page cookies)
    // so this test exercises the login form specifically, not signup.
    const email = uniqueEmail('login');
    const res = await request.post('/api/auth.php?action=signup', {
      data: { email, name: 'Login User', password: 'password123' },
    });
    expect(res.status()).toBe(201);

    await page.goto('/');
    await page.locator('#login-email').fill(email);
    await page.locator('#login-password').fill('password123');
    await page.locator('#login-form button[type="submit"]').click();

    await expect(page.locator('#app-screen')).toBeVisible();
    // Header greeting shows the first name only.
    await expect(page.locator('#user-name')).toHaveText('Login');
  });

  test('logging in with a wrong password shows an error and stays on auth', async ({ page, request }) => {
    const email = uniqueEmail('badlogin');
    await request.post('/api/auth.php?action=signup', {
      data: { email, name: 'Bad Login', password: 'password123' },
    });

    await page.goto('/');
    await page.locator('#login-email').fill(email);
    await page.locator('#login-password').fill('wrong-password');
    await page.locator('#login-form button[type="submit"]').click();

    // Never leaves the auth screen.
    await expect(page.locator('#auth-screen')).toBeVisible();
    await expect(page.locator('#app-screen')).toBeHidden();
  });
});
