const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const { pathToFileURL } = require("url");
const sendOtp = require("../utils/sendOtp");

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const normalizedEmail = String(email || "")
      .toLowerCase()
      .trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(400).json({ status: false, message: "Invalid email or password" });
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
      return res.status(400).json({ status: false, message: "Invalid email or password" });
    }
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );
    res.json({
      status: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.signup = async (req, res) => {
  try {
    const { firstName, lastName, email: rawEmail, password } = req.body || {};
    const email = String(rawEmail || "")
      .toLowerCase()
      .trim();

    if (!email || !password)
      return res
        .status(400)
        .json({ status: false, message: "Email and password are required" });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ status: false, message: "User already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const user = new User({
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      email,
      password: hashed,
      otpCode: "0000",
      otpExpires: new Date(Date.now() + 10 * 60 * 1000),
    });
    await user.save();
    try {
      await sendOtp(user.phone || user.email, user.otpCode);
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
      return res.status(400).json({ status: false, message: "Email already registered" });
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.completeProfile = async (req, res) => {
  try {
    const userId = req.user && req.user.userId;
  if (!userId) return res.status(401).json({ status: false, message: "Unauthorized" });

    const body = req.body || {};
    const update = {};

    if (body.firstName) update.firstName = body.firstName;
    if (body.lastName) update.lastName = body.lastName;
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
    if (!user) return res.status(404).json({ status: false, message: "User not found" });
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
      return res.status(400).json({ status: false, message: "Email and code are required" });

    const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ status: false, message: "User not found" });

    if (!user.otpCode || !user.otpExpires)
      return res.status(400).json({ status: false, message: "No OTP pending" });

    if (new Date() > new Date(user.otpExpires))
      return res.status(400).json({ status: false, message: "OTP expired" });

    if (String(code) !== String(user.otpCode))
      return res.status(400).json({ status: false, message: "Invalid OTP code" });

    user.isVerified = true;
    user.otpCode = undefined;
    user.otpExpires = undefined;
    user.otpVerified = true;
    await user.save();

    res.json({ status: true, message: "Verified", user: { id: user._id, email: user.email, isVerified: user.isVerified } });
  } catch (err) {
    console.error("verifyOtp error", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");
    if (!user) return res.status(404).json({ status: false, message: "User not found" });
    res.json({ status: true, user });
  } catch (err) {
    res.status(500).json({ status: false, message: "Server error" });
  }
};
