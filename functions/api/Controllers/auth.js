// auth.js
const catalyst = require('zcatalyst-sdk-node');

async function verifyAuth(req, res) {
  const app = catalyst.initialize(req, res);
  const currentUser = await app.userManagement().getCurrentUser();
  if (!currentUser) {
    const err = new Error('Unauthenticated: no current user');
    err.status = 401;
    throw err;
  }
  return { app, currentUser };
}

module.exports = { verifyAuth };
