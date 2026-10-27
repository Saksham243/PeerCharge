const Station = require('../models/Station');
const Booking = require('../models/Booking');

const MIN_PRICE_PER_HOUR = 20;
const MAX_PRICE_PER_HOUR = 1000;

// Pending requests have no money locked yet, so cancelling them needs no refund.
async function cancelPendingRequests(stationId) {
  await Booking.updateMany(
    { station: stationId, status: 'Requested' },
    { status: 'Canceled', endTime: new Date() }
  );
}

// Creates the host's charger, edits it, or lists a removed one again.
exports.createStation = async (req, res) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const address = typeof req.body.address === 'string' ? req.body.address.trim() : '';
    const price = Math.round(Number(req.body.pricePerHour) * 100) / 100;

    if (!name) {
      return res.status(400).json({ message: 'Charger name is required' });
    }
    if (!address) {
      return res.status(400).json({ message: 'Address is required' });
    }
    if (!Number.isFinite(price) || price < MIN_PRICE_PER_HOUR || price > MAX_PRICE_PER_HOUR) {
      return res.status(400).json({
        message: `Price per hour must be between ₹${MIN_PRICE_PER_HOUR} and ₹${MAX_PRICE_PER_HOUR}`
      });
    }

    const existing = await Station.findOne({ host: req.user._id });

    if (existing) {
      // Atomic: only change the listing while the station is Available,
      // so it cannot change under a traveler who is already on the way.
      const updated = await Station.findOneAndUpdate(
        { _id: existing._id, host: req.user._id, status: 'Available' },
        { $set: { name, pricePerHour: price, address, isListed: true } },
        { new: true }
      );

      if (!updated) {
        return res.status(400).json({
          message: 'Finish or release the current booking before editing'
        });
      }

      // Requests were estimated at the old rate, so cancel them if the price changed.
      if (existing.pricePerHour !== price) {
        await cancelPendingRequests(existing._id);
      }

      return res.json(updated);
    }

    const station = await Station.create({
      host: req.user._id,
      name,
      pricePerHour: price,
      address,
      status: 'Available',
      isListed: true
    });
    res.status(201).json(station);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Host removes (unlists) their charger. The record is kept for history.
exports.removeStation = async (req, res) => {
  try {
    const station = await Station.findOne({ host: req.user._id });
    if (!station || station.isListed === false) {
      return res.status(404).json({ message: 'You have no listed charger to remove' });
    }

    // Atomic: only unlist while Available (nobody reserved or charging).
    const updated = await Station.findOneAndUpdate(
      { _id: station._id, host: req.user._id, status: 'Available', isListed: { $ne: false } },
      { $set: { isListed: false } },
      { new: true }
    );

    if (!updated) {
      return res.status(400).json({
        message: 'Finish or release the current booking before removing your charger'
      });
    }

    await cancelPendingRequests(station._id);

    res.json({ message: 'Charger removed', station: updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMyStation = async (req, res) => {
  try {
    const station = await Station.findOne({ host: req.user._id });
    res.json(station || null);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getNearbyStations = async (req, res) => {
  try {
    const filter = { status: 'Available', isListed: { $ne: false } };
    if (req.user && req.user._id) {
      filter.host = { $ne: req.user._id };
    }
    const stations = await Station.find(filter).populate('host', 'name email');
    res.json(stations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};