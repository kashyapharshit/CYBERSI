import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { api } from './api';
import { AuthProvider, useAuth } from './auth';
import App from './App';
import './styles.css';

function AuthPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await api.login(form);
      signIn(result);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-art">
        <div className="brand-lockup"><span className="brand-mark">A</span><span>Attack On Point</span></div>
        <p className="eyebrow">Continuous cyber risk quantification</p>
        <h1>Turn live security evidence into the next rupee of protection.</h1>
        <p className="auth-copy">A board-ready control room for technical telemetry, financial exposure, and defensible investment decisions.</p>
        <div className="auth-signal"><span className="pulse-dot" /> Evidence pipeline online</div>
      </div>
      <div className="auth-card-wrap">
        <form className="auth-card" onSubmit={submit}>
          <p className="eyebrow">Secure workspace</p>
          <h2>Welcome back</h2>
          <p className="muted">Internal workspace access. Company administrators provision users in the database.</p>
          <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
          <label>Password<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
          {error && <div className="error-box">{error}</div>}
          <button className="button primary full" disabled={busy}>{busy ? 'Connecting...' : 'Enter command center'}</button>
          <div className="demo-divider"><span>GitHub demo workspace</span></div>
          <div className="demo-login-grid"><button type="button" className="demo-login" onClick={() => { setForm({ email: 'admin@demo.attackonpoint.local', password: 'admin1234' }); setError(''); }}><strong>Demo CISO</strong><small>Executive + investment view</small></button><button type="button" className="demo-login" onClick={() => { setForm({ email: 'analyst@demo.attackonpoint.local', password: 'analyst1234' }); setError(''); }}><strong>Demo Analyst</strong><small>Technical + attack view</small></button><button type="button" className="demo-login" onClick={() => { setForm({ email: 'viewer@demo.attackonpoint.local', password: 'viewer1234' }); setError(''); }}><strong>Demo Board Viewer</strong><small>Read-only board summary</small></button></div>
          <p className="demo-hint">Demo credentials are local-only and never sent to your backend.</p>
        </form>
      </div>
    </div>
  );
}

function ProtectedApp() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading secure workspace...</div>;
  if (!user) return <AuthPage />;
  return <App />;
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="*" element={<ProtectedApp />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
