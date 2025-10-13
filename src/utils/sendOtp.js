const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

async function sendEmail(to, code) {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  const APP_NAME = process.env.APP_NAME || "Kotah";
  const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || process.env.SMTP_FROM || "support@kotah.example";
  const APP_URL = process.env.APP_URL || "https://kotah.example";
  const YEAR = new Date().getFullYear();

  const subject = `${APP_NAME} — Your verification code`;
  const text = `Your verification code is: ${code}`;

  // Try to load HTML template from file; fall back to a simple HTML string if not available
  let html = `<p>Your verification code is: <strong>${code}</strong></p>`;
  try {
    const tplPath = path.join(__dirname, "kotah-otp-template.html");
    if (fs.existsSync(tplPath)) {
      const tpl = fs.readFileSync(tplPath, "utf8");
      html = tpl
        .replace(/{{APP_NAME}}/g, APP_NAME)
        .replace(/{{CODE}}/g, code)
        .replace(/{{YEAR}}/g, String(YEAR))
        .replace(/{{SUPPORT_EMAIL}}/g, SUPPORT_EMAIL)
        .replace(/{{APP_URL}}/g, APP_URL);
    }
  } catch (err) {
    console.warn("[sendOtp] Failed to load HTML template, using simple fallback", err.message || err);
  }

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
