const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'User already exists' });
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const user = await User.create({ name, email, password: hashedPassword });
    const held = user.heldBalance || 0;
    const availableBalance = user.walletBalance - held;
    res.status(201).json({ 
      _id: user._id, 
      name: user.name, 
      email: user.email, 
      walletBalance: user.walletBalance,
      heldBalance: held,
      availableBalance,
      token: generateToken(user._id) 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (user && (await bcrypt.compare(password, user.password))) {
      const held = user.heldBalance || 0;
      const availableBalance = user.walletBalance - held;
      res.json({ 
        _id: user._id, 
        name: user.name, 
        email: user.email, 
        walletBalance: user.walletBalance,
        heldBalance: held,
        availableBalance,
        token: generateToken(user._id) 
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    const held = user.heldBalance || 0;
    const availableBalance = user.walletBalance - held;
    const userObj = user.toObject();
    userObj.availableBalance = availableBalance;
    userObj.heldBalance = held;
    res.json(userObj);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.topUpWallet = async (req, res) => {
  try {
    const amount = Number(req.body.amount) || 500;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { walletBalance: amount } },
      { new: true }
    ).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};