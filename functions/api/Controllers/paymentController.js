const axios = require('axios');
const { insertRecord, findRecordSecure, updateRecordSecure } = require('../Models/datastore');

async function handleAddLandlord(app, currentUser, body) {
  const landlordData = {
    full_name: body.full_name,
    email: body.email,
    bank_account_enc: body.bank_account, // Recommend encrypting this
    routing_number: body.routing_number,
    wallet_balance: 0
  };

  const record = await insertRecord(app, 'Landlords', landlordData, currentUser);
  return { statusCode: 201, payload: { status: 'success', record } };
}

async function handleAddProperty(app, currentUser, body) {
  const { landlordId, address, rentAmount } = body;

  // Verify landlord ownership before allowing property attachment
  const landlord = await findRecordSecure(app, 'Landlords', 'ROWID', landlordId, currentUser);
  if (!landlord) throw new Error('Landlord not found or access denied');

  const record = await insertRecord(app, 'Properties', {
    landlord_id: landlordId,
    address: address,
    rent_amount: parseFloat(rentAmount),
    currency: 'CAD',
    status: 'Active'
  }, currentUser);

  return { statusCode: 201, payload: { status: 'success', record } };
}


async function handleGenerateElavonSessionToken(amount) {
  try {
    // 1️⃣ Validate amount
    if (!amount || isNaN(amount)) {
      return {
        statusCode: 400,
        payload: { status: "error", message: "Invalid amount" }
      };
    }

    // 2️⃣ Determine environment URL
    const elavonUrl =
      process.env.ELAVON_ENV === "PROD"
        ? "https://api.convergepay.com/hosted-payments/transaction_token"
        : "https://api.demo.convergepay.com/hosted-payments/transaction_token";

    // 3️⃣ Build form body
    const formData = new URLSearchParams({
      ssl_merchant_id: "0022768",
      ssl_user_id: "apiuser",
      ssl_pin: "I65WWBCPV45S07VA7D8X9SA0CMT1JK12PPV9E6VPOLFUKL0QZLM3TMGUTYXGVDSL",
      ssl_transaction_type: "CCSALE",
      ssl_amount: parseFloat(amount).toFixed(2)
    });

    // 4️⃣ Make request
    const response = await axios.post(
      elavonUrl,
      formData.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        timeout: 15000
      }
    );

    // 5️⃣ Parse response
    const result = new URLSearchParams(response.data);
    const token = result.get("ssl_txn_auth_token");

    if (!token) {
      console.error("Elavon Token Missing:", response.data);
      return {
        statusCode: 500,
        payload: {
          status: "error",
          message: result.get("errorMessage") || "Token generation failed"
        }
      };
    }

    // 6️⃣ Success
    return {
      statusCode: 200,
      payload: {
        status: "success",
        sessionToken: token
      }
    };

  } catch (error) {
    console.error("======== ELAVON ERROR START ========");
    console.error("Message:", error.message);

    if (error.response) {
      console.error("Status Code:", error.response.status);
      console.error("Headers:", error.response.headers);
      console.error("Raw Response:", error.response.data);
    } else if (error.request) {
      console.error("No response received from Elavon");
    } else {
      console.error("Request setup error:", error);
    }

    console.error("======== ELAVON ERROR END ========");

    return {
      statusCode: 500,
      payload: {
        status: "error",
        message: "Elavon request failed",
        debug: error.response?.data || error.message
      }
    };
  }
}

module.exports = { handleAddLandlord, handleAddProperty, handleGenerateElavonSessionToken };