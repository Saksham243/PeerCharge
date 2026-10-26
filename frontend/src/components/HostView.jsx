import axios from 'axios';
export default function HostView({ token }) {
  const addStation = async () => {
    try {
      await axios.post(`http://localhost:5000/api/stations`, {
        name: `Home Charger EV`, pricePerHour: 150,
        lat: 30.3165 + (Math.random() * 0.01), lng: 78.0322 + (Math.random() * 0.01)
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert("Charger listed publicly!");
    } catch (err) {
      alert("Failed to list charger");
    }
  };
  return (
    <div>
      <h2 className="text-lg font-bold mb-2">Got a spare charger?</h2>
      <button onClick={addStation} className="w-full bg-gray-800 text-white p-3 rounded-lg shadow font-semibold">🏠 List My Charger</button>
    </div>
  );
}