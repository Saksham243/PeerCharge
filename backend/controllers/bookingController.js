const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Station = require('../models/Station');
const User = require('../models/User');

function toUserId(ref) {
  if (!ref) return ref;
  return ref._id ? ref._id : ref;
}

async function releaseHeldBalance(userId, amount, session) {
  const requested = Number(amount);
  if (!userId || !Number.isFinite(requested) || requested <= 0) return;
  const query = User.findById(userId);
  if (session) query.session(session);
  const user = await query;
  const currentHeld = Number(user?.heldBalance);
  const held = Number.isFinite(currentHeld) ? currentHeld : 0;
  const decrement = Math.min(requested, held);
  if (decrement <= 0) return;
  const opts = session ? { session } : {};
  await User.findByIdAndUpdate(userId, { $inc: { heldBalance: -decrement } }, opts);
}

// =============================================================================
// STEP 1: PARALLEL REQUESTS (UPFRONT PAYMENT ESTIMATION)
// Traveler can request multiple stations simultaneously.
// Takes { stationId, durationMinutes }. durationMinutes in [30, 60, 90, 120].
// Booking: Requested, Station status remains Available.
// Soft check: availableBalance >= estimatedCost. (Funds NOT locked yet).
// =============================================================================
exports.requestBooking = async (req, res) => {
  try {
    const { stationId, durationMinutes } = req.body;

    const validDurations = [30, 60, 90, 120];
    const duration = Number(durationMinutes);
    if (!validDurations.includes(duration)) {
      return res.status(400).json({ message: 'durationMinutes must be one of 30, 60, 90, 120' });
    }

    // Check if traveler already has an ongoing Active public session
    const activeSession = await Booking.findOne({
      traveler: req.user._id,
      status: 'Active',
      type: 'Public'
    });
    if (activeSession) {
      return res.status(400).json({
        message: 'You already have an active charging session in progress'
      });
    }

    // Station must be Available to receive requests
    const station = await Station.findOne({ _id: stationId, status: 'Available' });
    if (!station) {
      return res.status(400).json({ message: 'Station is currently not available for booking' });
    }
    if (station.isListed === false) {
      return res.status(400).json({ message: 'This charger is no longer listed' });
    }

    // FEATURE 1: Caller cannot request their own station
    if (station.host.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot request your own charging station' });
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

    // FEATURE 2: Calculate estimated cost & soft check traveler available balance
    const estimatedCost = Math.max(10, Math.round((duration * (station.pricePerHour / 60)) * 100) / 100);
    const travelerUser = await User.findById(req.user._id);
    const availableBalance = (travelerUser.walletBalance || 0) - (travelerUser.heldBalance || 0);

    if (availableBalance < estimatedCost) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    // Create booking in Requested state. Funds are NOT locked at this step. Station remains Available.
    const booking = await Booking.create({
      station: stationId,
      traveler: req.user._id,
      host: station.host,
      type: 'Public',
      status: 'Requested',
      durationMinutes: duration,
      estimatedCost: estimatedCost,
      heldAmount: 0
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
// STEP 2: HOST ACCEPTS (PLACE HOLD & RESERVE STATION)
// Places hold on traveler's walletBalance via atomic User.findOneAndUpdate.
// If successful, reserves the station. If station reserve fails, reverts hold.
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

    const travelerId = toUserId(booking.traveler);

    let amount = Number(booking.estimatedCost);
    if (!Number.isFinite(amount) || amount <= 0) {
      const stationForCost = await Station.findById(booking.station);
      const duration = Number(booking.durationMinutes);
      const durationMinutes = Number.isFinite(duration) && duration > 0 ? duration : 60;
      amount = Math.max(10, Math.round((durationMinutes * ((stationForCost?.pricePerHour || 0) / 60)) * 100) / 100);
      booking.estimatedCost = amount;
      await booking.save();
    }

    // 1. Place the hold atomically on traveler's wallet
    const travelerUser = await User.findOneAndUpdate(
      {
        _id: travelerId,
        $expr: {
          $gte: [
            {
              $subtract: [
                { $ifNull: ['$walletBalance', 0] },
                { $ifNull: ['$heldBalance', 0] }
              ]
            },
            amount
          ]
        }
      },
      { $inc: { heldBalance: amount } },
      { new: true }
    );

    if (!travelerUser) {
      return res.status(400).json({ message: 'Traveler no longer has enough balance' });
    }

    // 2. Reserve the station
    const station = await Station.findOneAndUpdate(
      { _id: booking.station, status: 'Available', isListed: { $ne: false } },
      { status: 'Reserved' },
      { new: true }
    );

    if (!station) {
      // Undo hold if station is no longer Available
      await releaseHeldBalance(travelerId, amount);
      return res.status(400).json({
        message: 'Your station is already reserved or occupied by another booking'
      });
    }

    // 3. Mark booking as Accepted and record heldAmount
    booking.status = 'Accepted';
    booking.heldAmount = amount;
    await booking.save();

    const populated = await Booking.findById(booking._id)
      .populate('traveler', 'name email')
      .populate('station');

    res.json({ message: 'Booking accepted', booking: populated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// =============================================================================
// HOST DECLINES (RELEASES HOLD IF ACCEPTED)
// =============================================================================
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

    const wasAccepted = booking.status === 'Accepted';
    const heldToRelease = booking.heldAmount || 0;

    booking.status = 'Canceled';
    booking.endTime = new Date();
    booking.heldAmount = 0;
    await booking.save();

    // If it was Accepted, release hold and revert station to Available
    if (wasAccepted) {
      if (heldToRelease > 0) {
        await releaseHeldBalance(toUserId(booking.traveler), heldToRelease);
      }
      await Station.findByIdAndUpdate(booking.station, { status: 'Available' });
    }

    res.json({ message: 'Booking declined', booking });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// =============================================================================
// STEP 3: START BILLING (TRAVELER ARRIVES) - MONGODB TRANSACTION
// Host clicks "Start Charging".
// 1. Update this Booking to Active, startTime = now
// 2. Update this Station to Occupied
// 3. Query all other open Bookings (Requested/Accepted) for this traveler
// 4. Update those other Bookings to Canceled
// 5. Release holds on the Accepted other bookings & revert their stations to Available
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

        // 3. Query all other open Bookings (Requested or Accepted) for this traveler
        const otherBookings = await Booking.find({
          _id: { $ne: booking._id },
          traveler: booking.traveler,
          status: { $in: ['Requested', 'Accepted'] }
        }).session(session);

        if (otherBookings.length > 0) {
          for (const other of otherBookings) {
            // Release hold and revert station if it was Accepted
            if (other.status === 'Accepted') {
              if (other.heldAmount > 0) {
                await releaseHeldBalance(toUserId(other.traveler), other.heldAmount, session);
              }
              await Station.findByIdAndUpdate(
                other.station,
                { status: 'Available' },
                { session }
              );
            }
          }

          // Mark other bookings as Canceled
          const otherBookingIds = otherBookings.map(b => b._id);
          await Booking.updateMany(
            { _id: { $in: otherBookingIds } },
            { status: 'Canceled', heldAmount: 0 },
            { session }
          );
        }
      });
    } catch (txError) {
      // Standalone MongoDB fallback
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
          for (const other of otherBookings) {
            if (other.status === 'Accepted') {
              if (other.heldAmount > 0) {
                await releaseHeldBalance(toUserId(other.traveler), other.heldAmount);
              }
              await Station.findByIdAndUpdate(other.station, { status: 'Available' });
            }
          }

          const otherBookingIds = otherBookings.map(b => b._id);
          await Booking.updateMany(
            { _id: { $in: otherBookingIds } },
            { status: 'Canceled', heldAmount: 0 }
          );
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
// STEP 4: STOP BILLING (ATOMIC CLAIM, SETTLE HOLD & WALLET)
// Handles both Self sessions and Public sessions.
// For Public:
// - Claims booking atomically via Booking.findOneAndUpdate
// - Charges min(actualCost, walletBalance)
// - Releases full hold (heldBalance -= heldAmount)
// - Credits host with charged amount
// - Sets Station to Available
// =============================================================================
exports.stopBooking = async (req, res) => {
  try {
    const { bookingId } = req.body;

    // 1. Check if this is an active Self session first
    const selfBooking = await Booking.findOneAndUpdate(
      {
        _id: bookingId,
        status: 'Active',
        type: 'Self',
        host: req.user._id
      },
      { status: 'Completed', endTime: new Date(), totalCost: 0 },
      { new: true }
    ).populate('station');

    if (selfBooking) {
      // Revert station to Available, no wallet movements
      await Station.findByIdAndUpdate(selfBooking.station._id, { status: 'Available' });
      const durationMinutes = Math.max(1, Math.ceil((new Date(selfBooking.endTime) - new Date(selfBooking.startTime)) / 60000));
      return res.json({
        message: 'Self charging session completed',
        booking: selfBooking,
        durationMinutes,
        totalCost: 0
      });
    }

    // 2. Claim Public booking atomically to prevent double-stop
    const booking = await Booking.findOneAndUpdate(
      {
        _id: bookingId,
        status: 'Active',
        type: 'Public',
        $or: [{ traveler: req.user._id }, { host: req.user._id }]
      },
      { status: 'Completed' },
      { new: false } // Need existing heldAmount and details before completion
    ).populate('station');

    if (!booking) {
      return res.status(404).json({ message: 'Active booking not found or already completed' });
    }

    const endTime = new Date();
    const startTime = booking.startTime || booking.createdAt || new Date();
    const actualMinutes = Math.max(1, Math.ceil((endTime - new Date(startTime)) / 60000));
    const rate = booking.station?.pricePerHour || 120;
    const actualCost = Math.max(10, Math.round((actualMinutes * (rate / 60)) * 100) / 100);

    // Charge min(actualCost, walletBalance) so wallet never goes negative
    const traveler = await User.findById(booking.traveler);
    const walletBalance = traveler ? (traveler.walletBalance || 0) : actualCost;
    const chargedAmount = Math.max(0, Math.min(actualCost, walletBalance));
    const heldAmount = booking.heldAmount || 0;
    const refundedAmount = Math.max(0, Math.round((heldAmount - chargedAmount) * 100) / 100);

    // Deduct chargedAmount and release hold without driving heldBalance below 0
    await User.findByIdAndUpdate(booking.traveler, {
      $inc: { walletBalance: -chargedAmount }
    });
    await releaseHeldBalance(toUserId(booking.traveler), heldAmount);

    // Credit host with amount actually charged
    await User.findByIdAndUpdate(booking.host, {
      $inc: { walletBalance: chargedAmount }
    });

    // Revert station back to Available
    await Station.findByIdAndUpdate(booking.station._id, { status: 'Available' });

    // Save final details on booking
    booking.endTime = endTime;
    booking.totalCost = chargedAmount;
    booking.heldAmount = 0;
    booking.status = 'Completed';
    await booking.save();

    const updatedTraveler = await User.findById(booking.traveler).select('-password');
    const availableBalance = (updatedTraveler.walletBalance || 0) - (updatedTraveler.heldBalance || 0);

    res.json({
      message: 'Charging session completed',
      booking,
      totalCost: chargedAmount,
      refundedAmount,
      durationMinutes: actualMinutes,
      walletBalance: updatedTraveler.walletBalance,
      availableBalance
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// =============================================================================
// FEATURE 1: OWNER SELF SESSION (START)
// Owner occupies their own charger without money movement.
// =============================================================================
exports.startSelfSession = async (req, res) => {
  try {
    const stationDoc = await Station.findOne({ host: req.user._id });
    if (!stationDoc) {
      return res.status(400).json({ message: 'You do not own a charging station' });
    }
    if (stationDoc.isListed === false) {
      return res.status(400).json({ message: 'List your charger first' });
    }

    // Try to atomically set Available station to Occupied
    const station = await Station.findOneAndUpdate(
      { _id: stationDoc._id, host: req.user._id, status: 'Available', isListed: { $ne: false } },
      { status: 'Occupied' },
      { new: true }
    );

    if (!station) {
      if (stationDoc.status === 'Reserved') {
        return res.status(400).json({
          message: 'Station is reserved. Please decline the accepted booking before starting a self session.'
        });
      }
      if (stationDoc.status === 'Occupied') {
        return res.status(400).json({
          message: 'Station is currently occupied by an active charging session.'
        });
      }
      return res.status(400).json({ message: 'Station is not available' });
    }

    const booking = await Booking.create({
      station: station._id,
      type: 'Self',
      traveler: req.user._id,
      host: req.user._id,
      status: 'Active',
      startTime: new Date(),
      totalCost: 0
    });

    const populated = await Booking.findById(booking._id).populate('station');
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// FEATURE 1: Host own usage statistics
exports.getMyOwnUsage = async (req, res) => {
  try {
    const selfBookings = await Booking.find({
      host: req.user._id,
      type: 'Self',
      status: 'Completed'
    }).sort({ endTime: -1 });

    const usage = selfBookings.map(b => {
      const start = new Date(b.startTime || b.createdAt);
      const end = b.endTime ? new Date(b.endTime) : new Date();
      const durationMinutes = Math.max(1, Math.round((end - start) / 60000));
      return {
        _id: b._id,
        startTime: b.startTime,
        endTime: b.endTime,
        durationMinutes,
        createdAt: b.createdAt
      };
    });

    const totalOwnMinutes = usage.reduce((sum, item) => sum + item.durationMinutes, 0);

    res.json({
      totalOwnMinutes,
      sessionsCount: usage.length,
      usage
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// =============================================================================
// HELPER QUERY ENDPOINTS
// =============================================================================

// Traveler fetches their open Public bookings (ignore Self)
exports.getTravelerBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({
      traveler: req.user._id,
      type: 'Public',
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

// Host fetches active queue (Requested, Accepted, and Active - includes Self)
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

// Traveler cancels their request (releases hold if Accepted)
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
    const heldToRelease = booking.heldAmount || 0;

    booking.status = 'Canceled';
    booking.endTime = new Date();
    booking.heldAmount = 0;
    await booking.save();

    // If it was Accepted, release hold and revert Station to Available
    if (wasAccepted) {
      if (heldToRelease > 0) {
        await releaseHeldBalance(toUserId(booking.traveler), heldToRelease);
      }
      await Station.findByIdAndUpdate(booking.station, { status: 'Available' });
    }

    res.json({ message: 'Booking request canceled' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Backward-compatible getActiveBooking (ignores Self sessions)
exports.getActiveBooking = async (req, res) => {
  try {
    const active = await Booking.findOne({
      traveler: req.user._id,
      type: 'Public',
      status: { $in: ['Requested', 'Accepted', 'Active'] }
    })
      .populate('station')
      .populate('host', 'name email');

    res.json(active || null);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Host lifetime completed history (strictly Public sessions only, excludes Self)
exports.getHostHistory = async (req, res) => {
  try {
    const bookings = await Booking.find({
      host: req.user._id,
      status: 'Completed',
      type: 'Public'
    })
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