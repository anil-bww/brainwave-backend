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

async function handleGenerateElavonSessionToken(app, currentUser, body) {
  //const { amount } = body;
  amount = 50.00;
  if (!amount || isNaN(parseFloat(amount))) {
    return {
      statusCode: 400,
      payload: { status: "error", message: "Invalid amount" }
    };
  }

  const elavonUrl = process.env.ELAVON_ENV === "PROD"
    ? "https://api.convergepay.com/hosted-payments/transaction_token"
    : "https://api.demo.convergepay.com/hosted-payments/transaction_token";

  const formData = new URLSearchParams({
    ssl_merchant_id: "0022768", //process.env.ELAVON_MERCHANT_ID,
    ssl_user_id: "apiuser",//process.env.ELAVON_USER_ID,
    ssl_pin: "I65WWBCPV45S07VA7D8X9SA0CMT1JK12PPV9E6VPOLFUKL0QZLM3TMGUTYXGVDSL",//process.env.ELAVON_PIN,
    ssl_transaction_type: "CCSALE",
    ssl_amount: String(parseFloat(amount).toFixed(2))
  });

  try {
    const response = await axios.post(
      elavonUrl,
      formData.toString(),
      { headers: { "Content-Type": "application/json" } }
    );

    const result = Object.fromEntries(new URLSearchParams(response.data));

    if (!result.ssl_txn_auth_token) {
      throw new Error(result.errorMessage || "Token generation failed");
    }

    return {
      statusCode: 200,
      payload: {
        status: "success",
        sessionToken: result.ssl_txn_auth_token
      }
    };

  } catch (err) {
    console.log("ELAVON ERROR:", err.response?.data);
    
    return {
      statusCode: 500,
      payload: {
        status: "error",
        message: err.response?.data || err.message
      }
    };
  }
}

module.exports = { handleAddLandlord, handleAddProperty, handleGenerateElavonSessionToken };