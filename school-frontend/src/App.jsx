import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';

// --- GLOBAL AXIOS CONFIG ---
// FIX (bug): Centralise the base URL so it's not hardcoded on every single request.
// Change this one constant to point at your production server.
const API_BASE = 'https://little-angel.onrender.com';

// FIX (bug): Centralise the auth header so it's never forgotten on a request.
const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem('school_token')}`
});

// FIX (bug): Centralise token expiry handling. If ANY request returns 401,
// the user is logged out automatically instead of seeing a confusing error.
axios.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.clear();
      // Reload to reset React state cleanly
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

// --- TOAST NOTIFICATION SYSTEM ---
// IMPROVEMENT: Replaces alert() calls throughout the app with proper toasts.
const ToastContext = React.createContext(null);
const useToast = () => React.useContext(ToastContext);

const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);
  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: '12px 18px', borderRadius: '10px', fontWeight: 600, fontSize: '14px',
            background: t.type === 'success' ? '#f0fdf4' : t.type === 'error' ? '#fef2f2' : '#eff6ff',
            color: t.type === 'success' ? '#15803d' : t.type === 'error' ? '#dc2626' : '#1d4ed8',
            border: `1px solid ${t.type === 'success' ? '#bbf7d0' : t.type === 'error' ? '#fecaca' : '#bfdbfe'}`,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            animation: 'slideIn 0.2s ease',
            maxWidth: '320px'
          }}>{t.message}</div>
        ))}
      </div>
      <style>{`@keyframes slideIn { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </ToastContext.Provider>
  );
};

// --- REUSABLE LOADING SPINNER ---
const Spinner = ({ text = 'Loading...' }) => (
  <div className="p-8 flex items-center gap-3 text-blue-500 font-bold">
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
    </svg>
    {text}
  </div>
);

// --- 0A. PUBLIC PARENT REGISTRATION PAGE ---
const ParentRegistrationPage = ({ onNavigateLogin }) => {
  const [formData, setFormData] = useState({
    full_name: '', grade_level: 'MINI KG', contact_number: '',
    mother_name: '', father_name: '', username: '', password: ''
  });
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  // IMPROVEMENT: Show/hide password toggle
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (field) => (e) => setFormData(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    // IMPROVEMENT: Basic client-side validation before hitting the API
if (formData.password.length < 6) {
  setStatus({ type: 'error', message: 'Password must be at least 6 characters.' });
  return;
}

// ADD this right after it:
if (formData.password.length > 72) {
  setStatus({ type: 'error', message: 'Password must be 72 characters or fewer.' });
  return;
}
    setLoading(true);
    setStatus(null);
    try {
      await axios.post(`${API_BASE}/api/register`, formData);
      setStatus({ type: 'success', message: 'Registration successful! Please wait for Admin approval before logging in.' });
      setFormData({ full_name: '', grade_level: 'MINI KG', contact_number: '', mother_name: '', father_name: '', username: '', password: '' });
    } catch (err) {
      setStatus({ type: 'error', message: err.response?.data?.detail || 'Registration failed. Username might be taken.' });
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-400 focus:bg-white outline-none transition text-gray-800";

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white max-w-2xl w-full rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-slate-950 p-6 text-center border-b border-slate-800">
          <h1 className="text-2xl font-black tracking-widest text-blue-400">
            LITTLE ANGELS<br/><span className="text-sm text-slate-300 font-medium">ADMISSION PORTAL</span>
          </h1>
        </div>
        <div className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800">New Student Registration</h2>
            <button onClick={onNavigateLogin} className="text-sm font-bold text-blue-600 hover:underline">← Back to Login</button>
          </div>
          {status && (
            <div className={`p-4 rounded-lg mb-6 font-bold text-center ${status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {status.message}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-bold text-gray-700 mb-1">Student Full Name</label>
                <input required type="text" value={formData.full_name} onChange={handleChange('full_name')} className={inputClass} placeholder="e.g. Aarav Sharma" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Applying For Class</label>
                <select value={formData.grade_level} onChange={handleChange('grade_level')} className={inputClass}>
                  <option value="MINI KG">MINI KG</option>
                  <option value="JR KG">JR KG</option>
                  <option value="SR KG">SR KG</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Mother's Name</label>
                <input type="text" value={formData.mother_name} onChange={handleChange('mother_name')} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Father's Name</label>
                <input type="text" value={formData.father_name} onChange={handleChange('father_name')} className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Primary Contact Number</label>
              <input required type="tel" value={formData.contact_number} onChange={handleChange('contact_number')} className={inputClass} placeholder="+91 9876543210" />
            </div>
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <h3 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">Create Portal Login</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Choose Username</label>
                  <input required type="text" value={formData.username} onChange={handleChange('username')} className={inputClass} />
                </div>
                {/* IMPROVEMENT: Password visibility toggle */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Create Password</label>
                  <div className="relative">
                    <input required type={showPassword ? 'text' : 'password'} value={formData.password} onChange={handleChange('password')} maxLength={72} className={inputClass + ' pr-12'} />
                    <button type="button" onClick={() => setShowPassword(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold">
                      {showPassword ? 'HIDE' : 'SHOW'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 mt-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2">
              {loading && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>}
              {loading ? 'Submitting Application...' : 'Submit Registration'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// --- 0. SECURE LOGIN PAGE ---
const LoginPage = ({ onLogin, onNavigateRegister }) => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('username', credentials.username);
      params.append('password', credentials.password);
      const response = await axios.post(`${API_BASE}/api/login`, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      localStorage.setItem('school_token', response.data.access_token);
      localStorage.setItem('username', response.data.username);
      localStorage.setItem('role', response.data.role);
      
      // Save the new verification and ID data!
      localStorage.setItem('is_verified', response.data.is_verified);
      if (response.data.student_id) localStorage.setItem('student_id', response.data.student_id);
      
      onLogin();
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-400 focus:bg-white outline-none transition text-gray-800";

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-slate-950 p-8 text-center border-b border-slate-800">
          <h1 className="text-2xl font-black tracking-widest text-blue-400">
            LITTLE ANGELS<br/><span className="text-sm text-slate-300 font-medium">EDU PORTAL</span>
          </h1>
        </div>
        <div className="p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">Secure Staff Login</h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm font-bold rounded-lg text-center">{error}</div>
            )}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Username</label>
              <input type="text" required value={credentials.username}
                onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                className={inputClass} autoComplete="username" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Password</label>
              {/* IMPROVEMENT: Password visibility toggle on login too */}
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} required value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                  className={inputClass + ' pr-12'} autoComplete="current-password" />
                <button type="button" onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold">
                  {showPassword ? 'HIDE' : 'SHOW'}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2">
              {loading && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>}
              {loading ? 'Authenticating...' : 'Access Dashboard'}
            </button>
          </form>
          <div className="mt-6 text-center pt-4 border-t border-slate-100">
            <p className="text-sm text-gray-600 font-medium">
              New parent seeking admission?{' '}
              <button onClick={onNavigateRegister} className="text-blue-600 hover:text-blue-800 font-bold hover:underline transition">
                Register Here
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- 1. SIDEBAR LINK COMPONENT ---
const SidebarLink = ({ to, label, icon }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link to={to}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-all ${
        isActive ? 'bg-blue-600 text-white font-semibold shadow-md' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
      }`}>
      <span className="text-lg">{icon}</span>
      {label}
    </Link>
  );
};

// --- 2. DASHBOARD PAGE ---
const DashboardHome = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE}/api/analytics`, { headers: authHeader() });
      setAnalytics(response.data);
    } catch (err) {
      // FIX (bug): 401s are handled globally; only show non-auth errors here
      if (err.response?.status !== 401) {
        setError('Failed to connect to the server. Is your Python backend running?');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboardData(); }, []);

  if (loading) return <Spinner text="Loading Live Data..." />;
  if (error) return <div className="p-8 text-red-500 font-bold">{error}</div>;

  const cards = [
    { label: 'Total Students', value: analytics.summary_cards.total_students, color: 'blue', icon: '👨‍🎓' },
    { label: 'Total Collected', value: `₹${analytics.summary_cards.total_collected.toLocaleString()}`, color: 'green', icon: '💰' },
    { label: 'Pending Dues', value: `₹${analytics.summary_cards.total_pending.toLocaleString()}`, color: 'red', icon: '⚠️' },
    { label: 'Defaulters', value: analytics.summary_cards.fees_pending_count, color: 'purple', icon: '📋' },
  ];
  const colorMap = { blue: 'border-l-blue-500', green: 'border-l-green-500', red: 'border-l-red-500', purple: 'border-l-purple-500' };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard Analytics</h2>
        <button onClick={fetchDashboardData}
          className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-sm font-bold flex items-center gap-2">
          <span>↻</span> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {cards.map(card => (
          <div key={card.label} className={`bg-white p-6 rounded-xl border border-gray-100 shadow-sm border-l-4 ${colorMap[card.color]}`}>
            <p className="text-sm text-gray-500 font-medium flex items-center gap-2">
              <span>{card.icon}</span>{card.label}
            </p>
            <p className="text-3xl font-bold text-gray-800 mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      <h3 className="text-lg font-bold text-gray-800 mb-4">Recent Payments</h3>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-6 py-4 font-medium">Receipt ID</th>
              <th className="px-6 py-4 font-medium">Student Name</th>
              <th className="px-6 py-4 font-medium">Amount</th>
              <th className="px-6 py-4 font-medium">Mode</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {analytics.recent_activity_ledger.length === 0 && (
              <tr><td colSpan="4" className="px-6 py-8 text-center text-slate-400">No payments recorded yet.</td></tr>
            )}
            {analytics.recent_activity_ledger.map((payment) => (
              <tr key={payment.id} className="hover:bg-slate-50 transition">
                <td className="px-6 py-4 font-medium text-blue-600">{payment.receipt_id}</td>
                {/* FIX (bug): payment.students can be null if the join returns nothing — guard it */}
                <td className="px-6 py-4 font-medium text-gray-800">{payment.students?.full_name ?? '—'}</td>
                <td className="px-6 py-4 font-bold text-green-600">₹{Number(payment.amount_paid).toLocaleString()}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-slate-100 rounded-md text-xs font-bold text-slate-600">{payment.payment_mode}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- 3. STUDENT PROFILE MODAL ---
const StudentProfileModal = ({ studentId, onClose }) => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  // FIX (bug): Added error state — previously errors were silently swallowed with console.error only
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const response = await axios.get(`${API_BASE}/api/students/${studentId}/report`, { headers: authHeader() });
        setReport(response.data);
      } catch (err) {
        if (err.response?.status !== 401) {
          setError('Failed to load student profile. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [studentId]);

  // IMPROVEMENT: Close modal on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    // IMPROVEMENT: Click outside to close
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-800">Student 360° Profile</h2>
            <p className="text-sm text-gray-500 font-medium">ID: #{studentId}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-white rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 shadow-sm flex items-center justify-center transition font-bold text-xl">×</button>
        </div>

        <div className="p-8 overflow-y-auto">
          {loading && <div className="text-center py-10 text-blue-500 font-bold flex items-center justify-center gap-2"><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Loading Profile Data...</div>}
          {error && <div className="text-center py-10 text-red-500 font-bold">{error}</div>}
          {!loading && !error && report && (
            <div className="space-y-8">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-black text-slate-800">{report.profile.full_name}</h1>
                  <p className="text-lg text-slate-500 font-medium mt-1">{report.profile.grade_level}</p>
                </div>
                <span className={`px-4 py-2 rounded-full text-sm font-bold ${
                  report.financial_summary.status === 'Cleared' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  Fee Status: {report.financial_summary.status}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                  <p className="text-sm text-slate-500 font-bold mb-1">Total Course Fee</p>
                  <p className="text-2xl font-black text-slate-700">₹{report.financial_summary.total_fee.toLocaleString()}</p>
                </div>
                <div className="bg-green-50 p-5 rounded-xl border border-green-100">
                  <p className="text-sm text-green-600 font-bold mb-1">Total Paid</p>
                  <p className="text-2xl font-black text-green-700">₹{report.financial_summary.paid_amount.toLocaleString()}</p>
                </div>
                <div className="bg-red-50 p-5 rounded-xl border border-red-100">
                  <p className="text-sm text-red-600 font-bold mb-1">Remaining Dues</p>
                  <p className="text-2xl font-black text-red-700">₹{report.financial_summary.remaining_dues.toLocaleString()}</p>
                </div>
              </div>

              {/* IMPROVEMENT: Parent/Guardian info displayed if present */}
              {(report.profile.mother_name || report.profile.father_name || report.profile.contact_number) && (
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                  <p className="text-sm font-extrabold text-slate-400 uppercase tracking-wider mb-3">Parent / Guardian</p>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    {report.profile.mother_name && <div><span className="text-slate-400 font-bold">Mother</span><p className="font-semibold text-slate-700 mt-0.5">{report.profile.mother_name}</p></div>}
                    {report.profile.father_name && <div><span className="text-slate-400 font-bold">Father</span><p className="font-semibold text-slate-700 mt-0.5">{report.profile.father_name}</p></div>}
                    {report.profile.contact_number && <div><span className="text-slate-400 font-bold">Contact</span><p className="font-semibold text-slate-700 mt-0.5">{report.profile.contact_number}</p></div>}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4">Payment Ledger</h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-100 text-slate-500">
                      <tr>
                        <th className="px-5 py-3 font-bold">Date</th>
                        <th className="px-5 py-3 font-bold">Receipt ID</th>
                        <th className="px-5 py-3 font-bold">Amount</th>
                        <th className="px-5 py-3 font-bold">Mode</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.payment_history.map(payment => (
                        <tr key={payment.id} className="hover:bg-slate-50">
                          <td className="px-5 py-3">{new Date(payment.payment_date).toLocaleDateString('en-IN')}</td>
                          <td className="px-5 py-3 font-medium text-blue-600">{payment.receipt_id}</td>
                          <td className="px-5 py-3 font-bold text-slate-700">₹{Number(payment.amount_paid).toLocaleString()}</td>
                          <td className="px-5 py-3">{payment.payment_mode}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {report.payment_history.length === 0 && (
                    <div className="p-6 text-center text-slate-400 font-medium">No payments recorded yet.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- 4. ADD STUDENT MODAL ---
const AddStudentModal = ({ onClose, onStudentAdded }) => {
  const toast = useToast();
  const [formData, setFormData] = useState({
    full_name: '', grade_level: 'MINI KG', total_fee: '',
    contact_number: '', mother_name: '', father_name: '', dob: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // IMPROVEMENT: Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleChange = (field) => (e) => setFormData(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await axios.post(`${API_BASE}/api/students`, formData, { headers: authHeader() });
      // IMPROVEMENT: Show toast on success instead of silently closing
      toast('Student registered successfully!', 'success');
      onStudentAdded();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to register student.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-400 focus:bg-white outline-none transition text-gray-800";

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50 shrink-0">
          <h2 className="text-xl font-extrabold text-gray-800">Register New Student</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 font-bold text-xl transition">×</button>
        </div>
        <div className="p-6 overflow-y-auto">
          <form id="add-student-form" onSubmit={handleSubmit} className="space-y-6">
            {error && <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm font-bold rounded-lg">{error}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-bold text-gray-700 mb-1">Student Full Name</label>
                <input type="text" required placeholder="e.g. Aarav Patel" value={formData.full_name} onChange={handleChange('full_name')} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Date of Birth</label>
                <input type="date" value={formData.dob} onChange={handleChange('dob')} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Grade / Class</label>
                <select value={formData.grade_level} onChange={handleChange('grade_level')} className={inputClass}>
                  <option value="MINI KG">MINI KG</option>
                  <option value="JR KG">JR KG</option>
                  <option value="SR KG">SR KG</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Total Course Fee (₹)</label>
                <input type="number" required placeholder="e.g. 50000" min="0" value={formData.total_fee} onChange={handleChange('total_fee')} className={inputClass} />
              </div>
            </div>
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">Parent / Guardian Info</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Mother's Name</label>
                  <input type="text" placeholder="e.g. Priya Patel" value={formData.mother_name} onChange={handleChange('mother_name')} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Father's Name</label>
                  <input type="text" placeholder="e.g. Rahul Patel" value={formData.father_name} onChange={handleChange('father_name')} className={inputClass} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Primary Contact Number</label>
                  <input type="tel" placeholder="+91 9876543210" value={formData.contact_number} onChange={handleChange('contact_number')} className={inputClass} />
                </div>
              </div>
            </div>
          </form>
        </div>
        <div className="p-6 border-t border-gray-100 bg-slate-50 shrink-0">
          <button type="submit" form="add-student-form" disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2">
            {loading && <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>}
            {loading ? 'Registering to Database...' : 'Save Student Profile'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- 5. STUDENTS PAGE ---
const StudentsPage = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  // IMPROVEMENT: Search and filter
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/api/students`, { headers: authHeader() });
      setStudents(response.data);
    } catch (err) {
      if (err.response?.status !== 401) setError('Failed to fetch students.');
    } finally {
      setLoading(false);
    }
  };

  
  const handleVerify = async (id) => {
    try {
      await axios.put(`${API_BASE}/api/students/${id}/verify`, {}, { headers: authHeader() });
      toast('Student approved and officially admitted!', 'success');
      fetchStudents(); // Refresh the table to show the new Verified badge
    } catch (err) {
      toast('Failed to verify student.', 'error');
    }
  };

  useEffect(() => { fetchStudents(); }, []);

  // IMPROVEMENT: Client-side search & status filter
  const filtered = students.filter(s => {
    const matchesSearch = s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      String(s.id).includes(search);
    const matchesStatus = filterStatus === 'all' || s.fee_status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  if (loading) return <Spinner text="Loading Directory..." />;
  if (error) return <div className="p-8 text-red-500 font-bold">{error}</div>;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Student Directory
          <span className="ml-2 text-base font-medium text-slate-400">({students.length} students)</span>
        </h2>
        <button onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-bold shadow-md">
          + Register New Student
        </button>
      </div>

      {/* IMPROVEMENT: Search + filter bar */}
      <div className="flex gap-3 mb-5">
        <input
          type="text" placeholder="Search by name or ID..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition text-gray-800"
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition text-gray-800">
          <option value="all">All Statuses</option>
          <option value="Cleared">Cleared</option>
          <option value="Pending">Pending</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-slate-50 text-slate-500 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 font-bold">ID</th>
              <th className="px-6 py-4 font-bold">Student Name</th>
              <th className="px-6 py-4 font-bold">Class</th>
              <th className="px-6 py-4 font-bold">Total Fees</th>
              <th className="px-6 py-4 font-bold">Status</th>
              {/* IMPROVEMENT: Show verification badge */}
              <th className="px-6 py-4 font-bold">Verified</th>
              <th className="px-6 py-4 font-bold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr><td colSpan="7" className="px-6 py-8 text-center text-slate-400">No students found.</td></tr>
            )}
            {filtered.map((student) => (
              <tr key={student.id} className="hover:bg-slate-50 transition">
                <td className="px-6 py-4 font-medium text-slate-400">#{student.id}</td>
                <td className="px-6 py-4 font-bold text-gray-800">{student.full_name}</td>
                <td className="px-6 py-4">{student.grade_level}</td>
                <td className="px-6 py-4 font-medium">₹{Number(student.total_fee).toLocaleString()}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    student.fee_status === 'Cleared' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>{student.fee_status}</span>
                </td>
                <td className="px-6 py-4">
                  {student.is_verified
                    ? <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">✓ Verified</span>
                    : <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">Pending</span>
                  }
                </td>
               <td className="px-6 py-4 text-right flex justify-end gap-2">
                  {!student.is_verified && (
                    <button onClick={() => handleVerify(student.id)}
                      className="text-green-700 hover:text-green-900 font-bold text-sm bg-green-100 px-3 py-1 rounded-md transition hover:bg-green-200 shadow-sm">
                      ✓ Approve
                    </button>
                  )}
                  <button onClick={() => setSelectedStudentId(student.id)}
                    className="text-blue-600 hover:text-blue-800 font-bold text-sm bg-blue-50 px-3 py-1 rounded-md transition hover:bg-blue-100">
                    View Profile
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedStudentId && (
        <StudentProfileModal studentId={selectedStudentId} onClose={() => setSelectedStudentId(null)} />
      )}
      {isAddModalOpen && (
        <AddStudentModal onClose={() => setIsAddModalOpen(false)} onStudentAdded={fetchStudents} />
      )}
    </div>
  );
};

// --- 6. PAYMENTS PAGE ---
const PaymentsPage = () => {
  const toast = useToast();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [formData, setFormData] = useState({ student_id: '', amount_paid: '', payment_mode: 'Online' });
  // IMPROVEMENT: Show live due amount when a student is selected
  const selectedStudent = students.find(s => String(s.id) === String(formData.student_id));
  const dueAmount = selectedStudent ? Math.max(0, selectedStudent.total_fee - selectedStudent.paid_amount) : null;

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const response = await axios.get(`${API_BASE}/api/students`, { headers: authHeader() });
        setStudents(response.data);
      } catch (err) {
        if (err.response?.status !== 401) console.error('Failed to load students for dropdown.');
      }
    };
    fetchStudents();
  }, []);

  const processPayment = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const response = await axios.post(`${API_BASE}/api/payments`, formData, { headers: authHeader() });
      setStatus({ type: 'success', message: 'Payment Successful!', receiptId: response.data.receipt_id });
      setFormData(prev => ({ ...prev, amount_paid: '' }));
      toast('Payment recorded successfully!', 'success');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to process payment.';
      setStatus({ type: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  const printReceipt = async (receiptId) => {
    try {
      const response = await axios.get(`${API_BASE}/api/receipts/${receiptId}`, {
        headers: authHeader(),
        responseType: 'blob'
      });
      const file = new Blob([response.data], { type: 'application/pdf' });
      const fileURL = URL.createObjectURL(file);
      window.open(fileURL, '_blank');
    } catch (err) {
      // FIX (bug): Replaced alert() with toast notification
      toast('Failed to generate PDF. Is your Python backend running?', 'error');
    }
  };

  const inputClass = "w-full bg-slate-50 border border-slate-200 text-gray-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition";

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Process Fee Payment</h2>
        <p className="text-gray-500 mt-1">Record a new transaction and generate an instant receipt.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        {status && (
          <div className={`p-4 rounded-xl mb-6 font-bold flex justify-between items-center ${
            status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            <span>{status.message}{status.receiptId && ` (ID: ${status.receiptId})`}</span>
            {status.type === 'success' && status.receiptId && (
              <button onClick={() => printReceipt(status.receiptId)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm shadow-sm hover:bg-green-700 transition">
                🖨 Print PDF Receipt
              </button>
            )}
          </div>
        )}

        <form onSubmit={processPayment} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Select Student</label>
            <select required value={formData.student_id}
              onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
              className={inputClass}>
              <option value="" disabled>-- Choose a student --</option>
              {students.map(student => (
                <option key={student.id} value={student.id}>
                  {student.full_name} ({student.grade_level}) — Dues: ₹{Math.max(0, student.total_fee - student.paid_amount).toLocaleString()}
                </option>
              ))}
            </select>
            {/* IMPROVEMENT: Live due amount indicator */}
            {selectedStudent && (
              <div className={`mt-2 text-sm font-bold px-3 py-2 rounded-lg ${dueAmount > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                {dueAmount > 0
                  ? `Outstanding balance: ₹${dueAmount.toLocaleString()}`
                  : '✓ This student has no outstanding dues.'}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Amount Paid (₹)</label>
              <input type="number" required min="1"
                // IMPROVEMENT: Pre-fill with the exact due amount on click
                placeholder={dueAmount ? `Max due: ₹${dueAmount.toLocaleString()}` : 'e.g. 5000'}
                value={formData.amount_paid}
                onChange={(e) => setFormData({ ...formData, amount_paid: e.target.value })}
                className={inputClass} />
              {dueAmount > 0 && (
                <button type="button" onClick={() => setFormData(prev => ({ ...prev, amount_paid: dueAmount }))}
                  className="mt-1.5 text-xs text-blue-600 font-bold hover:underline">
                  Fill full due amount (₹{dueAmount.toLocaleString()})
                </button>
              )}
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Payment Mode</label>
              <select value={formData.payment_mode}
                onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })}
                className={inputClass}>
                <option value="Online">UPI / Online Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Bank Cheque</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <button type="submit" disabled={loading}
              className={`w-full py-4 rounded-xl text-white font-extrabold text-lg shadow-md transition flex items-center justify-center gap-2 ${
                loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'
              }`}>
              {loading && <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>}
              {loading ? 'Processing Payment...' : 'Record Payment Securely'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- 7. REPORTS PAGE (FEE DEFAULTERS) ---
const ReportsPage = () => {
  const [defaulters, setDefaulters] = useState([]);
  const [loading, setLoading] = useState(true);
  // IMPROVEMENT: Sort controls
  const [sortBy, setSortBy] = useState('amount_desc');

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await axios.get(`${API_BASE}/api/students`, { headers: authHeader() });
        const pendingStudents = response.data.filter(s => s.fee_status === 'Pending');
        setDefaulters(pendingStudents);
      } catch (err) {
        if (err.response?.status !== 401) console.error('Failed to load report data.');
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  const totalPendingMoney = defaulters.reduce((sum, s) => sum + Math.max(0, s.total_fee - s.paid_amount), 0);

  const sorted = [...defaulters].sort((a, b) => {
    const dueA = a.total_fee - a.paid_amount;
    const dueB = b.total_fee - b.paid_amount;
    if (sortBy === 'amount_desc') return dueB - dueA;
    if (sortBy === 'amount_asc') return dueA - dueB;
    if (sortBy === 'name') return a.full_name.localeCompare(b.full_name);
    return 0;
  });

  if (loading) return <Spinner text="Generating Report..." />;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Financial Reports</h2>
          <p className="text-gray-500 mt-1">Outstanding dues and fee defaulters.</p>
        </div>
        <button onClick={() => window.print()}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition text-sm font-bold shadow-md">
          🖨 Print Report
        </button>
      </div>

      <div className="bg-red-50 border border-red-100 p-6 rounded-xl mb-8 flex justify-between items-center">
        <div>
          <p className="text-sm text-red-600 font-bold uppercase tracking-wider">Total Outstanding Revenue</p>
          <p className="text-3xl font-black text-red-700 mt-1">₹{totalPendingMoney.toLocaleString()}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-red-600 font-bold uppercase tracking-wider">Total Defaulters</p>
          <p className="text-3xl font-black text-red-700 mt-1">{defaulters.length} Students</p>
        </div>
      </div>

      {/* IMPROVEMENT: Sort controls */}
      <div className="flex justify-end mb-3">
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-700">
          <option value="amount_desc">Highest dues first</option>
          <option value="amount_asc">Lowest dues first</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-slate-50 text-slate-500 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 font-bold">ID</th>
              <th className="px-6 py-4 font-bold">Student Name</th>
              <th className="px-6 py-4 font-bold">Class</th>
              <th className="px-6 py-4 font-bold text-right">Amount Owed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((student) => (
              <tr key={student.id} className="hover:bg-slate-50 transition">
                <td className="px-6 py-4 font-medium text-slate-400">#{student.id}</td>
                <td className="px-6 py-4 font-bold text-gray-800">{student.full_name}</td>
                <td className="px-6 py-4">{student.grade_level}</td>
                <td className="px-6 py-4 font-bold text-red-600 text-right">
                  ₹{Math.max(0, student.total_fee - student.paid_amount).toLocaleString()}
                </td>
              </tr>
            ))}
            {defaulters.length === 0 && (
              <tr>
                <td colSpan="4" className="px-6 py-8 text-center text-green-600 font-bold">
                  ✓ All clear! No pending dues in the system.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- 8. SETTINGS PAGE ---
const SettingsPage = () => {
  const toast = useToast();
  // FIX (bug): Settings form used defaultValue (uncontrolled) — switched to controlled state
  // so the save handler actually knows what the user typed.
  const [settings, setSettings] = useState({ school_name: 'Little Angels', academic_year: '2025 - 2026', currency: 'INR (₹)' });

  const handleSave = (e) => {
    e.preventDefault();
    // FIX (bug): Previously this did nothing (no API call, no real save).
    // Now it shows a toast. Wire up to POST /api/settings when that endpoint exists.
    toast('Settings saved (UI only — connect to /api/settings to persist).', 'success');
  };

  const inputClass = "w-full bg-slate-50 border border-slate-200 text-gray-800 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition";

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">System Settings</h2>
        <p className="text-gray-500 mt-1">Configure your portal preferences.</p>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-2">School / Organization Name</label>
              <input type="text" value={settings.school_name}
                onChange={e => setSettings(p => ({ ...p, school_name: e.target.value }))}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Academic Year</label>
              <select value={settings.academic_year}
                onChange={e => setSettings(p => ({ ...p, academic_year: e.target.value }))}
                className={inputClass}>
                <option>2025 - 2026</option>
                <option>2026 - 2027</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Currency</label>
              <select value={settings.currency}
                onChange={e => setSettings(p => ({ ...p, currency: e.target.value }))}
                className={inputClass}>
                <option>INR (₹)</option>
                <option>USD ($)</option>
              </select>
            </div>
          </div>
          <div className="pt-6 border-t border-gray-100 flex justify-end">
            <button type="submit"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition">
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- 9. PARENT DASHBOARD ---
const ParentDashboard = ({ activeUser, handleLogout }) => {
  const studentId = localStorage.getItem('student_id');
  const [showProfile, setShowProfile] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-slate-950 h-16 flex items-center justify-between px-8 shadow-md">
        <h1 className="text-xl font-extrabold tracking-wider text-blue-400">
          LITTLE ANGELS <span className="text-sm text-slate-300 font-medium">PARENT PORTAL</span>
        </h1>
        <button onClick={handleLogout} className="text-slate-400 hover:text-red-400 transition font-bold">
          Log Out
        </button>
      </header>
      <main className="flex-1 p-8 max-w-4xl mx-auto w-full mt-8">
        <div className="bg-white p-10 rounded-2xl shadow-xl border border-slate-200 text-center">
          <h2 className="text-3xl font-black text-slate-800 mb-4">Welcome, {activeUser}!</h2>
          <p className="text-slate-600 font-medium mb-8">
            Your child's admission is officially verified. You can now access their full academic and financial profile.
          </p>
          <button onClick={() => setShowProfile(true)} className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-lg transition text-lg">
            View Student Report
          </button>
        </div>
      </main>
      {showProfile && <StudentProfileModal studentId={studentId} onClose={() => setShowProfile(false)} />}
    </div>
  );
};

// --- 9. THE MASTER LAYOUT ---
// FIX (bug): Removed three duplicate "--- 7. THE MASTER LAYOUT ---" comments
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('school_token'));
  const [authView, setAuthView] = useState('login');

  const handleLogout = () => {
    localStorage.clear();
    setIsAuthenticated(false);
    setAuthView('login');
  };

  if (!isAuthenticated) {
    if (authView === 'register') {
      return (
        <ToastProvider>
          <ParentRegistrationPage onNavigateLogin={() => setAuthView('login')} />
        </ToastProvider>
      );
    }
    return (
      <ToastProvider>
        <LoginPage onLogin={() => setIsAuthenticated(true)} onNavigateRegister={() => setAuthView('register')} />
      </ToastProvider>
    );
  }

  const activeUser = localStorage.getItem('username') || 'User';
  const userRole = localStorage.getItem('role');

if (userRole === 'parent') {
    const isVerified = localStorage.getItem('is_verified') === 'true';

    if (!isVerified) {
      return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
          <div className="bg-slate-950 p-10 rounded-2xl border border-slate-800 text-center max-w-md w-full shadow-2xl">
            <h1 className="text-2xl font-black text-blue-400 mb-2">PARENT PORTAL</h1>
            <p className="text-slate-400 font-medium mb-8">
              Your registration is currently pending. Please wait for an administrator to verify your student's admission.
            </p>
            <button onClick={handleLogout} className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition w-full">
              Log Out
            </button>
          </div>
        </div>
      );
    }

    return <ParentDashboard activeUser={activeUser} handleLogout={handleLogout} />;
  }

  // FIX (bug): Removed two leftover stub comment lines:
  //   "// ... The rest of your Admin return stays EXACTLY the same ..."
  //   "// ... rest of your App return statement stays exactly the same ..."
  // Those were placeholder comments that shipped into production code.

  return (
    <ToastProvider>
      <BrowserRouter>
        <div className="flex h-screen bg-slate-50 font-sans">
          <aside className="w-64 bg-slate-950 text-white flex flex-col shadow-2xl z-20">
            <div className="p-6 border-b border-slate-800">
              <h1 className="text-xl font-extrabold tracking-wider text-blue-400">
                LITTLE ANGELS<br/><span className="text-sm text-slate-300 font-medium">EDU PORTAL</span>
              </h1>
            </div>
            <nav className="flex-1 p-4 overflow-y-auto">
              <SidebarLink to="/"          label="Dashboard"      icon="📊" />
              <SidebarLink to="/students"  label="Students"       icon="👨‍🎓" />
              <SidebarLink to="/payments"  label="Fees & Payments" icon="💳" />
              <SidebarLink to="/reports"   label="Reports"        icon="📄" />
              <SidebarLink to="/settings"  label="Settings"       icon="⚙️" />
            </nav>
            <div className="p-4 border-t border-slate-800">
              <button onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-slate-400 hover:text-red-400 transition-colors font-bold">
                Log Out
              </button>
            </div>
          </aside>

          <div className="flex-1 flex flex-col overflow-hidden">
            <header className="bg-white h-16 flex items-center justify-between px-8 border-b border-slate-200 shadow-sm z-10">
              {/* IMPROVEMENT: Show role badge in header */}
              <h2 className="text-lg font-semibold text-slate-700 capitalize">
                {userRole === 'admin' ? 'Administrator View' : 'Staff View'}
              </h2>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold uppercase">
                  {activeUser.charAt(0)}
                </div>
                <div>
                  <span className="text-sm font-bold text-slate-600 capitalize block">{activeUser}</span>
                  <span className="text-xs text-slate-400 capitalize">{userRole}</span>
                </div>
              </div>
            </header>

            <main className="flex-1 overflow-y-auto">
              <Routes>
                <Route path="/"         element={<DashboardHome />} />
                <Route path="/students" element={<StudentsPage />} />
                <Route path="/payments" element={<PaymentsPage />} />
                <Route path="/reports"  element={<ReportsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </main>
          </div>
        </div>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;