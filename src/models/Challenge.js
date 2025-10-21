const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String },
    categories: { type: [String], default: [] },
    daysRemaining: { type: Number, default: 0 },
    image: { type: String },
  },
  { timestamps: true }
);

challengeSchema.index({ title: 1 }, { unique: true, partialFilterExpression: { title: { $exists: true } } });

module.exports = mongoose.model('Challenge', challengeSchema);
