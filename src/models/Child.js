const mongoose = require("mongoose");

const childSchema = new mongoose.Schema(
  {
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true },
    age: { type: Number },
    samartPhone: {
      type: String,
      enum: ["yes", "no"],
      default: "yes",
    },
    gender: { type: String, enum: ["male", "female", "other"] },
    avatarUrl: { type: String },
  code: { type: String, required: true, unique: true }, // 6-character unique code (digits/letters)
  type: { type: String, enum: ["child", "family"], default: "child" },
    coins: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Child", childSchema);
