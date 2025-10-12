const mongoose = require("mongoose");

const phoneSchema = new mongoose.Schema(
  {
    countryCode: { type: String, default: "+1" },
    number: { type: String },
  },
  { _id: false }
);

const locationSchema = new mongoose.Schema(
  {
    address: { type: String },
    lat: { type: Number },
    lng: { type: Number },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String },
    lastName: { type: String },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    phone: { type: String },
    countryCode: { type: String },
    address: { type: String },
    dob: { type: Date },
    gender: { type: String, enum: ["male", "female", "other"] },
    roleInFamily: {
      type: String,
      enum: ["Head", "Mom", "Son", "Daughter", "Other"],
    },
    locations: { type: [locationSchema], default: [] },
    avatarUrl: { type: String },
  fcmToken: { type: String },
    isVerified: { type: Boolean, default: false },
    otpCode: { type: String },
    number: { type: String },
    otpExpires: { type: Date },
    otpVerified: { type: Boolean, default: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
