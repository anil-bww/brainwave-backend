const TABLE_USERS = 'Users';

/**
 * INTERNAL: Resolves ZUID to internal Users.ROWID.
 * Uses Catalyst Cache (1-day expiry) for performance.
 */
async function _getInternalUserId(app, currentUser) {
  const zuid = currentUser.zuid || currentUser.id;
  const cache = app.cache().segment();
  
  let internalId = await cache.get(`uid_${zuid}`);
  
  if (!internalId) {
    const query = `SELECT ROWID FROM ${TABLE_USERS} WHERE zuid = '${zuid}' LIMIT 1`;
    const zcqlRes = await app.zcql().executeZCQLQuery(query);
    
    if (zcqlRes.length === 0) {
      throw new Error('Unauthorized: User profile not found.');
    }
    
    internalId = zcqlRes[0][TABLE_USERS].ROWID;
    await cache.put(`uid_${zuid}`, internalId, 24); 
  }
  
  return internalId;
}

async function runQuery(app, query, tableName) {
  const zcqlRes = await app.zcql().executeZCQLQuery(query);
  return zcqlRes.map(row => row[tableName] || row);
}

/* --- SECURE DATA OPERATIONS --- */

async function insertRecord(app, tableName, data, currentUser) {
  const internalId = await _getInternalUserId(app, currentUser);
  const table = app.datastore().table(tableName);
  // All secondary tables (Landlords, Properties, etc) must have a 'user_id' column
  const secureData = { ...data, user_id: internalId };
  return await table.insertRow(secureData);
}

async function updateRecordSecure(app, tableName, ROWID, updates, currentUser) {
  const internalId = await _getInternalUserId(app, currentUser);
  
  // For the 'Users' table specifically, the ROWID must match the internalId
  if (tableName === TABLE_USERS && String(ROWID) !== String(internalId)) {
    throw new Error('Forbidden: You can only update your own profile.');
  }

  // For other tables, we verify the user_id column
  if (tableName !== TABLE_USERS) {
    const checkQuery = `SELECT ROWID FROM ${tableName} WHERE ROWID = '${ROWID}' AND user_id = '${internalId}' LIMIT 1`;
    const exists = await runQuery(app, checkQuery, tableName);
    if (exists.length === 0) throw new Error('Forbidden: Access denied');
  }

  return await app.datastore().table(tableName).updateRow({ ...updates, ROWID });
}

async function findRecordSecure(app, tableName, column, value, currentUser) {
  const internalId = await _getInternalUserId(app, currentUser);
  const query = `SELECT * FROM ${tableName} WHERE ${column} = '${value}' AND user_id = '${internalId}' LIMIT 1`;
  const rows = await runQuery(app, query, tableName);
  return rows.length ? rows[0] : null;
}

module.exports = {
  insertRecord,
  updateRecordSecure,
  findRecordSecure,
  findProfileByZuid: async (app, zuid) => {
    const query = `SELECT * FROM ${TABLE_USERS} WHERE zuid = '${zuid}' LIMIT 1`;
    const res = await app.zcql().executeZCQLQuery(query);
    return res.length ? res[0][TABLE_USERS] : null;
  }
};