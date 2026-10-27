import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft,
  Wallet,
  CreditCard,
  Landmark,
  Smartphone,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';

const QUICK_AMOUNTS = [100, 250, 500, 1000, 2000];
const METHODS = [
  {
    id: 'UPI',
    label: 'UPI',
    helper: 'Pay instantly with any UPI app. Demo only — nothing is charged.',
    icon: Smartphone,
  },
  {
    id: 'Card',
    label: 'Card',
    helper: 'Debit or credit card. Card details are not collected in this demo.',
    icon: CreditCard,
  },
  {
    id: 'NetBanking',
    label: 'Net Banking',
    helper: 'Pay from a linked bank account. No bank login is requested here.',
    icon: Landmark,
  },
];

export default function AddMoney({ user, setUser }) {
  const navigate = useNavigate();
  const [amountInput, setAmountInput] = useState('500');
  const [method, setMethod] = useState('UPI');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  const held = user?.heldBalance || 0;
  const wallet = user?.walletBalance || 0;
  const available = typeof user?.availableBalance === 'number'
    ? user.availableBalance
    : wallet - held;

  const amount = Math.round(Number(amountInput) * 100) / 100;
  const amountValid = Number.isFinite(amount) && amount >= 10 && amount <= 10000;
  const amountError = !amountInput
    ? 'Enter an amount between Rs 10 and Rs 10,000'
    : !amountValid
      ? 'Enter an amount between Rs 10 and Rs 10,000'
      : '';

  const selectedMethod = METHODS.find((m) => m.id === method) || METHODS[0];

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await axios.get('https://peercharge.onrender.com/api/auth/me', {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (res.data && setUser) {
          const nextHeld = res.data.heldBalance || 0;
          const nextWallet = res.data.walletBalance || 0;
          const nextAvailable = typeof res.data.availableBalance === 'number'
            ? res.data.availableBalance
            : nextWallet - nextHeld;
          const updated = {
            ...user,
            walletBalance: nextWallet,
            heldBalance: nextHeld,
            availableBalance: nextAvailable,
          };
          localStorage.setItem('user', JSON.stringify(updated));
          setUser(updated);
        }
      } catch (err) {
        console.error('Failed to refresh wallet', err);
      }
    };
    fetchMe();
  }, []);

  const handlePay = async () => {
    if (processing || !amountValid) return;
    setError('');
    setProcessing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const res = await axios.post(
        'https://peercharge.onrender.com/api/auth/topup',
        { amount, method },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      const nextHeld = res.data.heldBalance || 0;
      const nextWallet = res.data.walletBalance || 0;
      const nextAvailable = typeof res.data.availableBalance === 'number'
        ? res.data.availableBalance
        : nextWallet - nextHeld;
      const updated = {
        ...user,
        walletBalance: nextWallet,
        heldBalance: nextHeld,
        availableBalance: nextAvailable,
      };
      localStorage.setItem('user', JSON.stringify(updated));
      setUser(updated);
      setSuccess({
        amount,
        method: selectedMethod.label,
        walletBalance: nextWallet,
        availableBalance: nextAvailable,
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Payment could not be completed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const resetForm = () => {
    setSuccess(null);
    setError('');
    setAmountInput('500');
    setMethod('UPI');
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Link>
      </div>

      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Add Money to Wallet
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Simulated top-up for the PeerCharge prototype. No real payment is taken.
        </p>
      </div>

      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-zinc-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
            <Wallet className="w-5 h-5" />
          </div>
          <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Current balance</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-400 font-medium">Wallet balance</p>
            <p className="text-3xl font-black tracking-tight">₹{(user?.walletBalance || 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Available</p>
            <p className="text-3xl font-black tracking-tight text-emerald-400">
              ₹{available.toLocaleString()}
            </p>
          </div>
        </div>
        {held > 0 && (
          <p className="mt-4 text-xs font-semibold text-amber-200 bg-amber-500/10 border border-amber-400/20 rounded-xl px-3 py-2 inline-block">
            ₹{held} currently held for a reserved booking
          </p>
        )}
      </div>

      {success ? (
        <div className="bg-white rounded-3xl border border-emerald-200 p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Money added</h2>
              <p className="text-sm text-slate-500">Demo payment completed successfully.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <p className="text-xs text-slate-500 font-medium">Amount added</p>
              <p className="font-extrabold text-slate-900 text-lg">₹{success.amount}</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <p className="text-xs text-slate-500 font-medium">Method</p>
              <p className="font-extrabold text-slate-900 text-lg">{success.method}</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <p className="text-xs text-slate-500 font-medium">New wallet balance</p>
              <p className="font-extrabold text-slate-900 text-lg">₹{success.walletBalance}</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <p className="text-xs text-slate-500 font-medium">Available balance</p>
              <p className="font-extrabold text-emerald-700 text-lg">₹{success.availableBalance}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-3 rounded-2xl text-sm transition"
            >
              Add more
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold px-5 py-3 rounded-2xl text-sm border border-emerald-200 transition"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      ) : (
        <div className={`bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-6 ${processing ? 'opacity-80' : ''}`}>
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold rounded-2xl px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <h2 className="text-sm font-extrabold text-slate-900 mb-3">Amount</h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {QUICK_AMOUNTS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  disabled={processing}
                  onClick={() => setAmountInput(String(chip))}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
                    Number(amountInput) === chip
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  } disabled:opacity-50`}
                >
                  ₹{chip}
                </button>
              ))}
            </div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Custom amount (₹)
            </label>
            <input
              type="number"
              min="10"
              max="10000"
              step="0.01"
              disabled={processing}
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50"
            />
            {amountError && (
              <p className="text-xs text-rose-600 font-semibold mt-1.5">{amountError}</p>
            )}
          </div>

          <div>
            <h2 className="text-sm font-extrabold text-slate-900 mb-3">Payment method</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {METHODS.map((item) => {
                const Icon = item.icon;
                const selected = method === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={processing}
                    onClick={() => setMethod(item.id)}
                    className={`text-left p-4 rounded-2xl border transition ${
                      selected
                        ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    } disabled:opacity-50`}
                  >
                    <Icon className={`w-5 h-5 mb-2 ${selected ? 'text-emerald-600' : 'text-slate-500'}`} />
                    <p className="text-sm font-bold text-slate-900">{item.label}</p>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 mt-3">{selectedMethod.helper}</p>
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-3">
            <p className="text-sm font-semibold text-slate-700">
              You pay <span className="font-extrabold text-slate-900">Rs {amountValid ? amount : '—'}</span>
            </p>
            <button
              type="button"
              onClick={handlePay}
              disabled={processing || !amountValid}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold px-5 py-3.5 rounded-2xl text-sm shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing payment...</span>
                </>
              ) : (
                <span>Pay Rs {amountValid ? amount : '—'}</span>
              )}
            </button>
            <p className="text-xs text-slate-500 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Demo payment. No real money is charged.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
