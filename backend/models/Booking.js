const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  station: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', required: true },
  traveler: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['Public', 'Self'],
    default: 'Public'
  },
  durationMinutes: { type: Number },
  estimatedCost: { type: Number, default: 0 },
  heldAmount: { type: Number, default: 0 },
  startTime: { type: Date },
  endTime: { type: Date },
  totalCost: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['Requested', 'Accepted', 'Active', 'Completed', 'Canceled'], 
    default: 'Requested' 
  }
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);