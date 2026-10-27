const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./config/db');
const User = require('./models/User');

const authRoutes = require('./routes/authRoutes');
const stationRoutes = require('./routes/stationRoutes');
const bookingRoutes = require('./routes/bookingRoutes');

const app = express();

connectDB().then(async () => {
  try {
    await User.updateMany({ heldBalance: { $exists: false } }, { $set: { heldBalance: 0 } });
  } catch (err) {
    // quiet backfill
  }
});

app.use(cors({
    origin : ['http://localhost:5173',"https://peer-charge-hazel.vercel.app"],
    credentials:true,
    methods:['GET','POST','PUT','DELETE','PATCH'],
    allowedHeaders:['Content-type' , 'Authorization']
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/bookings', bookingRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));



