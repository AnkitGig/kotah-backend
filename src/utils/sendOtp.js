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
  // Add sensible timeouts so that unresponsive SMTP servers don't hang requests
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : true,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    // connection timeout in ms, greeting timeout, socket timeout
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 10000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 5000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 10000),
  });

  const mailOptions = {
    from: process.env.SMTP_FROM || smtpUser,
    to,
    subject,
    text,
    html,
  };

  // Wrap sendMail in a promise that enforces an overall timeout
  const sendMailWithTimeout = (transporter, mailOpts, timeoutMs = 12000) => {
    return new Promise((resolve, reject) => {
      let finished = false;
      const timer = setTimeout(() => {
        if (finished) return;
        finished = true;
        const err = new Error(`sendMail timed out after ${timeoutMs}ms`);
        err.code = 'SENDMAIL_TIMEOUT';
        try {
          // close transporter if possible
          if (transporter && typeof transporter.close === 'function') transporter.close();
        } catch (e) {}
        reject(err);
      }, timeoutMs);

      transporter.sendMail(mailOpts, (err, info) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (err) return reject(err);
        resolve(info);
      });
    });
  };

  try {
    const info = await sendMailWithTimeout(transporter, mailOptions, Number(process.env.SMTP_SEND_TIMEOUT_MS || 12000));
    return { ok: true, info };
  } catch (err) {
    console.error('[sendOtp] sendMail error or timeout', err && err.message ? err.message : err);
    // Close transporter to free sockets
    try {
      if (transporter && typeof transporter.close === 'function') transporter.close();
    } catch (e) {}
    return { ok: false, error: err };
  }
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
