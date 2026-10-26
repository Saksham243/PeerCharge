const express = require('express');
const { 
  requestBooking,
  acceptBooking,
  declineBooking,
  startCharging,
  stopBooking,
  cancelBooking,
  startSelfSession,
  getMyOwnUsage,
  getTravelerBookings,
  getHostBookings,
  getActiveBooking,
  getHostHistory
} = require('../controllers/bookingController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

// Step 1: Parallel Requests
router.post('/request', protect, requestBooking);
router.post('/cancel', protect, cancelBooking);

// Step 2: Host Accepts / Declines
router.post('/accept', protect, acceptBooking);
router.post('/decline', protect, declineBooking);

// Step 3: Start Billing (Traveler Arrived) with MongoDB Transaction
router.post('/start-charging', protect, startCharging);

// Step 4: Stop Billing
router.post('/stop', protect, stopBooking);

// FEATURE 1: Owner Self Session
router.post('/self/start', protect, startSelfSession);
router.get('/my-own-usage', protect, getMyOwnUsage);

// Query Endpoints
router.get('/my-traveler-bookings', protect, getTravelerBookings);
router.get('/host-dashboard-bookings', protect, getHostBookings);
router.get('/active', protect, getActiveBooking);
router.get('/my-host-history', protect, getHostHistory);

module.exports = router;