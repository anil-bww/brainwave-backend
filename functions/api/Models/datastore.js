// datastore.js
const TABLE_NAME = 'Users';

/**
 * Helper to execute ZCQL queries and return the results array
 */
async function runQuery(app, query) {
  const zcqlRes = await app.zcql().executeZCQLQuery(query);
  // Catalyst returns an array of objects: [{ Users: { column: value } }]
  return zcqlRes.map(row => row[TABLE_NAME] || row);
}

/* --- READ OPERATIONS --- */

async function findProfileByZuid(app, zuid) {
  const query = `SELECT * FROM ${TABLE_NAME} WHERE zuid = '${zuid}' LIMIT 1`;
  const rows = await runQuery(app, query);
  return rows.length ? rows[0] : null;
}

async function findProfileByZaaid(app, zaaid) {
  const query = `SELECT * FROM ${TABLE_NAME} WHERE zaaid = '${zaaid}' LIMIT 1`;
  const rows = await runQuery(app, query);
  return rows.length ? rows[0] : null;
}

/* --- WRITE OPERATIONS --- */

async function insertProfile(app, profileData) {
  const table = app.datastore().table(TABLE_NAME);
  // Catalyst automatically handles ROWID and CREATEDTIME
  return await table.insertRow(profileData);
}

async function updateProfileById(app, ROWID, updates) {
  const table = app.datastore().table(TABLE_NAME);
  // Ensure the object contains the ROWID so Catalyst knows which row to update
  const updatedData = { ...updates, ROWID };
  return await table.updateRow(updatedData);
}

module.exports = {
  findProfileByZuid,
  findProfileByZaaid,
  insertProfile,
  updateProfileById
};