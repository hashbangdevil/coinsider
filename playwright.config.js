// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const { BASE_URL } = require('./tests/e2e/server');

module.exports = defineConfig({
  testDir: './tests/e2e',
  // The disposable, isolated app container is started/stopped here (not via
  // `webServer`) so teardown is guaranteed even if Playwright is killed mid-run.
  globalSetup: './tests/e2e/global-setup.js',
  globalTeardown: './tests/e2e/global-teardown.js',
  // One shared app instance with one SQLite file → run serially for determinism.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
