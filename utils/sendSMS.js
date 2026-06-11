// utils/sendSMS.js
module.exports = async (phone, message) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📱 [DEV SMS] To ${phone}: ${message}`);
    return { success: true };
  }
  // Real Eskiz/Playmobile call goes here later
};