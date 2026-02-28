const axios = require('axios');

const {
  findProfileByZuid,
  insertRecord, // Changed to generic insert for user_id tagging
  updateRecordSecure
} = require('../Models/datastore');

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
        vendor_data: `user_zuid_${currentUser.zuid}`,
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

module.exports = { handleCreateKycSession };