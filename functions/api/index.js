
const express = require('express');
//const cors = require('cors');
const { verifyAuth } = require('./Controllers/auth');
const { createOrGetProfile, handleProfileUpdate, handleUpdateMobile } = require('./Controllers/profileUpdate');

const app = express();

app.use(express.json());

// POST /profileUpdate update allowed fields by zuid
app.post('/profileUpdate', async (req, res) => {
  try {
    const { app: catalystApp, currentUser } = await verifyAuth(req, res);
    const result = await createOrGetProfile(catalystApp, currentUser, req.body);
    return res.status(result.statusCode || 200).json(result.payload);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ status: 'error1', message: err.message });
  }
});

// POST /updateMobile update mobile for 2FA
app.post('/updateMobile', async (req, res) => {
  try {
    const { app: catalystApp, currentUser } = await verifyAuth(req, res);
    const result = await handleUpdateMobile(catalystApp, currentUser, req.body);
    return res.status(result.statusCode || 200).json(result.payload);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ status: 'error', message: err.message });
  }
});

module.exports = app;
