const Station = require('../models/Station');

exports.createStation = async (req, res) => {
  try {
    const { name, pricePerHour, address } = req.body;

    let station = await Station.findOne({ host: req.user._id });
    if (station) {
      if (station.status === 'Reserved' || station.status === 'Occupied') {
        return res.status(400).json({ message: 'Finish or release the current booking before editing' });
      }
      station.name = name || station.name;
      station.pricePerHour = Number(pricePerHour) || station.pricePerHour;
      station.address = address || station.address;
      // Do NOT reset status to Available
      await station.save();
      return res.json(station);
    }

    station = await Station.create({
      host: req.user._id,
      name: name || 'Home Fast Charger',
      pricePerHour: Number(pricePerHour) || 120,
      address: address || 'Residential EV Point',
      status: 'Available'
    });
    res.status(201).json(station);
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
    const filter = { status: 'Available' };
    if (req.user && req.user._id) {
      filter.host = { $ne: req.user._id };
    }
    const stations = await Station.find(filter).populate('host', 'name email');
    res.json(stations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};