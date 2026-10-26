import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Zap, 
  MapPin, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  RefreshCw, 
  Hourglass, 
  XCircle, 
  Sparkles,
  ArrowRight,
  Check
} from 'lucide-react';

export default function Explore({ user, setUser }) {
  const [stations, setStations] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [loadingStations, setLoadingStations] = useState(true);
  const [requestingStationId, setRequestingStationId] = useState(null);
  const [stoppingBookingId, setStoppingBookingId] = useState(null);
  const [cancellingBookingId, setCancellingBookingId] = useState(null);
  const [completedSummary, setCompletedSummary] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const authHeader = { headers: { Authorization: `Bearer ${user.token}` } };

  // 1. Initial Load: Fetch stations and traveler bookings
  useEffect(() => {
    fetchStations();
    fetchTravelerBookings();

    // Poll traveler bookings every 3 seconds to catch Host Accept or Start Charging
    const pollInterval = setInterval(() => {
      fetchTravelerBookingsSilently();
    }, 3000);

    return () => clearInterval(pollInterval);
  }, []);

  // 2. Timer for Active Session (if any)
  const activeSession = myBookings.find((b) => b.status === 'Active');

  useEffect(() => {
    let timer = null;
    if (activeSession && activeSession.startTime) {
      const startMs = new Date(activeSession.startTime).getTime();
      const tick = () => {
        const diff = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
        setElapsedSeconds(diff);
      };
      tick();
      timer = setInterval(tick, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activeSession?.startTime, activeSession?._id]);

  const fetchStations = async () => {
    setLoadingStations(true);
    const minDelay = new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      const [res] = await Promise.all([
        axios.get('http://localhost:5000/api/stations/nearby', authHeader),
        minDelay
      ]);
      setStations(res.data);
    } catch (err) {
      console.error('Error fetching stations:', err);
    } finally {
      setLoadingStations(false);
    }
  };

  const fetchTravelerBookings = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/bookings/my-traveler-bookings', authHeader);
      setMyBookings(res.data || []);
    } catch (err) {
      console.error('Error fetching traveler bookings:', err);
    }
  };

  const fetchTravelerBookingsSilently = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/bookings/my-traveler-bookings', authHeader);
      setMyBookings(res.data || []);
    } catch (err) {
      // silent background polling
    }
  };

  // STEP 1: Request a charger (can request multiple parallel stations)
  const handleRequest = async (stationId) => {
    if (activeSession) {
      alert('You are already in an active charging session!');
      return;
    }
    setRequestingStationId(stationId);
    try {
      await axios.post(
        'http://localhost:5000/api/bookings/request',
        { stationId },
        authHeader
      );
      fetchTravelerBookings();
      fetchStations();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send request');
    } finally {
      setRequestingStationId(null);
    }
  };

  // Cancel request
  const handleCancelRequest = async (bookingId) => {
    setCancellingBookingId(bookingId);
    try {
      await axios.post(
        'http://localhost:5000/api/bookings/cancel',
        { bookingId },
        authHeader
      );
      fetchTravelerBookings();
      fetchStations();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel booking');
    } finally {
      setCancellingBookingId(null);
    }
  };

  // STEP 4: Stop charging
  const handleStopCharging = async (bookingId) => {
    setStoppingBookingId(bookingId);
    try {
      const res = await axios.post(
        'http://localhost:5000/api/bookings/stop',
        { bookingId },
        authHeader
      );

      const { booking, durationMinutes, totalCost, walletBalance } = res.data;

      if (typeof walletBalance === 'number') {
        const updated = { ...user, walletBalance };
        localStorage.setItem('user', JSON.stringify(updated));
        setUser(updated);
      } else {
        const meRes = await axios.get('http://localhost:5000/api/auth/me', authHeader);
        const updated = { ...user, walletBalance: meRes.data.walletBalance };
        localStorage.setItem('user', JSON.stringify(updated));
        setUser(updated);
      }

      setCompletedSummary({
        stationName: booking?.station?.name || 'EV Charger',
        durationMinutes: durationMinutes || Math.max(1, Math.ceil(elapsedSeconds / 60)),
        totalCost: totalCost || booking?.totalCost || 10,
      });

      fetchTravelerBookings();
      fetchStations();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to stop charging session');
    } finally {
      setStoppingBookingId(null);
    }
  };

  // Format seconds to HH:MM:SS
  const formatTime = (totalSec) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs > 0 ? `${hrs.toString().padStart(2, '0')}:` : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const activeRatePerHour = activeSession?.station?.pricePerHour || 120;
  const elapsedMinutes = Math.max(1, Math.ceil(elapsedSeconds / 60));
  const estimatedLiveCost = Math.max(10, Math.round((elapsedMinutes * (activeRatePerHour / 60)) * 100) / 100);

  // Quick Seed Helper for evaluation
  const seedDemoCharger = async () => {
    try {
      await axios.post(
        'http://localhost:5000/api/stations',
        {
          name: `RapidCharge Hub #${Math.floor(Math.random() * 899 + 100)}`,
          pricePerHour: 140,
          address: 'Main Market, Dehradun',
        },
        authHeader
      );
      fetchStations();
    } catch (err) {
      alert('Could not seed demo charger');
    }
  };

  return (
    <div className="min-h-screen pb-24">
      {/* =========================================================================
          STICKY ACTIVE BILLING BANNER (IF ACTIVE CHARGING)
          ========================================================================= */}
      {activeSession && (
        <div className="sticky top-16 z-30 bg-gradient-to-r from-emerald-600 via-teal-700 to-cyan-800 text-white shadow-xl shadow-emerald-950/20 border-b border-emerald-400/40 backdrop-blur-md transition-all">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 w-full md:w-auto">
              <span className="relative flex h-4 w-4 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-80"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-400 border-2 border-white"></span>
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200 border border-emerald-300/30">
                    Active Charging
                  </span>
                  <span className="font-bold text-sm sm:text-base truncate max-w-[220px] text-white">
                    {activeSession.station?.name || 'EV Charger'}
                  </span>
                </div>
                <p className="text-xs text-emerald-100 flex items-center gap-2 mt-0.5">
                  <span>Rate: ₹{activeRatePerHour}/hr</span>
                  <span>•</span>
                  <span>Min charge: ₹10</span>
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto">
              <div className="flex items-center gap-4 bg-black/25 px-4 py-2 rounded-2xl border border-white/10">
                <div className="text-right">
                  <p className="text-[10px] uppercase font-semibold text-emerald-200 tracking-wider">Live Time</p>
                  <p className="font-mono text-base sm:text-lg font-extrabold text-white">
                    {formatTime(elapsedSeconds)}
                  </p>
                </div>
                <div className="h-7 w-px bg-white/20" />
                <div>
                  <p className="text-[10px] uppercase font-semibold text-emerald-200 tracking-wider">Est. Cost</p>
                  <p className="text-base sm:text-lg font-extrabold text-emerald-300">
                    ₹{estimatedLiveCost}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleStopCharging(activeSession._id)}
                disabled={stoppingBookingId === activeSession._id}
                className="bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-rose-950/30 flex items-center gap-2 text-sm transition shrink-0 disabled:opacity-50"
              >
                {stoppingBookingId === activeSession._id ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Finalizing...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-current" />
                    <span>Stop & Pay</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Completed Session Alert Notification */}
        {completedSummary && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-lg">Charging Session Completed!</h4>
                <p className="text-sm text-slate-600">
                  Paid <span className="font-bold text-emerald-700">₹{completedSummary.totalCost}</span> for {completedSummary.durationMinutes} min(s) of charging at {completedSummary.stationName}. Your wallet has been updated.
                </p>
              </div>
            </div>
            <button
              onClick={() => setCompletedSummary(null)}
              className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-slate-800 transition"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* =========================================================================
            DYNAMIC TRAVELER REQUESTS & SESSIONS SECTION
            Displays: Pending Requests, Host Accepted (Proceed to Location), Active Session
            ========================================================================= */}
        {myBookings.length > 0 && (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                  <Zap className="w-4 h-4 fill-current text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                    My Active Bookings & Parallel Requests
                  </h3>
                  <p className="text-xs text-slate-500">
                    Live status tracking across requested and accepted charging points
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                {myBookings.length} {myBookings.length === 1 ? 'Booking' : 'Bookings'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {myBookings.map((b) => {
                const isAccepted = b.status === 'Accepted';
                const isRequested = b.status === 'Requested';
                const isActive = b.status === 'Active';

                return (
                  <div
                    key={b._id}
                    className={`p-5 rounded-2xl border transition-all ${
                      isActive
                        ? 'bg-emerald-50/70 border-emerald-300 shadow-sm'
                        : isAccepted
                        ? 'bg-gradient-to-br from-indigo-50/90 to-purple-50/70 border-indigo-300 shadow-md ring-2 ring-indigo-500/20'
                        : 'bg-amber-50/50 border-amber-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        {/* Dynamic Status Badge */}
                        <div className="mb-2">
                          {isActive && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-bold uppercase tracking-wider shadow-xs">
                              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                              Active Charging
                            </span>
                          )}
                          {isAccepted && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-600 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-600/25 animate-pulse">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Host Accepted — Proceed to Location!
                            </span>
                          )}
                          {isRequested && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300/60 text-[11px] font-bold uppercase tracking-wider">
                              <Hourglass className="w-3 h-3 animate-spin" />
                              Pending Host Approval
                            </span>
                          )}
                        </div>

                        <h4 className="font-extrabold text-slate-900 text-base">
                          {b.station?.name || 'EV Charger'}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {b.station?.address || 'Residential EV Point'} • Hosted by <strong>{b.host?.name || 'Resident'}</strong>
                        </p>
                        <p className="text-xs font-bold text-slate-700 mt-1">
                          Tariff: ₹{b.station?.pricePerHour || 120}/hr
                        </p>
                      </div>

                      {/* Action Button */}
                      <div>
                        {isActive ? (
                          <button
                            onClick={() => handleStopCharging(b._id)}
                            disabled={stoppingBookingId === b._id}
                            className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-xs transition"
                          >
                            Stop
                          </button>
                        ) : (
                          <button
                            onClick={() => handleCancelRequest(b._id)}
                            disabled={cancellingBookingId === b._id}
                            className="text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg border border-slate-200 transition"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Explanatory callout for Host Accepted */}
                    {isAccepted && (
                      <div className="mt-3.5 pt-3 border-t border-indigo-200/80 text-xs text-indigo-900 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>The host has reserved this charger. Arrive at the station; the host will click <b>Start Charging</b> once connected.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/70 backdrop-blur-md p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xs">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold mb-2 border border-emerald-200/60">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Parallel Request Network</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Explore Available Chargers
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Request multiple home chargers simultaneously. Once a host accepts, drive over to connect!
            </p>
          </div>

          <button
            onClick={fetchStations}
            disabled={loadingStations}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition self-start sm:self-auto disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingStations ? 'animate-spin' : ''}`} />
            <span>Refresh Chargers</span>
          </button>
        </div>

        {/* Counter & Seeder */}
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span><b>{stations.length}</b> verified chargers currently online and available</span>
          <button 
            onClick={seedDemoCharger}
            className="text-emerald-600 hover:text-emerald-700 font-semibold hover:underline flex items-center gap-1"
          >
            <span>+ Seed Demo Charger</span>
          </button>
        </div>

        {/* 1-Second Loading State */}
        {loadingStations ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-16 text-center max-w-md mx-auto shadow-sm space-y-4 animate-fade-in">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Locating nearby chargers...
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Checking real-time host availability across the PeerCharge network
              </p>
            </div>
          </div>
        ) : stations.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-lg mx-auto shadow-xs space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <Zap className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">No Available Chargers</h3>
              <p className="text-sm text-slate-500 mt-1">
                All network chargers are currently reserved or occupied.
              </p>
            </div>
            <button
              onClick={seedDemoCharger}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-emerald-600/20 transition"
            >
              Seed an Available Demo Charger
            </button>
          </div>
        ) : (
          /* Charger Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stations.map((s) => {
              const userBookingForStation = myBookings.find((b) => b.station?._id === s._id);
              const isAlreadyRequested = Boolean(userBookingForStation);
              const isRequesting = requestingStationId === s._id;
              const hasActiveSession = Boolean(activeSession);

              return (
                <div
                  key={s._id}
                  className="group bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    {/* Top Status & Plug Type */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 flex items-center gap-1">
                        <Zap className="w-3 h-3 text-emerald-600 fill-current" /> Type-2 AC (7.2kW)
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                        Available
                      </span>
                    </div>

                    {/* Station Name */}
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-emerald-700 transition">
                      {s.name}
                    </h3>

                    {/* Host Name Info */}
                    <div className="flex items-center gap-2 mt-2 text-slate-500 text-xs">
                      <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700 uppercase">
                        {s.host?.name ? s.host.name[0] : 'H'}
                      </div>
                      <span>Hosted by <strong className="text-slate-800 font-medium">{s.host?.name || 'Verified Resident'}</strong></span>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    </div>

                    {/* Location Address */}
                    {s.address && (
                      <div className="mt-3 flex items-center gap-1.5 text-slate-400 text-xs">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        <span className="truncate">{s.address}</span>
                      </div>
                    )}
                  </div>

                  {/* Price & Request Button */}
                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs text-slate-400 font-medium block">Tariff</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-slate-900">
                          ₹{s.pricePerHour}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">/ hr</span>
                      </div>
                    </div>

                    {isAlreadyRequested ? (
                      <span className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>{userBookingForStation.status}</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => handleRequest(s._id)}
                        disabled={isRequesting || hasActiveSession}
                        className={`px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition flex items-center gap-2 ${
                          hasActiveSession
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                            : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-emerald-600/25'
                        }`}
                      >
                        {isRequesting ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Requesting...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4 fill-current" />
                            <span>Request</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
