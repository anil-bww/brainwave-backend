const express = require('express');
const catalyst = require('zcatalyst-sdk-node');
const crypto = require('crypto');
const { findProfileByZuid, updateRecordSecure } = require('./datastore');

const app = express();

// 1. CRITICAL: Capture the raw body string for the HMAC hash
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

app.post('/kyc', async (req, res) => {
  try {
    const catalystApp = catalyst.initialize(req);
    const webhookSecret = "vdfVyngtYKAa5EOro0wsJCBf0U0PifOlQ9Gvs9QjGkg";//process.env.DIDIT_WEBHOOK_SECRET;
    
    // 2. Get the signature from headers
    const incomingSignature = req.headers['x-signature-v2'];

    if (!incomingSignature || !webhookSecret) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized: Missing credentials' });
    }

    // 3. Re-calculate the HMAC SHA-256 signature using the rawBody
    const computedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(req.rawBody)
      .digest('hex');

    // 4. Constant-time comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(incomingSignature, 'utf8'),
      Buffer.from(computedSignature, 'utf8')
    );

    if (!isValid) {
      console.error("Signature Mismatch!");
      return res.status(401).json({ status: 'error', message: 'Invalid Signature' });
    }

    // --- VALIDATION PASSED ---
    const event = req.body;
    const metadata = event.metadata || "";
    const zuid = metadata.replace("user_zuid_", "");

    if (!zuid) {
      return res.status(400).json({ status: 'error', message: 'ZUID not found in metadata' });
    }

    // 5. Update the Datastore
    const existing = await findProfileByZuid(catalystApp, zuid);
    if (existing) {
      const kycStatus = (event.status || 'UNKNOWN').toUpperCase();
      
      await updateRecordSecure(catalystApp, 'Users', existing.ROWID, {
        kyc_status: kycStatus,
        kyc_raw_data: req.rawBody // Store the full 281-byte JSON string
      }, { zuid: zuid }); // Mock user object for ownership check
      
      console.log(`User ${zuid} updated to ${kycStatus}`);
    }

    return res.status(200).json({ status: 'success' });

  } catch (err) {
    console.error("Webhook Error:", err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = app;