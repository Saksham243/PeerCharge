const Station = require('../models/Station');

exports.createStation = async (req, res) => {
  try {
    const { name, pricePerHour, address } = req.body;

    let station = await Station.findOne({ host: req.user._id });
    if (station) {
      station.name = name || station.name;
      station.pricePerHour = Number(pricePerHour) || station.pricePerHour;
      station.address = address || station.address;
      station.status = 'Available';
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
    const stations = await Station.find({ status: 'Available' }).populate('host', 'name email');
    res.json(stations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};