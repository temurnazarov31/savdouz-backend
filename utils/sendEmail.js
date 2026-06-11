// utils/sendEmail.js
module.exports = async (email, subject, message) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📧 [DEV EMAIL] To ${email}: ${message}`);
    return { success: true };
  }
  // Real Resend call goes here later
};