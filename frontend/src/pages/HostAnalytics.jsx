import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  BatteryCharging, 
  TrendingUp, 
  Clock, 
  MapPin, 
  Plus, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Zap, 
  RefreshCw,
  Sparkles,
  Hourglass,
  Check,
  PlayCircle,
  Pencil,
  Trash2
} from 'lucide-react';

export default function HostAnalytics({ user, setUser }) {
  // Raw record from the server (may be an unlisted/removed charger, kept for history and re-listing)
  const [stationRecord, setStationRecord] = useState(null);
  // A removed (unlisted) charger counts as "no charger listed"
  const station = stationRecord && stationRecord.isListed !== false ? stationRecord : null;
  const [hostQueue, setHostQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [ownUsage, setOwnUsage] = useState({ totalOwnMinutes: 0, sessions: [] });
  const [selfElapsedSeconds, setSelfElapsedSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionInProgressId, setActionInProgressId] = useState(null);

  // Form state for creating station (No lat/lng)
  const [formData, setFormData] = useState({
    name: 'Home Fast Charger EV',
    pricePerHour: 150,
    address: 'Residential EV Point, Dehradun',
  });

  const authHeader = { headers: { Authorization: `Bearer ${user.token}` } };

  const activeSelfSession = hostQueue.find((b) => b.type === 'Self' && b.status === 'Active');

  useEffect(() => {
    fetchHostData();
    // Live polling for incoming booking requests and active sessions every 3 seconds
    const interval = setInterval(() => {
      fetchQueueSilently();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Timer for active self session
  useEffect(() => {
    let timer = null;
    if (activeSelfSession && activeSelfSession.startTime) {
      const startMs = new Date(activeSelfSession.startTime).getTime();
      const tick = () => {
        setSelfElapsedSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
      };
      tick();
      timer = setInterval(tick, 1000);
    } else {
      setSelfElapsedSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activeSelfSession?.startTime, activeSelfSession?._id]);

  const fetchHostData = async () => {
    setLoading(true);
    try {
      // 1. Fetch user station
      const stationRes = await axios.get('https://peercharge.onrender.com/api/stations/mine', authHeader);
      setStationRecord(stationRes.data);

      // 2. Fetch active host bookings (Requested, Accepted, Active)
      const queueRes = await axios.get('https://peercharge.onrender.com/api/bookings/host-dashboard-bookings', authHeader);
      setHostQueue(queueRes.data || []);

      // 3. Fetch completed booking history for this host
      const historyRes = await axios.get('https://peercharge.onrender.com/api/bookings/my-host-history', authHeader);
      const historyData = Array.isArray(historyRes.data) ? historyRes.data : (historyRes.data.history || []);
      setHistory(historyData);

      // 4. Fetch own usage history
      const ownUsageRes = await axios.get('https://peercharge.onrender.com/api/bookings/my-own-usage', authHeader);
      setOwnUsage(ownUsageRes.data || { totalOwnMinutes: 0, sessions: [] });

      // 5. Sync user balances
      const meRes = await axios.get('https://peercharge.onrender.com/api/auth/me', authHeader);
      if (meRes.data && setUser) {
        const held = meRes.data.heldBalance || 0;
        const wallet = meRes.data.walletBalance || 0;
        const available = typeof meRes.data.availableBalance === 'number'
          ? meRes.data.availableBalance
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
    } catch (err) {
      console.error('Error fetching host analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchQueueSilently = async () => {
    try {
      const [queueRes, stationRes, ownRes] = await Promise.all([
        axios.get('https://peercharge.onrender.com/api/bookings/host-dashboard-bookings', authHeader),
        axios.get('https://peercharge.onrender.com/api/stations/mine', authHeader),
        axios.get('https://peercharge.onrender.com/api/bookings/my-own-usage', authHeader),
      ]);
      setHostQueue(queueRes.data || []);
      setStationRecord(stationRes.data);
      setOwnUsage(ownRes.data || { totalOwnMinutes: 0, sessions: [] });
    } catch (err) {
      // silent background poll
    }
  };

  // Owner starts self session
  const handleStartSelfSession = async () => {
    setActionInProgressId('self-start');
    try {
      await axios.post(
        'https://peercharge.onrender.com/api/bookings/self/start',
        {},
        authHeader
      );
      fetchHostData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to start self charging session');
    } finally {
      setActionInProgressId(null);
    }
  };

  // STEP 2: Host Accepts
  const handleAccept = async (bookingId) => {
    setActionInProgressId(bookingId);
    try {
      await axios.post(
        'https://peercharge.onrender.com/api/bookings/accept',
        { bookingId },
        authHeader
      );
      fetchHostData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to accept booking');
    } finally {
      setActionInProgressId(null);
    }
  };

  // Host Declines
  const handleDecline = async (bookingId) => {
    setActionInProgressId(bookingId);
    try {
      await axios.post(
        'https://peercharge.onrender.com/api/bookings/decline',
        { bookingId },
        authHeader
      );
      fetchHostData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to decline booking');
    } finally {
      setActionInProgressId(null);
    }
  };

  // STEP 3: Start Charging (Traveler Connected) with MongoDB Transaction
  const handleStartCharging = async (bookingId) => {
    setActionInProgressId(bookingId);
    try {
      await axios.post(
        'https://peercharge.onrender.com/api/bookings/start-charging',
        { bookingId },
        authHeader
      );
      fetchHostData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to start charging session');
    } finally {
      setActionInProgressId(null);
    }
  };

  // STEP 4: Stop Charging
  const handleStopCharging = async (bookingId) => {
    const isSelf = activeSelfSession && activeSelfSession._id === bookingId;
    setActionInProgressId(bookingId);
    try {
      const res = await axios.post(
        'https://peercharge.onrender.com/api/bookings/stop',
        { bookingId },
        authHeader
      );
      if (isSelf) {
        alert(`Own charging session completed! Total duration: ${res.data.durationMinutes || 1} min(s).`);
      } else {
        alert(`Charging completed! Earned ₹${res.data.totalCost || 0} for ${res.data.durationMinutes || 1} min(s).`);
      }
      fetchHostData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to stop charging');
    } finally {
      setActionInProgressId(null);
    }
  };

  // Format seconds to HH:MM:SS
  const formatTime = (totalSec) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs > 0 ? `${hrs.toString().padStart(2, '0')}:` : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Opens the listing modal. Pre-fills from the current (or previously removed) charger.
  const openStationModal = () => {
    if (stationRecord) {
      setFormData({
        name: stationRecord.name || '',
        pricePerHour: stationRecord.pricePerHour ?? 150,
        address: stationRecord.address || '',
      });
    }
    setShowCreateModal(true);
  };

  // Remove (unlist) the charger. History and earnings are kept.
  const handleRemoveStation = async () => {
    const confirmed = window.confirm(
      'Remove your charger from the network? Pending traveler requests will be canceled. You can list it again later.'
    );
    if (!confirmed) return;

    setActionInProgressId('remove-station');
    try {
      await axios.delete('https://peercharge.onrender.com/api/stations/mine', authHeader);
      await fetchHostData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove charger');
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleCreateStation = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await axios.post(
        'https://peercharge.onrender.com/api/stations',
        {
          name: formData.name,
          pricePerHour: Number(formData.pricePerHour),
          address: formData.address,
        },
        authHeader
      );
      setStationRecord(res.data);
      setShowCreateModal(false);
      fetchHostData();
    } catch (err) {
      alert(err.response?.data?.message || (station ? 'Failed to update charger' : 'Failed to list charger'));
    } finally {
      setCreating(false);
    }
  };

  const totalLifetimeEarnings = history.reduce((sum, item) => sum + (item.totalCost || 0), 0);
  const totalMinutesHosted = history.reduce((sum, item) => sum + (item.durationMinutes || 0), 0);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 text-center">
        <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-4" />
        <p className="text-slate-500 font-medium">Loading Command Center...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* =========================================================================
          STATE 1: EMPTY STATE (NO CHARGER LISTED)
          ========================================================================= */}
      {!station ? (
        <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-200/80 p-8 sm:p-14 text-center max-w-2xl mx-auto shadow-sm">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/20">
            <BatteryCharging className="w-10 h-10" />
          </div>

          <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold mb-3 border border-emerald-200/60">
            Earn Passive Income
          </span>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            List Your Home EV Charger
          </h2>

          <p className="text-sm sm:text-base text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
            Turn your residential driveway or parking plug into a neighborhood charging hub. EV drivers request, you accept, and billing is triggered when they physically connect.
          </p>

          <div className="mt-8">
            <button
              onClick={openStationModal}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-8 py-3.5 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 inline-flex items-center gap-2 text-sm sm:text-base"
            >
              <Plus className="w-5 h-5 text-emerald-400" />
              <span>List Your Home Charger</span>
            </button>
          </div>

          <div className="mt-10 pt-8 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            <div className="p-3">
              <p className="text-xs font-bold text-slate-800">1. Accept Request</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Reserve your station for an approaching traveler.</p>
            </div>
            <div className="p-3">
              <p className="text-xs font-bold text-slate-800">2. Start Charging</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Activate billing when traveler connects physically.</p>
            </div>
            <div className="p-3">
              <p className="text-xs font-bold text-slate-800">3. Automated Settle</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Station reverts to Available and funds deposit instantly.</p>
            </div>
          </div>
        </div>
      ) : (
        /* =========================================================================
           STATE 2: COMMAND CENTER UI (CHARGER LISTED)
           ========================================================================= */
        <div className="space-y-8">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold mb-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Host Command Center</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {station.name}
              </h1>
              <p className="text-sm text-slate-500">
                {station.address || 'Residential EV Point'} • Rate: <strong>₹{station.pricePerHour}/hr</strong>
              </p>
              {station.status !== 'Available' && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Editing and removing are paused while a booking is reserved or in progress.
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Start My Own Session Button */}
              {station.status === 'Available' && !activeSelfSession && !hostQueue.some((b) => b.status === 'Accepted' || b.status === 'Active') && (
                <button
                  onClick={handleStartSelfSession}
                  disabled={actionInProgressId === 'self-start'}
                  className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold px-4 py-2.5 rounded-2xl text-xs shadow-md shadow-emerald-600/20 flex items-center gap-2 transition disabled:opacity-50"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  <span>{actionInProgressId === 'self-start' ? 'Starting...' : 'Start my own session'}</span>
                </button>
              )}

              {/* Automated Station Status Display */}
              <div className="flex items-center gap-2.5 bg-white px-4 py-2.5 rounded-2xl border border-slate-200/80 shadow-xs">
                <span className={`w-3 h-3 rounded-full ${
                  station.status === 'Available'
                    ? 'bg-emerald-500 animate-pulse'
                    : station.status === 'Reserved'
                    ? 'bg-indigo-600 animate-ping'
                    : 'bg-rose-500'
                }`} />
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Automated Status</p>
                  <p className="text-xs font-extrabold text-slate-900 uppercase tracking-tight">
                    {station.status === 'Available' && 'Available (Ready for Requests)'}
                    {station.status === 'Reserved' && 'Reserved (Traveler En Route)'}
                    {station.status === 'Occupied' && 'Occupied (Charging in Progress)'}
                  </p>
                </div>
              </div>

              {/* Edit / Remove listing (only while the station is Available) */}
              <button
                onClick={openStationModal}
                disabled={station.status !== 'Available'}
                title={station.status === 'Available' ? 'Edit listing' : 'Finish or release the current booking to edit'}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Pencil className="w-4 h-4" />
                <span>Edit listing</span>
              </button>
              <button
                onClick={handleRemoveStation}
                disabled={station.status !== 'Available' || actionInProgressId === 'remove-station'}
                title={station.status === 'Available' ? 'Remove charger from the network' : 'Finish or release the current booking to remove'}
                className="bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-bold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                <span>{actionInProgressId === 'remove-station' ? 'Removing...' : 'Remove charger'}</span>
              </button>
            </div>
          </div>

          {/* Dedicated Own Charging In Progress Card (Strictly No Earnings Wording) */}
          {activeSelfSession && (
            <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white rounded-3xl p-6 sm:p-7 shadow-xl border border-teal-500/40 flex flex-col sm:flex-row items-center justify-between gap-5 animate-fade-in">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0 border border-teal-400/30">
                  <Zap className="w-6 h-6 fill-current animate-pulse text-teal-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-400/20 text-teal-300 border border-teal-400/30">
                      Owner Self Session
                    </span>
                  </div>
                  <h3 className="text-xl font-extrabold text-white mt-1">Own charging in progress</h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Your personal vehicle is charging. Station is marked Occupied. No fees or wallet deductions apply.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                <div className="bg-black/40 px-4 py-2 rounded-2xl border border-white/10 text-right">
                  <p className="text-[10px] uppercase font-semibold text-teal-300 tracking-wider">Elapsed Time</p>
                  <p className="font-mono text-base sm:text-lg font-extrabold text-white">
                    {formatTime(selfElapsedSeconds)}
                  </p>
                </div>

                <button
                  onClick={() => handleStopCharging(activeSelfSession._id)}
                  disabled={actionInProgressId === activeSelfSession._id}
                  className="bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold px-6 py-2.5 rounded-xl text-xs sm:text-sm shadow-lg shadow-rose-950/40 flex items-center gap-2 transition disabled:opacity-50 shrink-0"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  <span>{actionInProgressId === activeSelfSession._id ? 'Stopping...' : 'Stop Charging'}</span>
                </button>
              </div>
            </div>
          )}

          {/* =========================================================================
              ACTIVE & INCOMING BOOKINGS QUEUE
              Handles:
              - Requested: [Accept] [Decline]
              - Accepted: [Start Charging (User Connected)] [Decline]
              - Active: [Stop & Settle Session]
              ========================================================================= */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  hostQueue.filter((b) => b.type !== 'Self').length > 0 ? 'bg-indigo-100 text-indigo-700 animate-bounce' : 'bg-slate-100 text-slate-500'
                }`}>
                  <Hourglass className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                    Live Booking Queue & Active Sessions
                  </h3>
                  <p className="text-xs text-slate-500">
                    Accept incoming requests, verify arrivals, and manage charging sessions
                  </p>
                </div>
              </div>

              <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                hostQueue.filter((b) => b.type !== 'Self').length > 0
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {hostQueue.filter((b) => b.type !== 'Self').length} Active in Queue
              </span>
            </div>

            {hostQueue.filter((b) => b.type !== 'Self').length === 0 ? (
              <div className="py-8 text-center bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
                <p className="text-xs text-slate-500 font-medium">
                  No active traveler requests or charging sessions right now. As travelers request your charger, they will appear here live.
                </p>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                {hostQueue
                  .filter((b) => b.type !== 'Self')
                  .map((item) => {
                  const isRequested = item.status === 'Requested';
                  const isAccepted = item.status === 'Accepted';
                  const isActive = item.status === 'Active';
                  const isBusy = actionInProgressId === item._id;

                  return (
                    <div
                      key={item._id}
                      className={`p-5 rounded-2xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                        isActive
                          ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20 shadow-md'
                          : isAccepted
                          ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500/20 shadow-md'
                          : 'bg-amber-50/60 border-amber-200'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm uppercase shrink-0 shadow-xs">
                          {item.traveler?.name ? item.traveler.name[0] : 'T'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-extrabold text-slate-900 text-base">
                              {item.traveler?.name || 'EV Traveler'}
                            </p>
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                                isActive
                                  ? 'bg-emerald-600 text-white'
                                  : isAccepted
                                  ? 'bg-indigo-600 text-white animate-pulse'
                                  : 'bg-amber-100 text-amber-900 border border-amber-300/60'
                              }`}
                            >
                              {isActive ? '● Charging in Progress' : isAccepted ? '● Reserved & Awaiting Arrival' : '● Requested'}
                            </span>
                          </div>

                          <p className="text-xs text-slate-500 mt-0.5">
                            {item.traveler?.email || 'Registered EV Driver'} • Station: <strong>{station.name}</strong>
                          </p>

                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 mt-1">
                            <span className="bg-slate-100 px-2 py-0.5 rounded-md">
                              {item.durationMinutes || 60} min
                            </span>
                            <span>•</span>
                            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold">
                              ₹{item.heldAmount || item.estimatedCost || 0} held
                            </span>
                          </div>

                          {isAccepted && (
                            <p className="text-xs font-semibold text-indigo-700 mt-1 flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" />
                              Traveler has been notified to proceed to location. Click button once connected.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* State-specific Action Buttons */}
                      <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">
                        {/* 1. If Requested: Accept / Decline */}
                        {isRequested && (
                          <>
                            <button
                              onClick={() => handleAccept(item._id)}
                              disabled={isBusy}
                              className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition disabled:opacity-50"
                            >
                              <Check className="w-4 h-4" />
                              <span>{isBusy ? 'Processing...' : 'Accept'}</span>
                            </button>

                            <button
                              onClick={() => handleDecline(item._id)}
                              disabled={isBusy}
                              className="bg-slate-200 hover:bg-rose-100 hover:text-rose-700 text-slate-700 font-semibold px-4 py-2.5 rounded-xl text-xs transition disabled:opacity-50"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>Decline</span>
                            </button>
                          </>
                        )}

                        {/* 2. If Accepted: Reveal "Start Charging" AND "Decline" */}
                        {isAccepted && (
                          <>
                            <button
                              onClick={() => handleStartCharging(item._id)}
                              disabled={isBusy}
                              className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition disabled:opacity-50"
                            >
                              <PlayCircle className="w-4 h-4 fill-current" />
                              <span>{isBusy ? 'Starting Billing...' : 'Start Charging (User Connected)'}</span>
                            </button>

                            <button
                              onClick={() => handleDecline(item._id)}
                              disabled={isBusy}
                              className="bg-slate-200 hover:bg-rose-100 hover:text-rose-700 text-slate-700 font-semibold px-3.5 py-2.5 rounded-xl text-xs transition disabled:opacity-50"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>Decline</span>
                            </button>
                          </>
                        )}

                        {/* 3. If Active: Stop & Pay */}
                        {isActive && (
                          <button
                            onClick={() => handleStopCharging(item._id)}
                            disabled={isBusy}
                            className="bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-md shadow-rose-600/20 flex items-center gap-2 transition disabled:opacity-50"
                          >
                            <Zap className="w-4 h-4 fill-current" />
                            <span>{isBusy ? 'Finalizing...' : 'Stop & Settle Session'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top Section: Lifetime Earnings Bento */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-gradient-to-br from-slate-900 via-slate-800 to-zinc-950 text-white rounded-3xl p-8 sm:p-10 shadow-xl border border-slate-800 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-widest font-bold text-emerald-400">
                    Host Revenue
                  </span>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    Lifetime Total
                  </span>
                </div>

                <div className="mt-4">
                  <p className="text-xs text-slate-400 font-medium">Total Lifetime Earnings</p>
                  <div className="text-5xl sm:text-6xl font-black text-white tracking-tight mt-1 flex items-baseline gap-1">
                    <span className="text-emerald-400">₹</span>
                    <span>{totalLifetimeEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-800/80 grid grid-cols-3 gap-4 text-xs">
                <div>
                  <p className="text-slate-400 uppercase tracking-wider font-semibold">Completed Sessions</p>
                  <p className="text-xl font-bold text-white mt-0.5">{history.length}</p>
                </div>
                <div>
                  <p className="text-slate-400 uppercase tracking-wider font-semibold">Minutes Powered</p>
                  <p className="text-xl font-bold text-white mt-0.5">{totalMinutesHosted} mins</p>
                </div>
                <div>
                  <p className="text-emerald-400 uppercase tracking-wider font-semibold">Own Usage</p>
                  <p className="text-xl font-bold text-white mt-0.5">{ownUsage.totalOwnMinutes || 0} mins</p>
                </div>
              </div>
            </div>

            {/* Hardware Status Card */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-8 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs uppercase tracking-wider font-bold text-slate-400">Hardware & Config</span>
                <h3 className="text-lg font-bold text-slate-900 mt-2">{station.name}</h3>

                <div className="mt-4 space-y-3 text-xs">
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Hourly Rate</span>
                    <span className="font-bold text-slate-900">₹{station.pricePerHour}/hr</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Current Status</span>
                    <span className={`font-bold uppercase ${
                      station.status === 'Available'
                        ? 'text-emerald-600'
                        : station.status === 'Reserved'
                        ? 'text-indigo-600'
                        : 'text-rose-600'
                    }`}>
                      {station.status}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Connector</span>
                    <span className="font-bold text-slate-900">Type 2 AC (7.2kW)</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500">Location</span>
                    <span className="text-slate-700 font-medium text-right truncate max-w-[150px]">
                      {station.address || 'Residential EV Point'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-emerald-700 font-semibold">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Automated Lifecycle Guarded
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Section: Past Usage Modern Data Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-6 sm:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Past Usage & Charging History</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete ledger of EV drivers who have booked and paid at your station.
                </p>
              </div>
              <button
                onClick={fetchHostData}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition self-start sm:self-auto"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Log</span>
              </button>
            </div>

            {history.length === 0 ? (
              <div className="p-12 text-center">
                <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-base font-bold text-slate-700">No Past Charging Sessions Yet</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Your charger is listed on the network. When travelers request, you accept, and they plug in, transactions will appear right here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200/70 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                      <th className="py-4 px-6">Date & Time</th>
                      <th className="py-4 px-6">Traveler Name</th>
                      <th className="py-4 px-6">Duration (Minutes)</th>
                      <th className="py-4 px-6 text-right">Earnings (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {history.map((item) => {
                      const dateObj = new Date(item.endTime || item.startTime);
                      const formattedDate = dateObj.toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      });
                      const formattedTime = dateObj.toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      return (
                        <tr key={item._id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-4 px-6 text-slate-700 font-medium whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-slate-400" />
                              <div>
                                <span>{formattedDate}</span>
                                <span className="block text-xs text-slate-400">{formattedTime}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-6 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-800 flex items-center justify-center text-xs font-bold uppercase border border-slate-200">
                                {item.travelerName ? item.travelerName[0] : 'T'}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900">{item.travelerName}</p>
                                {item.travelerEmail && (
                                  <p className="text-[11px] text-slate-400">{item.travelerEmail}</p>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-6 text-slate-700 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 font-medium text-xs">
                              <Clock className="w-3.5 h-3.5 text-slate-500" />
                              {item.durationMinutes} mins
                            </span>
                          </td>

                          <td className="py-4 px-6 text-right whitespace-nowrap">
                            <span className="font-black text-emerald-600 text-base">
                              + ₹{(item.totalCost || 0).toFixed(2)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: List New Charger */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                  <BatteryCharging className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg">{station ? 'Edit Your Charger' : 'List Your Charger'}</h3>
                  <p className="text-xs text-slate-500">
                    {station ? 'Update the details travelers see' : 'Make your home plug available on the network'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStation} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Charger Listing Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Anand Vihar Fast Charger"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Price Per Hour (₹)
                </label>
                <input
                  type="number"
                  required
                  min="20"
                  max="1000"
                  value={formData.pricePerHour}
                  onChange={(e) => setFormData({ ...formData, pricePerHour: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Recommended: ₹100 - ₹200/hr
                  {station ? '. Changing the price cancels any pending requests.' : ''}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Neighborhood / Address
                </label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g. Rajpur Road, Dehradun"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
                >
                  {creating
                    ? (station ? 'Saving...' : 'Publishing...')
                    : (station ? 'Save Changes' : 'Publish Charger')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
