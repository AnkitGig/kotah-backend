const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const sendOtp = require("../utils/sendOtp");

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const normalizedEmail = String(email || "")
      .toLowerCase()
      .trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }
    if (!user.isVerified) {
      return res.status(403).json({
        message:
          "Account not verified. Please verify your email or phone before logging in.",
      });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
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
        .json({ message: "Email and password are required" });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "User already exists" });

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
      return res.status(400).json({ message: "Email already registered" });
    res.status(500).json({ message: "Server error" });
  }
};

exports.completeProfile = async (req, res) => {
  try {
    const userId = req.user && req.user.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

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
      update.avatarUrl = path
        .relative(process.cwd(), req.file.path)
        .replace(/\\/g, "/");
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: update },
      { new: true }
    ).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("completeProfile error", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { email: rawEmail, code } = req.body || {};
    const email = String(rawEmail || "")
      .toLowerCase()
      .trim();
    if (!email || !code)
      return res.status(400).json({ message: "Email and code are required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.otpCode || !user.otpExpires)
      return res.status(400).json({ message: "No OTP pending" });

    if (new Date() > new Date(user.otpExpires))
      return res.status(400).json({ message: "OTP expired" });

    if (String(code) !== String(user.otpCode))
      return res.status(400).json({ message: "Invalid OTP code" });

    user.isVerified = true;
    user.otpCode = undefined;
    user.otpExpires = undefined;
    user.otpVerified = true;
    await user.save();

    res.json({
      message: "Verified",
      user: { id: user._id, email: user.email, isVerified: user.isVerified },
    });
  } catch (err) {
    console.error("verifyOtp error", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
