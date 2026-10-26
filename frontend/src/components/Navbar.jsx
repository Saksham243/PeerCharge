import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Zap, Compass, BatteryCharging, LogOut, PlusCircle, Wallet } from 'lucide-react';
import axios from 'axios';

export default function Navbar({ user, setUser }) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login');
  };

  const handleTopUp = async () => {
    try {
      const res = await axios.post(
        'http://localhost:5000/api/auth/topup',
        { amount: 500 },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      const updated = { ...user, walletBalance: res.data.walletBalance };
      localStorage.setItem('user', JSON.stringify(updated));
      setUser(updated);
    } catch (err) {
      console.error('Failed to top up wallet', err);
    }
  };

  const navLinks = [
    { name: 'Dashboard', path: '/dashboard', icon: Zap },
    { name: 'Explore', path: '/explore', icon: Compass },
    { name: 'My Charger', path: '/my-charger', icon: BatteryCharging },
  ];

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-slate-200/80 shadow-xs transition-all">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/dashboard" className="flex items-center gap-2 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-200">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-slate-900 group-hover:text-emerald-600 transition">
              PeerCharge
            </span>
            <span className="hidden sm:inline-block ml-2 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
              EV Network
            </span>
          </div>
        </Link>

        {/* Desktop Nav Items */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span className="hidden sm:inline">{link.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Pill & Wallet */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Wallet Balance Badge */}
          {(() => {
            const held = user.heldBalance || 0;
            const avail = typeof user.availableBalance === 'number' 
              ? user.availableBalance 
              : ((user.walletBalance || 0) - held);
            return (
              <div className="flex items-center bg-slate-100/90 border border-slate-200 rounded-full pl-3 pr-1.5 py-1 text-sm shadow-inner group">
                <div className="flex items-center gap-1.5 text-slate-700 font-semibold mr-2">
                  <Wallet className="w-4 h-4 text-emerald-600" />
                  <span>₹{Math.floor(avail).toLocaleString()}</span>
                  {held > 0 && (
                    <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded-full" title={`₹${held} currently held in reservation`}>
                      ₹{Math.floor(held)} held
                    </span>
                  )}
                </div>
                <button
                  onClick={handleTopUp}
                  title="Add ₹500 test funds"
                  className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white px-2 py-0.5 rounded-full text-xs font-medium transition shadow-xs"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Top Up</span>
                </button>
              </div>
            );
          })()}

          {/* User Avatar & Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-800 to-slate-950 text-white flex items-center justify-center text-xs font-bold uppercase shadow-sm">
              {user.name ? user.name[0] : 'U'}
            </div>
            <button
              onClick={handleLogout}
              title="Log Out"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
