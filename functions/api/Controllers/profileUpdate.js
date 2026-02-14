// profileUpdate.js
const axios = require('axios');
const {
  findProfileByZaaid,
  findProfileByZuid,
  insertProfile,
  updateProfileById
} = require('../Models/datastore');

const ALLOWED_FIELDS = [
  'status','is_confirmed','email_id','first_name','last_name',
  'role_name','role_id','user_type','mobile','countryCode', 'mfa_enabled','otp_verified'
];

async function createOrGetProfile(app, currentUser, body) {
  const zaaid = currentUser.zaaid || currentUser.user_id || currentUser.id;
  if (!zaaid) {
    const err = new Error('Authenticated user has no id');
    err.status = 400;
    throw err;
  }

  const existing = await findProfileByZaaid(app, zaaid);
  if (existing) {
    return {
      statusCode: 200,
      payload: { status: 'success', action: 'exists', record: existing}
    };
  }

  const profileData = {
    zuid:         currentUser.zuid || body.zuid || '',
    zaaid:        currentUser.zaaid,
    org_id:       currentUser.org_id || '',
    status:       currentUser.status || 'active',
    is_confirmed: currentUser.is_confirmed || 'false',
    email_id:     currentUser.email_id || body.email_id || '',
    first_name:   body.first_name || currentUser.first_name || currentUser.display_name || '',
    last_name:    body.last_name || currentUser.last_name || '',
    role_name:    currentUser.role_details.role_name || '',
    role_id:      currentUser.role_details.role_id || '',
    user_type:    currentUser.user_type || '',
    mobile:       body.mobile || '',
    mfa_enabled:  body.mfa_enabled || 'false',
    otp_verified: body.otp_verified || 'false'
  };

  const inserted = await insertProfile(app, profileData);
  return {
    statusCode: 201,
    payload: { status: 'success', action: 'inserted', record: inserted}
  };
}

async function handleProfileUpdate(app, currentUser, body) {
  const zuid = body.zuid || currentUser.zuid || null;
  if (!zuid) {
    const err = new Error('zuid is required');
    err.status = 400;
    throw err;
  }

  const existing = await findProfileByZuid(app, zuid);
  if (!existing) {
    const err = new Error('Profile not found for provided zuid');
    err.status = 404;
    throw err;
  }

  const updates = {};
  for (const key of ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return {
      statusCode: 200,
      payload: { status: 'success', action: 'none', message: 'No updatable fields provided', record: existing }
    };
  }

  const updated = await updateProfileById(app, existing.$id, updates);
  return {
    statusCode: 200,
    payload: { status: 'success', action: 'updated', message: 'Profile updated', record: updated }
  };
}

async function handleUpdateMobile(app, currentUser, body) {
  const zuid = body.zuid || currentUser.zuid || null;
  if (!zuid) {
    const err = new Error('zuid is required');
    err.status = 400;
    throw err;
  }

  const existing = await findProfileByZuid(app, zuid);
  if (!existing) {
    const err = new Error('Profile not found');
    err.status = 404;
    throw err;
  }

  const { mobile, countryCode } = body;
  if (!mobile || !countryCode) {
    const err = new Error('mobile and countryCode are required');
    err.status = 400;
    throw err;
  }

  const updates = { mobile: mobile, countryCode: countryCode, otp_verified: 'false' };
  const updated = await updateProfileById(app, existing.$id, updates);

  return {
    statusCode: 200,
    payload: { status: 'success', message: 'Mobile updated', record: updated }
  };
}

async function handleSendOtp(app, currentUser, body) {
  const zuid = body.zuid || currentUser.zuid;
  const mobile = body.mobile || currentUser.mobile;

  if (!zuid || !mobile) throw new Error('zuid and mobile number are required');

  // 1. Generate OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

  // 2. Store in Cache (1 hour expiry for Catalyst)
  const segment = app.cache().segment();
  await segment.put(zuid, otpCode, 1);

  // 3. Send via DIDIT Service
  // Bypass if it's the test number
  if (mobile === process.env.TEST_MOBILE_BYPASS) {
    return { statusCode: 200, payload: { status: 'success', message: 'Test Mode: OTP generated but not sent.' } };
  }

  try {
    await axios.post(process.env.DIDIT_BASE_URL, {
      recipient: mobile,
      message: `Your verification code is: ${otpCode}`,
      // Add other Didit specific fields if required by their API
    }, {
      headers: { 
        'Authorization': `Bearer ${process.env.DIDIT_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Didit API Error:', error.response?.data || error.message);
    throw new Error('Failed to send SMS via Didit');
  }

  return {
    statusCode: 200,
    payload: { status: 'success', message: 'OTP sent to mobile' }
  };
}

async function handleVerifyOtp(app, currentUser, body) {
  const zuid = body.zuid || currentUser.zuid;
  const { otp } = body;

  if (!zuid || !otp) throw new Error('zuid and otp are required');

  // --- BYPASS LOGIC ---
  if (process.env.TEST_OTP_BYPASS && otp === process.env.TEST_OTP_BYPASS) {
    return await finalizeVerification(app, zuid, "Test Bypass");
  }

  const segment = app.cache().segment();
  const cachedOtp = await segment.get(zuid);

  if (!cachedOtp || cachedOtp !== otp) {
    const err = new Error(cachedOtp ? 'Invalid OTP' : 'OTP expired');
    err.status = 400;
    throw err;
  }

  await segment.delete(zuid);
  return await finalizeVerification(app, zuid, "Mobile SMS");
}

async function finalizeVerification(app, zuid, method) {
  const existing = await findProfileByZuid(app, zuid);
  if (existing) {
    await updateProfileById(app, existing.ROWID, { otp_verified: 'true' });
  }
  return {
    statusCode: 200,
    payload: { status: 'success', method: method, record: existing }
  };
}

module.exports = {
  createOrGetProfile,
  handleProfileUpdate,
  handleUpdateMobile,
  handleSendOtp,
  handleVerifyOtp,
};
