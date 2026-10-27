import { useState } from 'react';
import axios from 'axios';
export default function TravelerView({ token }) {
  const [stations, setStations] = useState([]);
  const [activeBooking, setActiveBooking] = useState(null);
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };
  const findStations = async () => {
    const lat = 30.3165; 
    const lng = 78.0322;
    const res = await axios.get(`https://peercharge.onrender.com/api/stations/nearby?lat=${lat}&lng=${lng}`, authHeader);
    setStations(res.data);
  };
  const startCharging = async (stationId) => {
    const res = await axios.post(`https://peercharge.onrender.com/api/bookings/start`, { stationId }, authHeader);
    setActiveBooking(res.data);
  };
  const stopCharging = async () => {
    await axios.post(`https://peercharge.onrender.com/api/bookings/stop`, { bookingId: activeBooking._id }, authHeader);
    setActiveBooking(null);
    alert("Charging complete! Re-login to update wallet balance visually.");
  };
  if (activeBooking) {
    return (
      <div className="bg-blue-100 p-6 rounded-lg text-center shadow-inner border border-blue-300">
        <h2 className="text-xl font-bold text-blue-800 animate-pulse">⚡ CHARGING ACTIVE ⚡</h2>
        <button onClick={stopCharging} className="mt-4 bg-red-500 text-white px-6 py-2 rounded-full shadow font-bold">Stop & Pay</button>
      </div>
    );
  }
  return (
    <div>
      <h2 className="text-lg font-bold mb-2">Need a charge?</h2>
      <button onClick={findStations} className="w-full bg-blue-500 text-white p-3 rounded-lg shadow font-semibold">📍 Find Nearby Chargers</button>
      <div className="mt-4 space-y-3">
        {stations.map(s => (
          <div key={s._id} className="p-4 bg-white rounded-lg shadow border flex justify-between items-center">
            <div>
              <p className="font-bold">{s.name}</p>
              <p className="text-sm text-gray-500">₹{s.pricePerHour}/hr</p>
            </div>
            <button onClick={() => startCharging(s._id)} className="bg-green-500 text-white px-4 py-2 rounded shadow">Connect</button>
          </div>
        ))}
      </div>
    </div>
  );
}