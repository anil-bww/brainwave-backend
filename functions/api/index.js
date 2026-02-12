const express = require('express');
const { verifyAuth } = require('./Controllers/auth');
const { createOrGetProfile, handleUpdateMobile } = require('./Controllers/profileUpdate');

const app = express();
app.use(express.json());

app.post('/profileUpdate', async (req, res) => {
  try {
    const { app: catalystApp, currentUser } = await verifyAuth(req, res);
    const result = await createOrGetProfile(catalystApp, currentUser, req.body);
    res.status(result.statusCode || 200).json(result.payload);
  } catch (err) {
    res.status(err.status || 500).json({ status: 'error', message: err.message });
  }
});

app.post('/updateMobile', async (req, res) => {
  try {
    const { app: catalystApp, currentUser } = await verifyAuth(req, res);
    const result = await handleUpdateMobile(catalystApp, currentUser, req.body);
    res.status(result.statusCode || 200).json(result.payload);
  } catch (err) {
    res.status(err.status || 500).json({ status: 'error', message: err.message });
  }
});

module.exports = (req, res) => {
  app(req, res);
};
