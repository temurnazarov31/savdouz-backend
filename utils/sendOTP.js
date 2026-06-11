// utils/sendOTP.js
module.exports = async (user, code) => {
  console.log(`[DEV] OTP for ${user.email || user.phone}: ${code}`);
  // Later: replace with Resend / Eskiz / Telegram
};