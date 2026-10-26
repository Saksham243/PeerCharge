import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Explore from './components/Explore';
import HostAnalytics from './components/HostAnalytics';

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  return (
    <BrowserRouter>
      {user ? (
        <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
          <Navbar user={user} setUser={setUser} />
          <main className="flex-1">
            <Routes>
              <Route path="/dashboard" element={<Dashboard user={user} setUser={setUser} />} />
              <Route path="/explore" element={<Explore user={user} setUser={setUser} />} />
              <Route path="/my-charger" element={<HostAnalytics user={user} setUser={setUser} />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
      ) : (
        <Routes>
          <Route path="/login" element={<Login setUser={setUser} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}