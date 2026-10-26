const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  station: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', required: true },
  traveler: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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