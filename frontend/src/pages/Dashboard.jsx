import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Compass, 
  BatteryCharging, 
  Zap, 
  Wallet, 
  ArrowRight, 
  TrendingUp, 
  ShieldCheck, 
  Clock, 
  MapPin,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

export default function Dashboard({ user, setUser }) {
  const navigate = useNavigate();
  const [activeSession, setActiveSession] = useState(null);
  const [myStation, setMyStation] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sync fresh user data & check active sessions
  useEffect(() => {
    const fetchData = async () => {
      try {
        const config = { headers: { Authorization: `Bearer ${user.token}` } };
        
        // 1. Refresh user wallet balance
        const userRes = await axios.get('https://peercharge.onrender.com/api/auth/me', config);
        if (userRes.data) {
          const held = userRes.data.heldBalance || 0;
          const wallet = userRes.data.walletBalance || 0;
          const available = typeof userRes.data.availableBalance === 'number'
            ? userRes.data.availableBalance
            : wallet - held;
          const updated = {
            ...user,
            walletBalance: wallet,
            heldBalance: held,
            availableBalance: available,
          };
          localStorage.setItem('user', JSON.stringify(updated));
          setUser(updated);
        }

        // 2. Check active booking
        const bookingRes = await axios.get('https://peercharge.onrender.com/api/bookings/active', config);
        setActiveSession(bookingRes.data);

        // 3. Check if user already has a station
        const stationRes = await axios.get('https://peercharge.onrender.com/api/stations/mine', config);
        // A removed (unlisted) charger counts as no charger
        setMyStation(stationRes.data && stationRes.data.isListed !== false ? stationRes.data : null);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Welcoming Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/70 backdrop-blur-md p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold mb-2 border border-emerald-200/60">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Decentralized EV Charging</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Welcome back, <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">{user.name}</span> 👋
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">
            Book nearby residential EV chargers or host your own plug to monetize idle energy.
          </p>
        </div>

        {/* Live Wallet Pill Badge */}
        <Link
          to="/wallet"
          className="flex items-center gap-3 self-start md:self-auto bg-gradient-to-br from-slate-900 to-slate-800 text-white px-5 py-3.5 rounded-2xl shadow-md border border-slate-700/60 hover:border-emerald-500/40 transition"
        >
          <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400 font-medium">Virtual Wallet</p>
            <p className="text-xl font-bold tracking-tight text-white">
              ₹{Math.floor(user.walletBalance || 0).toLocaleString()}
            </p>
            <span className="text-[11px] font-semibold text-emerald-400">Add money</span>
          </div>
        </Link>
      </div>

      {/* Active Charging / Pending / Accepted Banner Alert */}
      {activeSession && (
        <div 
          onClick={() => navigate('/explore')}
          className={`cursor-pointer text-white p-4 sm:p-5 rounded-2xl shadow-lg flex items-center justify-between transition-all hover:scale-[1.01] ${
            activeSession.status === 'Accepted'
              ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 shadow-indigo-500/25 ring-2 ring-indigo-400/40'
              : activeSession.status === 'Requested'
              ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 shadow-amber-500/20'
              : 'bg-gradient-to-r from-emerald-500 via-teal-600 to-cyan-600 shadow-emerald-500/20'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-white"></span>
            </span>
            <div>
              <p className="font-bold text-sm sm:text-base flex items-center gap-2">
                {activeSession.status === 'Accepted' ? (
                  <>⚡ Host Accepted — Proceed to Location!</>
                ) : activeSession.status === 'Requested' ? (
                  <>⏳ Booking Request Pending Approval</>
                ) : (
                  <><Zap className="w-4 h-4 fill-current" /> Active Charging Session in Progress!</>
                )}
              </p>
              <p className="text-xs text-white/90">
                {activeSession.status === 'Accepted'
                  ? `Charger reserved at ${activeSession.station?.name || 'EV Charger'}. Drive over to connect!`
                  : activeSession.status === 'Requested'
                  ? `Request sent to ${activeSession.station?.name || 'EV Charger'}. Awaiting host acceptance.`
                  : `Connected to ${activeSession.station?.name || 'EV Charger'}. Click here to inspect the live timer and pay.`}
              </p>
            </div>
          </div>
          <button className="bg-white text-slate-900 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-xs hover:bg-slate-100 transition shrink-0">
            {activeSession.status === 'Accepted' ? 'Navigate & Connect →' : activeSession.status === 'Requested' ? 'View Request →' : 'View Session →'}
          </button>
        </div>
      )}

      {/* Bento Box Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
        {/* Bento Card 1: Find Chargers (Blue / Emerald Gradient) */}
        <div
          onClick={() => navigate('/explore')}
          className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-600 via-teal-600 to-emerald-600 text-white p-8 sm:p-10 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1.5 cursor-pointer flex flex-col justify-between min-h-[340px]"
        >
          {/* Subtle decorative glow */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-500 pointer-events-none" />
          
          <div>
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md text-white mb-6 shadow-inner group-hover:rotate-6 transition-transform">
              <Compass className="w-7 h-7" />
            </div>

            <span className="text-xs font-bold uppercase tracking-widest text-cyan-200">Traveler Mode</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1 text-white">
              Find Chargers
            </h2>
            <p className="mt-3 text-sm sm:text-base text-cyan-100 leading-relaxed font-normal">
              Locate available home EV stations across the network. Request a session with host approval, monitor live per-minute charging, and settle fees via internal wallet.
            </p>

            <div className="mt-5 flex flex-wrap gap-2 text-xs">
              <span className="px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs font-medium">🛡️ Host Approval Flow</span>
              <span className="px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs font-medium">⏱️ Per-Minute Metering</span>
              <span className="px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs font-medium">💰 Internal Wallet</span>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-white/20 flex items-center justify-between">
            <span className="text-sm font-semibold tracking-wide text-white group-hover:underline">
              Search nearby stations
            </span>
            <div className="w-10 h-10 rounded-full bg-white text-emerald-700 flex items-center justify-center shadow-md group-hover:translate-x-1.5 transition-transform">
              <ArrowRight className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Bento Card 2: Manage My Charger (Dark / Slate Themed) */}
        <div
          onClick={() => navigate('/my-charger')}
          className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-zinc-900 to-slate-950 text-white p-8 sm:p-10 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1.5 cursor-pointer border border-slate-800 flex flex-col justify-between min-h-[340px]"
        >
          {/* Subtle decorative glow */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-500 pointer-events-none" />

          <div>
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700 text-emerald-400 mb-6 shadow-inner group-hover:rotate-6 transition-transform">
              <BatteryCharging className="w-7 h-7" />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">Host Mode</span>
              {myStation && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  myStation.status === 'Available' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                }`}>
                  ● {myStation.status}
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1 text-white">
              Manage My Charger
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-400 leading-relaxed font-normal">
              Turn your garage or driveway into an EV charging hub. Track real-time host earnings, manage availability status, and review historical traveler transactions.
            </p>

            <div className="mt-5 flex flex-wrap gap-2 text-xs">
              <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-medium">📊 Earnings Analytics</span>
              <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-medium">🛡️ Host Command Center</span>
              {/* <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-medium">⚡ 100% P2P Share</span> */}
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-800 flex items-center justify-between">
            <span className="text-sm font-semibold tracking-wide text-slate-200 group-hover:underline">
              {myStation ? 'Go to Command Center' : 'List your home charger'}
            </span>
            <div className="w-10 h-10 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-md group-hover:translate-x-1.5 transition-transform">
              <ArrowRight className="w-5 h-5 font-bold" />
            </div>
          </div>
        </div>
      </div>

      {/* Mini Feature Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Zero Role Lock-in</h3>
            <p className="text-xs text-slate-500">Any user can book chargers and host their own simultaneously.</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Live Metering</h3>
            <p className="text-xs text-slate-500">Accurate minute-level charging state machine calculation.</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Direct Earnings</h3>
            <p className="text-xs text-slate-500">Funds transferred immediately to the host upon session completion.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
