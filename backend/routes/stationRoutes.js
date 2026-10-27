const express = require('express');
const { createStation, removeStation, getNearbyStations, getMyStation } = require('../controllers/stationController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/', protect, createStation);
router.get('/', protect, getNearbyStations);
router.get('/nearby', protect, getNearbyStations);
router.get('/mine', protect, getMyStation);
router.delete('/mine', protect, removeStation);

module.exports = router;