const axios = require('axios');

async function handleCreateKycSession(app, currentUser, body) {
  try {
    const vendorEmail = body.email || currentUser.email_id;
    
    // Using the credentials provided
    const DIDIT_API_KEY = process.env.DIDIT_API_KEY || "2Lw8Av4OXCzvzU8PaLhRNb8xPow0qWtNFkcILH6hqlc";
    const WORKFLOW_ID = process.env.WORKFLOW_ID || "5abd838f-1ad0-4fd2-a33e-e889e6f7a3b2";
    const CALLBACK_URL = "https://fintech-react-app-tacbbiyi.onslate.com";

    const response = await axios.post(
      "https://verification.didit.me/v3/session/",
      {
        workflow_id: WORKFLOW_ID,
        vendor_data: vendorEmail,
        callback: CALLBACK_URL,
        metadata: `user_zuid_${currentUser.zuid}` // Helpful for tracking in webhooks
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": DIDIT_API_KEY
        }
      }
    );

    // Optional: Mark user as 'Pending' in DB immediately
    const existing = await findProfileByZuid(app, currentUser.zuid);
    if (existing) {
      await updateRecordSecure(app, 'Users', existing.ROWID, { kyc_status: 'Pending' }, currentUser);
    }
    
    return {
      statusCode: 200,
      payload: {
        status: 'success',
        data: response.data
      }
    };

  } catch (error) {
    console.error("KYC Session Error:", error.response?.data || error.message);
    return {
      statusCode: 500,
      payload: {
        status: "error",
        message: "Failed to create KYC session",
        debug: error.response?.data || error.message
      }
    };
  }
}

async function handleDiditWebhook(req) {
  const app = catalyst.initialize(req);
  const event = req.body; // Full JSON from Didit

  // 1. Extract ZUID from metadata
  const metadata = event.session?.metadata || "";
  const zuid = metadata.startsWith("user_zuid_") ? metadata.split("_")[2] : null;

  if (!zuid) {
    console.error("Webhook Error: No ZUID in metadata", event);
    return { statusCode: 400, payload: { message: "Metadata missing ZUID" }};
  }

  try {
    const existing = await findProfileByZuid(app, zuid);
    if (!existing) {
      return { statusCode: 404, payload: { message: "User not found" }};
    }

    // 2. Prepare update data
    // status: 'approved', 'declined', 'expired', etc.
    const decisionStatus = event.decision?.status || 'unknown';
    
    const updateData = {
      kyc_status: decisionStatus.toUpperCase(),
      // We stringify the entire JSON payload to store it in the kyc_raw_data column
      kyc_raw_data: JSON.stringify(event) 
    };

    // 3. Update the record
    // We pass a mock currentUser object to satisfy the updateRecordSecure ownership check
    await updateRecordSecure(app, 'Users', existing.ROWID, updateData, { zuid: zuid });

    console.log(`KYC Webhook processed for ${zuid}: ${decisionStatus}`);
    return { statusCode: 200, payload: { status: 'success' } };

  } catch (err) {
    console.error("Webhook Update Failed:", err.message);
    return { statusCode: 500, payload: { status: 'error', message: err.message } };
  }
}

module.exports = { handleCreateKycSession, handleDiditWebhook };