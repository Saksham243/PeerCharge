const express = require('express');
const { register, login, getMe, topUpWallet } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.post('/topup', protect, topUpWallet);

module.exports = router;