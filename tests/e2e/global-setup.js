// @ts-check
const { execSync } = require('child_process');
const { NAME, PORT, DB_PATH, BASE_URL } = require('./server');

/**
 * Start a disposable, isolated Coinsider container before the E2E run.
 *
 * Managed by a fixed name + detached (`-d`) so global-teardown can always remove
 * it, even if Playwright is killed mid-run. We force-remove any leftover from a
 * previously crashed run first, guaranteeing a fresh empty DB every time.
 */
module.exports = async () => {
  try {
    execSync(`docker rm -f ${NAME}`, { stdio: 'ignore' });
  } catch {
    // nothing to clean up
  }

  execSync(
    `docker compose run -d --rm --name ${NAME} --publish ${PORT}:80 -e COINSIDER_DB_PATH=${DB_PATH} php`,
    { stdio: 'inherit' }
  );

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE_URL);
      if (res.ok) return;
    } catch {
      // server still booting
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Coinsider E2E server did not come up at ${BASE_URL} within 120s`);
};
