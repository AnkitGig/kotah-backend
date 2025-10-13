const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const { pathToFileURL } = require("url");
const sendOtp = require("../utils/sendOtp");

exports.login = async (req, res) => {
  const { email, password, fcmToken } = req.body;
  try {
    const normalizedEmail = String(email || "")
      .toLowerCase()
      .trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid email or password" });
    }
    if (!user.isVerified) {
      return res.status(403).json({
        status: false,
        message:
          "Account not verified. Please verify your email or phone before logging in.",
      });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ status: false, message: "Invalid email or password" });
    }
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    const profileComplete = Boolean(
      user.firstName &&
        user.lastName &&
        ((user.phone && user.phone.number) || user.number)
    );
    try {
      if (fcmToken) {
        if (!user.fcmToken || String(user.fcmToken) !== String(fcmToken)) {
          user.fcmToken = fcmToken;
          await user.save();
        }
      }
    } catch (e) {
      console.warn("Failed to save fcmToken for user", user._id, e);
    }

    res.json({
      status: true,
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        fcmToken: user.fcmToken || null,
        profileComplete,
      },
    });
  } catch (err) {
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.signup = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email: rawEmail,
      password,
      countryCode,
      phone,
    } = req.body || {};
    const email = String(rawEmail || "")
      .toLowerCase()
      .trim();

    if (!email || !password)
      return res
        .status(400)
        .json({ status: false, message: "Email and password are required" });

    const existing = await User.findOne({ email });
    if (existing)
      return res
        .status(400)
        .json({ status: false, message: "User already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    // generate a 6-digit numeric OTP
    const generatedOtp = String(Math.floor(100000 + Math.random() * 900000));

    const user = new User({
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      email,
      password: hashed,
      otpCode: generatedOtp,
      otpExpires: new Date(Date.now() + 10 * 60 * 1000),
      countryCode: countryCode,
      phone: phone,
    });
    await user.save();
    try {
      await sendOtp(user.email || user.phone, user.otpCode);
    } catch (e) {
      console.warn("sendOtp failed", e);
    }
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || "dev-secret",
      { expiresIn: "1d" }
    );
    res.status(201).json({
      status: true,
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
      otp: user.otpCode,
    });
  } catch (err) {
    console.error("signup error", err);
    if (err && err.code === 11000)
      return res
        .status(400)
        .json({ status: false, message: "Email already registered" });
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.completeProfile = async (req, res) => {
  try {
    const userId = req.user && req.user.userId;
    if (!userId)
      return res.status(401).json({ status: false, message: "Unauthorized" });

    const body = req.body || {};
    const update = {};

    if (body.firstName) update.firstName = body.firstName;
    if (body.lastName) update.lastName = body.lastName;
    if (body.number) update.number = body.number;
    if (body.phone) {
      try {
        update.phone =
          typeof body.phone === "string" ? JSON.parse(body.phone) : body.phone;
      } catch (e) {
        update.phone = { number: String(body.phone) };
      }
    }
    if (body.address) update.address = body.address;
    if (body.dob) update.dob = new Date(body.dob);
    if (body.gender) update.gender = body.gender;
    if (body.roleInFamily) update.roleInFamily = body.roleInFamily;
    if (body.locations) {
      try {
        update.locations =
          typeof body.locations === "string"
            ? JSON.parse(body.locations)
            : body.locations;
      } catch (e) {}
    }

    if (req.file) {
      try {
        const existingUser = await User.findById(userId).select("avatarUrl");
        const uploaderPath = path.join(
          __dirname,
          "..",
          "utils",
          "customUploader.js"
        );
        const uploaderModule = await import(pathToFileURL(uploaderPath).href);
        const customUploader =
          uploaderModule && uploaderModule.default
            ? uploaderModule.default
            : uploaderModule;

        const uploadedUrl = await customUploader({
          file: req.file,
          oldUrl:
            existingUser && existingUser.avatarUrl
              ? existingUser.avatarUrl
              : null,
          folder: "uploads",
        });

        if (uploadedUrl) {
          update.avatarUrl = uploadedUrl;
        } else {
          update.avatarUrl = path
            .relative(process.cwd(), req.file.path)
            .replace(/\\/g, "/");
        }
      } catch (e) {
        console.error("Avatar upload error:", e);
        update.avatarUrl = path
          .relative(process.cwd(), req.file.path)
          .replace(/\\/g, "/");
      }
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: update },
      { new: true }
    ).select("-password");
    if (!user)
      return res.status(404).json({ status: false, message: "User not found" });
    res.json({ status: true, user });
  } catch (err) {
    console.error("completeProfile error", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { email: rawEmail, code } = req.body || {};
    const email = String(rawEmail || "")
      .toLowerCase()
      .trim();
    if (!email || !code)
      return res
        .status(400)
        .json({ status: false, message: "Email and code are required" });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ status: false, message: "User not found" });

    if (!user.otpCode || !user.otpExpires)
      return res.status(400).json({ status: false, message: "No OTP pending" });

    if (new Date() > new Date(user.otpExpires))
      return res.status(400).json({ status: false, message: "OTP expired" });

    if (String(code) !== String(user.otpCode))
      return res
        .status(400)
        .json({ status: false, message: "Invalid OTP code" });

    user.isVerified = true;
    user.otpCode = undefined;
    user.otpExpires = undefined;
    user.otpVerified = true;
    await user.save();

    res.json({
      status: true,
      message: "Verified",
      user: { id: user._id, email: user.email, isVerified: user.isVerified },
    });
  } catch (err) {
    console.error("verifyOtp error", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

// Verify OTP for password reset (separate from account verification)
exports.verifyResetOtp = async (req, res) => {
  try {
    const { email: rawEmail, code } = req.body || {};
    const email = String(rawEmail || "")
      .toLowerCase()
      .trim();
    if (!email || !code)
      return res
        .status(400)
        .json({ status: false, message: "Email and code are required" });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ status: false, message: "User not found" });

    if (!user.otpCode || !user.otpExpires)
      return res.status(400).json({ status: false, message: "No OTP pending" });

    if (new Date() > new Date(user.otpExpires))
      return res.status(400).json({ status: false, message: "OTP expired" });

    if (String(code) !== String(user.otpCode))
      return res
        .status(400)
        .json({ status: false, message: "Invalid OTP code" });

    const resetToken = jwt.sign(
      { email: user.email, purpose: "password-reset" },
      process.env.JWT_SECRET || "dev-secret",
      { expiresIn: "15m" }
    );

    res.json({ status: true, message: "OTP verified", resetToken });
  } catch (err) {
    console.error("verifyResetOtp error", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");
    if (!user)
      return res.status(404).json({ status: false, message: "User not found" });
    res.json({ status: true, user });
  } catch (err) {
    res.status(500).json({ status: false, message: "Server error" });
  }
};

// Request a password reset using OTP. Generates an OTP and sets expiry on the user.
exports.forgotPassword = async (req, res) => {
  try {
    const { email: rawEmail } = req.body || {};
    const email = String(rawEmail || "")
      .toLowerCase()
      .trim();
    if (!email)
      return res
        .status(400)
        .json({ status: false, message: "Email is required" });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ status: false, message: "User not found" });

    // Generate 6-digit numeric OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    user.otpCode = otp;
    // 10 minutes expiry
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();
    try {
      await sendOtp(user.email || user.phone, user.otpCode);
    } catch (e) {
      console.warn("forgotPassword: notify failed", e);
    }
    res.json({ status: true, message: "Password reset OTP sent" });
  } catch (err) {
    console.error("forgotPassword error", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

// Reset password using either resetToken (preferred) or email+code (legacy)
exports.resetPassword = async (req, res) => {
  try {
    const { email: rawEmail, code, newPassword, resetToken } = req.body || {};

    if (!newPassword)
      return res
        .status(400)
        .json({ status: false, message: "newPassword is required" });

    let user = null;

    if (resetToken) {
      try {
        const payload = jwt.verify(
          resetToken,
          process.env.JWT_SECRET || "dev-secret"
        );
        if (!payload || payload.purpose !== "password-reset" || !payload.email)
          return res
            .status(400)
            .json({ status: false, message: "Invalid reset token" });
        const tokenEmail = String(payload.email).toLowerCase().trim();
        const providedEmail = String(rawEmail || "")
          .toLowerCase()
          .trim();
        if (providedEmail && tokenEmail !== providedEmail)
          return res.status(400).json({
            status: false,
            message: "Reset token does not match provided email",
          });
        user = await User.findOne({ email: tokenEmail });
        if (!user)
          return res
            .status(404)
            .json({ status: false, message: "User not found" });
      } catch (e) {
        return res
          .status(400)
          .json({ status: false, message: "Invalid or expired reset token" });
      }
    } else {
      // Flow B: fallback to email + code (legacy)
      const email = String(rawEmail || "")
        .toLowerCase()
        .trim();
      if (!email || !code)
        return res.status(400).json({
          status: false,
          message: "Email, code and newPassword are required",
        });

      user = await User.findOne({ email });
      if (!user)
        return res
          .status(404)
          .json({ status: false, message: "User not found" });

      if (!user.otpCode || !user.otpExpires)
        return res
          .status(400)
          .json({ status: false, message: "No OTP pending" });

      if (new Date() > new Date(user.otpExpires))
        return res.status(400).json({ status: false, message: "OTP expired" });

      if (String(code) !== String(user.otpCode))
        return res
          .status(400)
          .json({ status: false, message: "Invalid OTP code" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    // Clear OTP state
    user.otpCode = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.json({ status: true, message: "Password has been reset" });
  } catch (err) {
    console.error("resetPassword error", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

// Change password for authenticated user
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user && req.user.userId;
    if (!userId)
      return res.status(401).json({ status: false, message: "Unauthorized" });

    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword)
      return res.status(400).json({
        status: false,
        message: "currentPassword and newPassword are required",
      });

    const user = await User.findById(userId).select("+password");
    if (!user)
      return res.status(404).json({ status: false, message: "User not found" });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch)
      return res
        .status(400)
        .json({ status: false, message: "Current password is incorrect" });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ status: true, message: "Password changed successfully" });
  } catch (err) {
    console.error("changePassword error", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};
