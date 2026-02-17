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

async function handleGenerateElavonToken(app, currentUser, body) {
  const { cardNumber, expiryDate, cvv, propertyId, nextBillingDate } = body;

  const elavonParams = new URLSearchParams({
    ssl_merchant_id: process.env.ELAVON_MERCHANT_ID,
    ssl_user_id: process.env.ELAVON_USER_ID,
    ssl_pin: process.env.ELAVON_PIN,
    ssl_transaction_type: 'ccgettoken',
    ssl_card_number: cardNumber,
    ssl_exp_date: expiryDate,
    ssl_cvv2cvc2: cvv,
    ssl_add_token: 'Y'
  });

  try {
    const response = await axios.post(process.env.ELAVON_API_URL, elavonParams.toString());
    const result = Object.fromEntries(new URLSearchParams(response.data));

    if (result.ssl_result !== '0') throw new Error(result.ssl_result_message);

    // Securely link token to Tenant record belonging to this user
    const tenantRecord = await insertRecord(app, 'Tenants', {
      property_id: propertyId,
      elavon_token: result.ssl_token,
      next_billing_date: nextBillingDate,
      is_active: 'true'
    }, currentUser);

    return { statusCode: 201, payload: { status: 'success', record: tenantRecord } };
  } catch (err) {
    throw new Error('Elavon Tokenization failed: ' + err.message);
  }
}

module.exports = { handleAddLandlord, handleAddProperty, handleGenerateElavonToken };