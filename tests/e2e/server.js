// @ts-check
// Shared config for the disposable E2E app container (setup + teardown + config).
const PORT = 8890; // dedicated E2E port (8888 is the dev app)
module.exports = {
  NAME: 'coinsider-e2e',
  PORT,
  DB_PATH: '/tmp/coinsider-e2e.db', // throwaway DB inside the container
  BASE_URL: `http://localhost:${PORT}`,
};
