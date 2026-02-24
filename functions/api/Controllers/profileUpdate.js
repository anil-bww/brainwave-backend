const axios = require('axios');
const {
  findProfileByZuid,
  insertRecord, // Changed to generic insert for user_id tagging
  updateRecordSecure
} = require('../Models/datastore');

const ALLOWED_FIELDS = [
  'status', 'is_confirmed', 'email_id', 'first_name', 'last_name',
  'role_name', 'role_id', 'user_type', 'mobile', 'countryCode', 
  'mfa_enabled', 'otp_verified'
];

async function createOrGetProfile(app, currentUser, body) {
  const zuid = currentUser.zuid;
  if (!zuid) throw new Error('Authenticated user has no zuid');

  const existing = await findProfileByZuid(app, zuid);
  if (existing) {
    return {
      statusCode: 200,
      payload: { status: 'success', action: 'exists', record: existing }
    };
  }

  const profileData = {
    zuid: zuid,
    zaaid: currentUser.zaaid || '',
    org_id: currentUser.org_id || '',
    status: 'active',
    is_confirmed: 'true',
    email_id: currentUser.email_id || '',
    first_name: currentUser.first_name || '',
    last_name: currentUser.last_name || '',
    role_name: currentUser.role_details?.role_name || '',
    role_id: currentUser.role_details?.role_id || '',
    user_type: currentUser.user_type || '',
    mobile: body.mobile || '',
    countryCode: body.countryCode || '',
    mfa_enabled: 'false',
    otp_verified: 'false'
  };

  // Using datastore.js helper to ensure user_id is set
  const table = app.datastore().table('Users');
  const inserted = await table.insertRow(profileData);
  return {
    statusCode: 201,
    payload: { status: 'success', action: 'inserted', record: inserted }
  };
}

async function handleProfileUpdate(app, currentUser, body) {
  const existing = await findProfileByZuid(app, currentUser.zuid);
  if (!existing) throw new Error('Profile not found');

  const updates = {};
  for (const key of ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      updates[key] = body[key];
    }
  }

  // Use updateRecordSecure to enforce that only own profile can be updated
  const updated = await updateRecordSecure(app, 'Users', existing.ROWID, updates, currentUser);
  return {
    statusCode: 200,
    payload: { status: 'success', action: 'updated', record: updated }
  };
}

async function handleUpdateMobile(app, currentUser, body) {
  const { mobile, countryCode } = body;
  if (!mobile || !countryCode) throw new Error('mobile and countryCode are required');

  const existing = await findProfileByZuid(app, currentUser.zuid);
  if (!existing) throw new Error('Profile not found');

  const updates = { mobile, countryCode, otp_verified: 'false' };
  
  const segment = app.cache().segment();
  if(body.otp){
    if (body.otp == await segment.getValue(zuid)){
      // Securely update using the internal ROWID
      const updated = await updateRecordSecure(app, 'Users', existing.ROWID, updates, currentUser);
      return {
        statusCode: 200,
        payload: { status: 'success', message: 'Mobile updated', record: updated }
      };
    }else{
      return {
        statusCode: 400,
        payload: { status: 'error', message: 'Invalid OTP' }
      };
    }
  }
  const result = await handleSendOtp(app, currentUser, body);  
  if(result.statusCode && result.statusCode == 200) {
    const updated = await updateRecordSecure(app, 'Users', existing.ROWID, updates, currentUser);
    return result;  
  }
  
}

async function handleSendOtp(app, currentUser, body) {
  const zuid = currentUser.zuid;
  const mobile = body.mobile || currentUser.mobile;
  if (!mobile) throw new Error('Mobile number is required');

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const segment = app.cache().segment();
  await segment.put(zuid, otpCode, 1);

  
  return { statusCode: 200, payload: { status: 'success', message: 'OTP sent ' + otpCode} };
  
  await axios.post(process.env.DIDIT_BASE_URL, {
    recipient: mobile,
    message: `Your verification code is: ${otpCode}`
  }, {
    headers: { 'Authorization': `Bearer ${process.env.DIDIT_API_KEY}` }
  });

  return { statusCode: 200, payload: { status: 'success', message: 'OTP sent' } };
}

async function handleVerifyOtp(app, currentUser, body) {
  const { otp } = body;
  const zuid = currentUser.zuid;

  const segment = app.cache().segment();
  const cachedOtp = await segment.getValue(zuid);

  if (!cachedOtp || cachedOtp !== otp) throw new Error('Invalid or expired OTP');

  await segment.delete(zuid);
  return await finalizeVerification(app, currentUser, "Mobile SMS");
}

async function finalizeVerification(app, currentUser, method) {
  const existing = await findProfileByZuid(app, currentUser.zuid);
  await updateRecordSecure(app, 'Users', existing.ROWID, { otp_verified: 'true' }, currentUser);
  
  return {
    statusCode: 200,
    payload: { status: 'success', method, record: { ...existing, otp_verified: 'true' } }
  };
}

module.exports = {
  createOrGetProfile,
  handleProfileUpdate,
  handleUpdateMobile,
  handleSendOtp,
  handleVerifyOtp
};