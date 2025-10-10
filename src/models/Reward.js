const mongoose = require("mongoose");

const rewardSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    cost: { type: Number, required: true },
    type: {
      type: String,
      enum: ["badge", "voucher", "custom"],
      default: "custom",
    },
    metadata: { type: mongoose.Schema.Types.Mixed },
    targetChildren: [{ type: mongoose.Schema.Types.ObjectId, ref: "Child" }],
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Reward", rewardSchema);
