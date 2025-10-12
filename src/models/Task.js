const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    child: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Child",
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String },
    frequency: {
      type: String,
      enum: ["daily", "weekly", "once"],
      default: "daily",
    },
    timeOfDay: {
      type: [String],
      enum: ["morning", "midday", "afternoon", "evening", "night"],
    },
    requiresParentApproval: { type: Boolean, default: false },
    allowNextDayCompletion: { type: Boolean, default: false },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "easy",
    },
    imageUrl: { type: String },
    coinValue: { type: Number, default: 0 },
    dueTime: { type: Date },
    completed: { type: Boolean, default: false },
    verified: { type: Boolean, default: false }, // parent verification
    completedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Task", taskSchema);
