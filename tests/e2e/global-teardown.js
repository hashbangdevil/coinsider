// @ts-check
const { execSync } = require('child_process');
const { NAME } = require('./server');

/** Always remove the disposable E2E container after the run. */
module.exports = async () => {
  try {
    execSync(`docker rm -f ${NAME}`, { stdio: 'ignore' });
  } catch {
    // already gone
  }
};
