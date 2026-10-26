const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  walletBalance: { type: Number, default: 1000 },
}, { timestamps: true });
module.exports = mongoose.model('User', userSchema);