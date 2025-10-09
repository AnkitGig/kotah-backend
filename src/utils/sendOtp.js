// Minimal OTP sender util — in dev it just logs and returns success.
module.exports = async function sendOtp(destination, code) {
  // destination can be a phone object or email string
  // Replace with real SMS/email provider in production.
  try {
    console.log(`Sending OTP ${code} to`, destination);
    // simulate async send
    await new Promise((r) => setTimeout(r, 50));
    return { ok: true };
  } catch (err) {
    console.error('Failed to send OTP', err);
    return { ok: false, error: err };
  }
};
