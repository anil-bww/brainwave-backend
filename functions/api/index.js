const express = require('express');
const { verifyAuth } = require('./Controllers/auth');
const { createOrGetProfile, handleUpdateMobile, handleSendOtp, handleVerifyOtp } = require('./Controllers/profileUpdate');
const { handleAddLandlord, handleAddProperty, handleGenerateElavonSessionToken } = require('./Controllers/paymentController');
const { handleCreateKycSession } = require('./Controllers/kycController');
const app = express();
app.use(express.json());

app.post('/profileUpdate', async (req, res) => {
  try {
    const axios = require('axios');
    
    const { app: catalystApp, currentUser } = await verifyAuth(req, res);
    const result = await createOrGetProfile(catalystApp, currentUser, req.body);
    res.status(result.statusCode || 200).json(result.payload);
  } catch (err) {
    res.status(err.status || 500).json({ status: 'error', message: err.message});
  }
});

app.post('/updateMobile', async (req, res) => {
  try {
    const { app: catalystApp, currentUser } = await verifyAuth(req, res);
    const result = await handleUpdateMobile(catalystApp, currentUser, req.body);
    res.status(result.statusCode || 200).json(result.payload);
  } catch (err) {
    res.status(err.status || 500).json({ status: 'error1', message: err.message });
  }
});

// Route to generate and cache OTP
app.post('/sendOtp', async (req, res) => {
  try {
    const { app: catalystApp, currentUser } = await verifyAuth(req, res);
    const result = await handleSendOtp(catalystApp, currentUser, req.body);
    res.status(result.statusCode || 200).json(result.payload);
  } catch (err) {
    res.status(err.status || 500).json({ status: 'error', message: err.message });
  }
});

// Route to verify OTP from cache
app.post('/verifyOtp', async (req, res) => {
  try {
    const { app: catalystApp, currentUser } = await verifyAuth(req, res);
    const result = await handleVerifyOtp(catalystApp, currentUser, req.body);
    res.status(result.statusCode || 200).json(result.payload);
  } catch (err) {
    res.status(err.status || 500).json({ status: 'error', message: err.message });
  }
});

app.post('/kyc/createSession', async (req, res) => {
  try {
    const { app: catalystApp, currentUser } = await verifyAuth(req, res);
    const result = await handleCreateKycSession(catalystApp, currentUser, req.body);
    res.status(result.statusCode).json(result.payload);
  } catch (err) {
    res.status(err.status || 500).json({ status: 'error', message: err.message });
  }
});

// PUBLIC WEBHOOK ENDPOINT
app.post('/kyc/webhook', async (req, res) => {
  try {
    const signatureHeader = req.headers["x-didit-signature"];
    const webhookSecret = "vdfVyngtYKAa5EOro0wsJCBf0U0PifOlQ9Gvs9QjGkg"; //process.env.DIDIT_WEBHOOK_SECRET;

    if (!signatureHeader) {
      return res.status(400).send("Missing signature");
    }

    // Example: "t=1700000000,v1=abc123"
    const parts = signatureHeader.split(",");
    const timestamp = parts[0].split("=")[1];
    const receivedSignature = parts[1].split("=")[1];

    const payload = timestamp + "." + req.body.toString();

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(payload)
      .digest("hex");

    if (expectedSignature == receivedSignature) {
      const result = await handleDiditWebhook(req); // Pass raw req to check headers
      res.status(result.statusCode).json(result.payload);
    }else {
      res.status(400).json({ status: 'error', message: "Invalid signature" });
    }
    
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});


app.post('/payment/generateToken', async (req, res) => {
  try {
    const { app: catalystApp, currentUser } = await verifyAuth(req, res);
    const result = await handleGenerateElavonSessionToken(50.00);
    res.status(result.statusCode).json(result.payload);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/landlord/register', async (req, res) => {
  try {
    const { app: catalystApp, currentUser } = await verifyAuth(req, res);
    const result = await handleAddLandlord(catalystApp, currentUser, req.body);
    res.status(result.statusCode).json(result.payload);
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/property/add', async (req, res) => {
  try {
    const { app: catalystApp, currentUser } = await verifyAuth(req, res);
    const result = await handleAddProperty(catalystApp, currentUser, req.body);
    res.status(result.statusCode).json(result.payload);
  } catch (err) {    res.status(err.status || 500).json({ status: 'error', message: err.message });
  }
});

module.exports = (req, res) => {
  app(req, res);
};
