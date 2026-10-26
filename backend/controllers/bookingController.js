const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Station = require('../models/Station');
const User = require('../models/User');

// =============================================================================
// STEP 1: PARALLEL REQUESTS
// Traveler can request multiple stations simultaneously.
// Booking: Requested, Station status remains Available.
// =============================================================================
exports.requestBooking = async (req, res) => {
  try {
    const { stationId } = req.body;

    // Check if traveler already has an ongoing Active session
    const activeSession = await Booking.findOne({
      traveler: req.user._id,
      status: 'Active'
    });
    if (activeSession) {
      return res.status(400).json({
        message: 'You already have an active charging session in progress'
      });
    }

    // Check if traveler already requested this exact station
    const existingForStation = await Booking.findOne({
      traveler: req.user._id,
      station: stationId,
      status: { $in: ['Requested', 'Accepted'] }
    });
    if (existingForStation) {
      return res.status(400).json({
        message: 'You already have a pending or accepted request for this station'
      });
    }

    // Station must be Available to receive requests
    const station = await Station.findOne({ _id: stationId, status: 'Available' });
    if (!station) {
      return res.status(400).json({ message: 'Station is currently not available for booking' });
    }

    // Create booking in Requested state. Station remains Available.
    const booking = await Booking.create({
      station: stationId,
      traveler: req.user._id,
      host: station.host,
      status: 'Requested'
    });

    const populated = await Booking.findById(booking._id)
      .populate('station')
      .populate('host', 'name email');

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// =============================================================================
// STEP 2: HOST ACCEPTS
// Host clicks "Accept". Update Booking to Accepted and Station to Reserved.
// =============================================================================
exports.acceptBooking = async (req, res) => {
  try {
    const { bookingId } = req.body;

    const booking = await Booking.findOne({
      _id: bookingId,
      host: req.user._id,
      status: 'Requested'
    });

    if (!booking) {
      return res.status(404).json({ message: 'Requested booking not found or already processed' });
    }

    // Check if the host's station is still Available
    const station = await Station.findOne({ _id: booking.station, status: 'Available' });
    if (!station) {
      return res.status(400).json({
        message: 'Your station is already reserved or occupied by another booking'
      });
    }

    // Update Station to Reserved & Booking to Accepted
    station.status = 'Reserved';
    await station.save();

    booking.status = 'Accepted';
    await booking.save();

    const populated = await Booking.findById(booking._id)
      .populate('traveler', 'name email')
      .populate('station');

    res.json({ message: 'Booking accepted', booking: populated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Host declines/rejects a booking request
exports.declineBooking = async (req, res) => {
  try {
    const { bookingId } = req.body;

    const booking = await Booking.findOne({
      _id: bookingId,
      host: req.user._id,
      status: { $in: ['Requested', 'Accepted'] }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking request not found' });
    }

    const previousStatus = booking.status;
    booking.status = 'Canceled';
    booking.endTime = new Date();
    await booking.save();

    // If it was Accepted, revert station back to Available
    if (previousStatus === 'Accepted') {
      await Station.findByIdAndUpdate(booking.station, { status: 'Available' });
    }

    res.json({ message: 'Booking declined', booking });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// =============================================================================
// STEP 3: START BILLING (TRAVELER ARRIVES) - MONGODB TRANSACTION
// Host clicks "Start Charging" once traveler arrives and connects.
// Transaction:
//   1. Update this Booking to Active and set startTime to Date.now()
//   2. Update this Station to Occupied
//   3. Query all other open Bookings (Requested or Accepted) for this traveler
//   4. Update those other Bookings to Canceled
//   5. Revert the Stations tied to those canceled bookings back to Available
// =============================================================================
exports.startCharging = async (req, res) => {
  try {
    const { bookingId } = req.body;

    const booking = await Booking.findOne({
      _id: bookingId,
      host: req.user._id,
      status: 'Accepted'
    });

    if (!booking) {
      return res.status(404).json({
        message: 'Accepted booking not found. The traveler must be accepted first.'
      });
    }

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        // 1. Update this Booking to Active and set startTime
        booking.status = 'Active';
        booking.startTime = new Date();
        await booking.save({ session });

        // 2. Update this Station to Occupied
        await Station.findByIdAndUpdate(booking.station, { status: 'Occupied' }, { session });

        // 3. Query all other open Bookings (Requested or Accepted) for this specific travelerId
        const otherBookings = await Booking.find({
          _id: { $ne: booking._id },
          traveler: booking.traveler,
          status: { $in: ['Requested', 'Accepted'] }
        }).session(session);

        if (otherBookings.length > 0) {
          const otherBookingIds = otherBookings.map(b => b._id);

          // 4. Update those other Bookings to Canceled
          await Booking.updateMany(
            { _id: { $in: otherBookingIds } },
            { status: 'Canceled' },
            { session }
          );

          // 5. Revert Stations tied to those canceled bookings (that were Reserved) back to Available
          const stationsToRevert = otherBookings
            .filter(b => b.status === 'Accepted')
            .map(b => b.station);

          if (stationsToRevert.length > 0) {
            await Station.updateMany(
              { _id: { $in: stationsToRevert } },
              { status: 'Available' },
              { session }
            );
          }
        }
      });
    } catch (txError) {
      // Fallback for standalone MongoDB instances without replica sets
      if (txError.message && (txError.message.includes('replica set') || txError.message.includes('Transaction numbers'))) {
        booking.status = 'Active';
        booking.startTime = new Date();
        await booking.save();

        await Station.findByIdAndUpdate(booking.station, { status: 'Occupied' });

        const otherBookings = await Booking.find({
          _id: { $ne: booking._id },
          traveler: booking.traveler,
          status: { $in: ['Requested', 'Accepted'] }
        });

        if (otherBookings.length > 0) {
          const otherBookingIds = otherBookings.map(b => b._id);
          await Booking.updateMany(
            { _id: { $in: otherBookingIds } },
            { status: 'Canceled' }
          );

          const stationsToRevert = otherBookings
            .filter(b => b.status === 'Accepted')
            .map(b => b.station);

          if (stationsToRevert.length > 0) {
            await Station.updateMany(
              { _id: { $in: stationsToRevert } },
              { status: 'Available' }
            );
          }
        }
      } else {
        throw txError;
      }
    } finally {
      session.endSession();
    }

    const updatedBooking = await Booking.findById(booking._id)
      .populate('traveler', 'name email')
      .populate('station');

    res.json({ message: 'Charging started successfully', booking: updatedBooking });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// =============================================================================
// STEP 4: STOP BILLING
// Host or Traveler clicks "Stop".
// Deduct funds, set Booking to Completed, and Station to Available.
// =============================================================================
exports.stopBooking = async (req, res) => {
  try {
    const { bookingId } = req.body;

    const booking = await Booking.findOne({
      _id: bookingId,
      status: 'Active',
      $or: [{ traveler: req.user._id }, { host: req.user._id }]
    }).populate('station');

    if (!booking) {
      return res.status(404).json({ message: 'Active booking not found or already completed' });
    }

    const endTime = new Date();
    const startTime = booking.startTime || booking.createdAt || new Date();
    const minutes = Math.max(1, Math.ceil((endTime - new Date(startTime)) / 60000));
    const rate = booking.station?.pricePerHour || 120;
    const cost = Math.max(10, Math.round((minutes * (rate / 60)) * 100) / 100);

    // Deduct from traveler and credit to host
    await User.findByIdAndUpdate(booking.traveler, { $inc: { walletBalance: -cost } });
    await User.findByIdAndUpdate(booking.host, { $inc: { walletBalance: cost } });

    // Revert station back to Available
    await Station.findByIdAndUpdate(booking.station._id, { status: 'Available' });

    booking.endTime = endTime;
    booking.totalCost = cost;
    booking.status = 'Completed';
    await booking.save();

    const updatedTraveler = await User.findById(booking.traveler).select('-password');

    res.json({
      message: 'Charging session completed',
      booking,
      durationMinutes: minutes,
      totalCost: cost,
      walletBalance: updatedTraveler ? updatedTraveler.walletBalance : undefined
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// =============================================================================
// HELPER QUERY ENDPOINTS
// =============================================================================

// Traveler fetches all their open bookings (Requested, Accepted, Active)
exports.getTravelerBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({
      traveler: req.user._id,
      status: { $in: ['Requested', 'Accepted', 'Active'] }
    })
      .populate('station')
      .populate('host', 'name email')
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Host fetches their active queue (Requested, Accepted, Active)
exports.getHostBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({
      host: req.user._id,
      status: { $in: ['Requested', 'Accepted', 'Active'] }
    })
      .populate('traveler', 'name email')
      .populate('station')
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Traveler cancels one of their pending/accepted requests
exports.cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.body;

    const booking = await Booking.findOne({
      _id: bookingId,
      traveler: req.user._id,
      status: { $in: ['Requested', 'Accepted'] }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking request not found' });
    }

    const wasAccepted = booking.status === 'Accepted';
    booking.status = 'Canceled';
    booking.endTime = new Date();
    await booking.save();

    // If it was Accepted, revert Station to Available
    if (wasAccepted) {
      await Station.findByIdAndUpdate(booking.station, { status: 'Available' });
    }

    res.json({ message: 'Booking request canceled' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Backward-compatible getActiveBooking
exports.getActiveBooking = async (req, res) => {
  try {
    const active = await Booking.findOne({
      traveler: req.user._id,
      status: { $in: ['Requested', 'Accepted', 'Active'] }
    })
      .populate('station')
      .populate('host', 'name email');

    res.json(active || null);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Host lifetime completed history
exports.getHostHistory = async (req, res) => {
  try {
    const bookings = await Booking.find({ host: req.user._id, status: 'Completed' })
      .populate('traveler', 'name email')
      .populate('station', 'name pricePerHour address')
      .sort({ endTime: -1 });

    const history = bookings.map(b => {
      const start = new Date(b.startTime || b.createdAt);
      const end = b.endTime ? new Date(b.endTime) : new Date();
      const durationMinutes = Math.max(1, Math.round((end - start) / 60000));
      return {
        _id: b._id,
        travelerName: b.traveler?.name || 'Guest Traveler',
        travelerEmail: b.traveler?.email || '',
        stationName: b.station?.name || 'Home EV Charger',
        startTime: b.startTime || b.createdAt,
        endTime: b.endTime,
        durationMinutes,
        totalCost: Math.round((b.totalCost || 0) * 100) / 100
      };
    });

    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};