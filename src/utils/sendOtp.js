const nodemailer = require("nodemailer");

function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

async function sendEmail(to, code) {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  const subject = `Your verification code`;
  const text = `Your verification code is: ${code}`;
  const html = `<p>Your verification code is: <strong>${code}</strong></p>`;

  if (!smtpUser || !smtpPass) {
    console.log("[sendOtp] SMTP not configured — falling back to log");
    console.log(`Sending OTP ${code} to ${to}`);
    return { ok: true, fallback: true };
  }

  // Create SMTP transporter using Gmail App Password or any SMTP
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : true,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const mailOptions = {
    from: process.env.SMTP_FROM || smtpUser,
    to,
    subject,
    text,
    html,
  };

  const info = await transporter.sendMail(mailOptions);
  return { ok: true, info };
}

module.exports = async function sendOtp(destination, code) {
  try {
    const emailCandidate =
      typeof destination === "string"
        ? destination
        : destination &&
          (destination.email || destination.number || destination.phone);
    const email =
      typeof destination === "object" && destination && destination.email
        ? destination.email
        : typeof destination === "string"
        ? destination
        : null;

    if (email && isValidEmail(email)) {
      try {
        return await sendEmail(email, code);
      } catch (err) {
        console.error("[sendOtp] sendEmail failed", err);
        return { ok: false, error: err };
      }
    }

    if (destination && (destination.number || destination.phone)) {
      console.log(
        "[sendOtp] No valid email available. Using phone fallback (log only)."
      );
      console.log("Phone destination:", destination);
      console.log(`OTP ${code}`);
      return { ok: true, fallback: true };
    }

    console.warn("[sendOtp] No valid destination provided");
    return { ok: false, error: "No destination" };
  } catch (err) {
    console.error("Failed to send OTP", err);
    return { ok: false, error: err };
  }
};
