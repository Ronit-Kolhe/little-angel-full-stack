import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';

// --- 0A. PUBLIC PARENT REGISTRATION PAGE ---
const ParentRegistrationPage = ({ onNavigateLogin }) => {
  const [formData, setFormData] = useState({
    full_name: '', grade_level: 'MINI KG', contact_number: '',
    mother_name: '', father_name: '', username: '', password: ''
  });
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      await axios.post('http://127.0.0.1:8000/api/register', formData);
      setStatus({ type: 'success', message: 'Registration successful! Please wait for Admin approval before logging in.' });
      // Clear the form on success
      setFormData({ full_name: '', grade_level: 'MINI KG', contact_number: '', mother_name: '', father_name: '', username: '', password: '' });
    } catch (err) {
      setStatus({ type: 'error', message: err.response?.data?.detail || 'Registration failed. Username might be taken.' });
    } finally {
      setLoading(false);
    }
  };

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
            <button onClick={onNavigateLogin} className="text-sm font-bold text-blue-600 hover:underline">
              ← Back to Login
            </button>
          </div>
          
          {status && (
            <div className={`p-4 rounded-lg mb-6 font-bold text-center ${status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {status.message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-bold text-gray-700 mb-1">Student Full Name</label>
                <input required type="text" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Applying For Class</label>
                <select value={formData.grade_level} onChange={e => setFormData({...formData, grade_level: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2">
                  <option value="MINI KG">MINI KG</option>
                  <option value="JR KG">JR KG</option>
                  <option value="SR KG">SR KG</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Mother's Name</label>
                <input type="text" value={formData.mother_name} onChange={e => setFormData({...formData, mother_name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Father's Name</label>
                <input type="text" value={formData.father_name} onChange={e => setFormData({...formData, father_name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Primary Contact Number</label>
              <input required type="tel" value={formData.contact_number} onChange={e => setFormData({...formData, contact_number: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2" />
            </div>

            <div className="pt-4 border-t border-slate-100 mt-4 space-y-4">
              <h3 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">Create Portal Login</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Choose Username</label>
                  <input required type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Create Password</label>
                  <input required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2" />
                </div>
              </div>
            </div>
            
            <button type="submit" disabled={loading} className="w-full py-3 mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition">
              {loading ? "Submitting Application..." : "Submit Registration"}
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // FastAPI expects standard Form Data for logins, not a JSON object!
      const params = new URLSearchParams();
      params.append('username', credentials.username);
      params.append('password', credentials.password);

      const response = await axios.post('http://127.0.0.1:8000/api/login', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      // Save the secure token and user details to the browser's local vault
      localStorage.setItem('school_token', response.data.access_token);
      localStorage.setItem('username', response.data.username);
      localStorage.setItem('role', response.data.role);
      
      onLogin(); // Tell the main app to unlock the gates
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid username or password");
    } finally {
      setLoading(false);
    }
  };

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
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm font-bold rounded-lg text-center">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Username</label>
              <input 
                type="text" required
                value={credentials.username}
                onChange={(e) => setCredentials({...credentials, username: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Password</label>
              <input 
                type="password" required
                value={credentials.password}
                onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition"
              />
            </div>
            
            <button 
              type="submit" disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition"
            >
              {loading ? "Authenticating..." : "Access Dashboard"}
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
const SidebarLink = ({ to, label }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link 
      to={to} 
      className={`block px-4 py-3 rounded-lg mb-1 transition-colors ${
        isActive ? 'bg-blue-600 text-white font-medium' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
      }`}
    >
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
    try {
      setLoading(true);
      const response = await axios.get('http://127.0.0.1:8000/api/analytics', {
        headers: { Authorization: `Bearer ${localStorage.getItem('school_token')}` } 
      });
      setAnalytics(response.data);
      setError(null);
    } catch (err) {
      setError("Failed to connect to the server. Is your Python backend running?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) return <div className="p-8 text-blue-500 font-bold">Loading Live Data...</div>;
  if (error) return <div className="p-8 text-red-500 font-bold">{error}</div>;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard Analytics</h2>
        <button onClick={fetchDashboardData} className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition text-sm font-bold">
          Refresh Data
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm border-l-4 border-l-blue-500">
          <p className="text-sm text-gray-500 font-medium">Total Students</p>
          <p className="text-3xl font-bold text-gray-800">{analytics.summary_cards.total_students}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm border-l-4 border-l-green-500">
          <p className="text-sm text-gray-500 font-medium">Total Collected</p>
          <p className="text-3xl font-bold text-gray-800">₹{analytics.summary_cards.total_collected.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm border-l-4 border-l-red-500">
          <p className="text-sm text-gray-500 font-medium">Pending Dues</p>
          <p className="text-3xl font-bold text-gray-800">₹{analytics.summary_cards.total_pending.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm border-l-4 border-l-purple-500">
          <p className="text-sm text-gray-500 font-medium">Defaulters</p>
          <p className="text-3xl font-bold text-gray-800">{analytics.summary_cards.fees_pending_count}</p>
        </div>
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
            {analytics.recent_activity_ledger.map((payment) => (
              <tr key={payment.id} className="hover:bg-slate-50 transition">
                <td className="px-6 py-4 font-medium text-blue-600">{payment.receipt_id}</td>
                <td className="px-6 py-4 font-medium text-gray-800">{payment.students.full_name}</td>
                <td className="px-6 py-4 font-bold text-green-600">₹{payment.amount_paid.toLocaleString()}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-slate-100 rounded-md text-xs font-bold text-slate-600">
                    {payment.payment_mode}
                  </span>
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

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const response = await axios.get(`http://127.0.0.1:8000/api/students/${studentId}/report`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('school_token')}` }
        });
        setReport(response.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [studentId]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-800">Student 360° Profile</h2>
            <p className="text-sm text-gray-500 font-medium">ID: #{studentId}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-white rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 shadow-sm flex items-center justify-center transition font-bold text-xl">
            ×
          </button>
        </div>

        <div className="p-8 overflow-y-auto">
          {loading ? (
            <div className="text-center py-10 text-blue-500 font-bold">Loading Profile Data...</div>
          ) : report ? (
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
                          <td className="px-5 py-3">{new Date(payment.payment_date).toLocaleDateString()}</td>
                          <td className="px-5 py-3 font-medium text-blue-600">{payment.receipt_id}</td>
                          <td className="px-5 py-3 font-bold text-slate-700">₹{payment.amount_paid.toLocaleString()}</td>
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
          ) : (
            <div className="text-center py-10 text-red-500 font-bold">Failed to load student data.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- 4. ADD STUDENT MODAL ---
const AddStudentModal = ({ onClose, onStudentAdded }) => {
  const [formData, setFormData] = useState({
    full_name: "",
    grade_level: "MINI KG",
    total_fee: "",
    contact_number: "",
    mother_name: "",
    father_name: "",
    dob: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post('http://127.0.0.1:8000/api/students', formData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('school_token')}` }
      });
      onStudentAdded(); 
      onClose(); 
    } catch (err) {
      setError("Failed to register student.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50 shrink-0">
          <h2 className="text-xl font-extrabold text-gray-800">Register New Student</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 font-bold text-xl">×</button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form id="add-student-form" onSubmit={handleSubmit} className="space-y-6">
            {error && <div className="p-3 bg-red-50 text-red-600 text-sm font-bold rounded-lg">{error}</div>}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-bold text-gray-700 mb-1">Student Full Name</label>
                <input 
                  type="text" required placeholder="e.g. Aarav Patel"
                  value={formData.full_name} onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Date of Birth</label>
                <input 
                  type="date" 
                  value={formData.dob} onChange={(e) => setFormData({...formData, dob: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Grade / Class</label>
                <select 
                  value={formData.grade_level} onChange={(e) => setFormData({...formData, grade_level: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="MINI KG">MINI KG</option>
                  <option value="JR KG">JR KG</option>
                  <option value="SR KG">SR KG</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Total Course Fee (₹)</label>
                <input 
                  type="number" required placeholder="e.g. 50000" min="0"
                  value={formData.total_fee} onChange={(e) => setFormData({...formData, total_fee: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">Parent / Guardian Info</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Mother's Name</label>
                  <input 
                    type="text" placeholder="e.g. Priya Patel"
                    value={formData.mother_name} onChange={(e) => setFormData({...formData, mother_name: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Father's Name</label>
                  <input 
                    type="text" placeholder="e.g. Rahul Patel"
                    value={formData.father_name} onChange={(e) => setFormData({...formData, father_name: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Primary Contact Number</label>
                  <input 
                    type="tel" placeholder="e.g. +91 9876543210"
                    value={formData.contact_number} onChange={(e) => setFormData({...formData, contact_number: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-gray-100 bg-slate-50 shrink-0">
          <button 
            type="submit" form="add-student-form" disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition shadow-md"
          >
            {loading ? "Registering to Database..." : "Save Student Profile"}
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

  const fetchStudents = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/api/students', {
        headers: { Authorization: `Bearer ${localStorage.getItem('school_token')}` } 
      });
      setStudents(response.data);
    } catch (err) {
      setError("Failed to fetch students.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  if (loading) return <div className="p-8 text-blue-500 font-bold">Loading Directory...</div>;
  if (error) return <div className="p-8 text-red-500 font-bold">{error}</div>;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Student Directory</h2>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-bold shadow-md"
        >
          + Register New Student
        </button>
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
              <th className="px-6 py-4 font-bold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {students.map((student) => (
              <tr key={student.id} className="hover:bg-slate-50 transition">
                <td className="px-6 py-4 font-medium text-slate-400">#{student.id}</td>
                <td className="px-6 py-4 font-bold text-gray-800">{student.full_name}</td>
                <td className="px-6 py-4">{student.grade_level}</td>
                <td className="px-6 py-4 font-medium">₹{student.total_fee.toLocaleString()}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    student.fee_status === 'Cleared' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {student.fee_status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => setSelectedStudentId(student.id)}
                    className="text-blue-600 hover:text-blue-800 font-bold text-sm bg-blue-50 px-3 py-1 rounded-md transition hover:bg-blue-100"
                  >
                    View Profile
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedStudentId && (
        <StudentProfileModal 
          studentId={selectedStudentId} 
          onClose={() => setSelectedStudentId(null)} 
        />
      )}

      {isAddModalOpen && (
        <AddStudentModal 
          onClose={() => setIsAddModalOpen(false)} 
          onStudentAdded={fetchStudents} 
        />
      )}
    </div>
  );
};

// --- 6. PAYMENTS PAGE ---
const PaymentsPage = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); 
  
  const [formData, setFormData] = useState({
    student_id: "",
    amount_paid: "",
    payment_mode: "Online"
  });

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const response = await axios.get('http://127.0.0.1:8000/api/students', {
          headers: { Authorization: `Bearer ${localStorage.getItem('school_token')}` } 
        });
        setStudents(response.data);
      } catch (err) {
        console.error("Failed to load students for dropdown.");
      }
    };
    fetchStudents();
  }, []);

  const processPayment = async (e) => {
    e.preventDefault(); 
    setLoading(true);
    setStatus(null);

    try {
      const response = await axios.post('http://127.0.0.1:8000/api/payments', formData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('school_token')}` }
      });
      
      setStatus({ 
        type: "success", 
        message: "Payment Successful!", 
        receiptId: response.data.receipt_id 
      });
      setFormData({ ...formData, amount_paid: "" });
      
    } catch (err) {
      setStatus({ type: "error", message: "Failed to process payment." });
    } finally {
      setLoading(false);
    }
  };

  const printReceipt = async (receiptId) => {
    try {
      const response = await axios.get(`http://127.0.0.1:8000/api/receipts/${receiptId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('school_token')}` },
        responseType: 'blob' 
      });
      
      const file = new Blob([response.data], { type: 'application/pdf' });
      const fileURL = URL.createObjectURL(file);
      window.open(fileURL, '_blank');
      
    } catch (err) {
      alert("Failed to generate PDF. Is your Python backend running?");
    }
  };

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
            <span>{status.message} {status.receiptId && `(ID: ${status.receiptId})`}</span>
            
            {status.type === 'success' && status.receiptId && (
              <button 
                onClick={() => printReceipt(status.receiptId)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm shadow-sm hover:bg-green-700 transition"
              >
                Print PDF Receipt
              </button>
            )}
          </div>
        )}

        <form onSubmit={processPayment} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Select Student</label>
            <select 
              required
              value={formData.student_id}
              onChange={(e) => setFormData({...formData, student_id: e.target.value})}
              className="w-full bg-slate-50 border border-slate-200 text-gray-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            >
              <option value="" disabled>-- Choose a student --</option>
              {students.map(student => (
                <option key={student.id} value={student.id}>
                  {student.full_name} (Class: {student.grade_level}) - Dues: ₹{(student.total_fee - student.paid_amount)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Amount Paid (₹)</label>
              <input 
                type="number" required min="1" placeholder="e.g. 5000"
                value={formData.amount_paid}
                onChange={(e) => setFormData({...formData, amount_paid: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 text-gray-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Payment Mode</label>
              <select 
                value={formData.payment_mode}
                onChange={(e) => setFormData({...formData, payment_mode: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 text-gray-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              >
                <option value="Online">UPI / Online Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Bank Cheque</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <button 
              type="submit" disabled={loading}
              className={`w-full py-4 rounded-xl text-white font-extrabold text-lg shadow-md transition ${
                loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'
              }`}
            >
              {loading ? 'Processing Payment...' : 'Record Payment Securely'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- 8. REPORTS PAGE (FEE DEFAULTERS) ---
const ReportsPage = () => {
  const [defaulters, setDefaulters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        // We reuse the students endpoint to generate our financial report
        const response = await axios.get('http://127.0.0.1:8000/api/students', {
          headers: { Authorization: `Bearer ${localStorage.getItem('school_token')}` }
        });
        
        // Filter out only the students who still owe money
        const pendingStudents = response.data.filter(s => s.fee_status === 'Pending');
        setDefaulters(pendingStudents);
      } catch (err) {
        console.error("Failed to load report data.");
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  const totalPendingMoney = defaulters.reduce((sum, student) => sum + (student.total_fee - student.paid_amount), 0);

  if (loading) return <div className="p-8 text-blue-500 font-bold">Generating Report...</div>;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Financial Reports</h2>
          <p className="text-gray-500 mt-1">Outstanding dues and fee defaulters.</p>
        </div>
        <button 
          onClick={() => window.print()}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition text-sm font-bold shadow-md"
        >
          Print Report
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
            {defaulters.map((student) => (
              <tr key={student.id} className="hover:bg-slate-50 transition">
                <td className="px-6 py-4 font-medium text-slate-400">#{student.id}</td>
                <td className="px-6 py-4 font-bold text-gray-800">{student.full_name}</td>
                <td className="px-6 py-4">{student.grade_level}</td>
                <td className="px-6 py-4 font-bold text-red-600 text-right">
                  ₹{(student.total_fee - student.paid_amount).toLocaleString()}
                </td>
              </tr>
            ))}
            {defaulters.length === 0 && (
              <tr>
                <td colSpan="4" className="px-6 py-8 text-center text-green-600 font-bold">
                  All clear! No pending dues in the system.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- 9. SETTINGS PAGE ---
const SettingsPage = () => {
  const [saved, setSaved] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">System Settings</h2>
        <p className="text-gray-500 mt-1">Configure your portal preferences.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        {saved && (
          <div className="p-4 bg-green-50 text-green-700 font-bold rounded-xl mb-6 border border-green-200">
            Settings successfully updated!
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-2">School/Organization Name</label>
              <input 
                type="text" defaultValue="Mangalam Engineering School"
                className="w-full bg-slate-50 border border-slate-200 text-gray-800 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Academic Year</label>
              <select className="w-full bg-slate-50 border border-slate-200 text-gray-800 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none">
                <option>2025 - 2026</option>
                <option>2026 - 2027</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Currency</label>
              <select className="w-full bg-slate-50 border border-slate-200 text-gray-800 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none">
                <option>INR (₹)</option>
                <option>USD ($)</option>
              </select>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 flex justify-end">
            <button 
              type="submit"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition"
            >
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- 7. THE MASTER LAYOUT ---
// --- 7. THE MASTER LAYOUT ---
// --- 7. THE MASTER LAYOUT ---
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('school_token'));
  const [authView, setAuthView] = useState('login'); // Toggles between 'login' and 'register'
  
  const handleLogout = () => {
    localStorage.clear();
    setIsAuthenticated(false);
    setAuthView('login');
  };

  // The Gatekeeper: If not logged in, show either Login or Register
  if (!isAuthenticated) {
    if (authView === 'register') {
      return <ParentRegistrationPage onNavigateLogin={() => setAuthView('login')} />;
    }
    return <LoginPage onLogin={() => setIsAuthenticated(true)} onNavigateRegister={() => setAuthView('register')} />;
  }

  const activeUser = localStorage.getItem('username') || "Staff";
  
  // ... rest of your App return statement stays exactly the same ...

  return (
    <BrowserRouter>
      <div className="flex h-screen bg-slate-50 font-sans">
        
        {/* LEFT: The Sidebar */}
        <aside className="w-64 bg-slate-950 text-white flex flex-col shadow-2xl z-20">
          <div className="p-6 border-b border-slate-800">
            <h1 className="text-xl font-extrabold tracking-wider text-blue-400">
              LITTLE ANGELS<br/><span className="text-sm text-slate-300 font-medium">EDU PORTAL</span>
            </h1>
          </div>
          
          <nav className="flex-1 p-4 overflow-y-auto">
            <SidebarLink to="/" label="Dashboard" />
            <SidebarLink to="/students" label="Students" />
            <SidebarLink to="/payments" label="Fees & Payments" />
            <SidebarLink to="/reports" label="Reports" />
            <SidebarLink to="/settings" label="Settings" />
          </nav>
          
          <div className="p-4 border-t border-slate-800">
            {/* The Logout Button is now active! */}
            <button 
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-slate-400 hover:text-red-400 transition-colors font-bold"
            >
              Log Out
            </button>
          </div>
        </aside>

        {/* RIGHT: The Main Content Column */}
        <div className="flex-1 flex flex-col overflow-hidden">
          
          <header className="bg-white h-16 flex items-center justify-between px-8 border-b border-slate-200 shadow-sm z-10">
            <h2 className="text-lg font-semibold text-slate-700">Administrator View</h2>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold uppercase">
                {activeUser.charAt(0)}
              </div>
              <span className="text-sm font-bold text-slate-600 capitalize">{activeUser}</span>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<DashboardHome />} />
              <Route path="/students" element={<StudentsPage />} />
              <Route path="/payments" element={<PaymentsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
          
        </div>
      </div>
    </BrowserRouter>
  );
}



export default App;