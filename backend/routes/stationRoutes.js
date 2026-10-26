const express = require('express');
const { createStation, getNearbyStations, getMyStation } = require('../controllers/stationController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/', protect, createStation);
router.get('/', protect, getNearbyStations);
router.get('/nearby', protect, getNearbyStations);
router.get('/mine', protect, getMyStation);

module.exports = router;