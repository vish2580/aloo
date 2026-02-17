const crypto = require('crypto');

// Generate unique referral code
const generateReferralCode = (length = 8) => {
  return crypto.randomBytes(length).toString('hex').toUpperCase().substring(0, length);
};

// Generate unique red envelope code
const generateRedEnvelopeCode = () => {
  const prefix = 'RE';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}${timestamp}${random}`;
};

// Build referral link
const buildReferralLink = (code) => {
  const baseUrl = process.env.APP_BASE_URL || 'https://luxwin.app';
  return `${baseUrl}/register?ref=${code}`;
};

// Calculate multi-level referrals
const calculateReferralLevel = async (referredBy, Referral) => {
  if (!referredBy) return 1;
  
  const referrer = await Referral.getByUserId(referredBy);
  if (!referrer) return 1;
  
  // If referrer has a referrer, this is level 2
  if (referrer.referred_by) {
    const parentReferrer = await Referral.getByUserId(referrer.referred_by);
    // If parent referrer has a referrer, this is level 3
    if (parentReferrer && parentReferrer.referred_by) {
      return 3;
    }
    return 2;
  }
  
  return 1;
};

module.exports = {
  generateReferralCode,
  generateRedEnvelopeCode,
  buildReferralLink,
  calculateReferralLevel,
};
