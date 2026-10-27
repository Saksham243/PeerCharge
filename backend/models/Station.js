const mongoose = require('mongoose');

const stationSchema = new mongoose.Schema({
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  pricePerHour: { type: Number, required: true },
  address: { type: String, default: 'Home EV Point' },
  status: { type: String, enum: ['Available', 'Reserved', 'Occupied'], default: 'Available' },
  // false = the host removed the listing. The record is kept so booking
  // history and earnings still work. Old stations have no value, so every
  // query treats a missing value as listed ({ isListed: { $ne: false } }).
  isListed: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Station', stationSchema);