const mongoose = require('mongoose');

const stationSchema = new mongoose.Schema({
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  pricePerHour: { type: Number, required: true },
  address: { type: String, default: 'Home EV Point' },
  status: { type: String, enum: ['Available', 'Reserved', 'Occupied'], default: 'Available' }
}, { timestamps: true });

module.exports = mongoose.model('Station', stationSchema);