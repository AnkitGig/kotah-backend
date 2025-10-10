const mongoose = require('mongoose');

const childSchema = new mongoose.Schema({
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  age: { type: Number },
  avatarUrl: { type: String },
  code: { type: String, required: true, unique: true }, // 6-digit unique code
  coins: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Child', childSchema);
