import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../../services/api';
import { supabase } from '../../services/supabaseClient';
import './Auth.css';

/* ── SVG icons (inline, no dependency) ───────────── */
const IconMail = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
);

const IconLock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const IconEye = ({ off }) => off ? (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/>
  </svg>
) : (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);

const IconAlert = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const IconArrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);

const ShieldSVG = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
  </svg>
);

/* ═══════════════════════════════════════════════════
   LOGIN
   ═══════════════════════════════════════════════════ */
export default function Login() {
  const navigate = useNavigate();

  const [form, setForm]       = useState({ email: '', password: '' });
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const set = (k) => (e) => {
    setForm(f => ({ ...f, [k]: e.target.value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { setError('Please fill in all fields.'); return; }

    setLoading(true);
    setError('');
    try {
      // FIX: Use Supabase directly so the session is persisted to localStorage
      // authAPI.login() calls the Node backend which validates but doesn't
      // persist the session on the frontend. We use Supabase client directly.
      const { data, error: supabaseError } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });

      if (supabaseError) {
        setError(supabaseError.message || 'Invalid email or password.');
        return;
      }

      // Session is now persisted in localStorage by the Supabase client.
      // Optionally also call the Node backend to log the event / update last_login:
      try {
        await authAPI.login({ email: form.email.trim(), password: form.password });
      } catch (_) {
        // Non-critical — navigation still proceeds
      }

      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">

      {/* ── Left: Brand ────────────────────────────── */}
      <div className="auth-brand">

        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-shield"><ShieldSVG /></div>
          <span className="auth-logo-text">SafeGuard</span>
        </div>

        {/* Hero */}
        <div className="auth-hero">
          <div className="auth-hero-tag">
            <span />
            Always Active
          </div>
          <h1>
            Your safety,
            <em>always protected.</em>
          </h1>
          <p>
            Instant SOS. Real-time location. AI that understands emergencies
            in 10 Indian languages. Help is one tap away.
          </p>

          <div className="auth-stats">
            <div className="auth-stat">
              <span className="auth-stat-num">112</span>
              <span className="auth-stat-label">Instant Connect</span>
            </div>
            <div className="auth-stat">
              <span className="auth-stat-num">10+</span>
              <span className="auth-stat-label">Languages</span>
            </div>
            <div className="auth-stat">
              <span className="auth-stat-num">24/7</span>
              <span className="auth-stat-label">AI Support</span>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="auth-features">
          {[
            { icon: '🆘', title: 'SOS in 3 Seconds',     desc: 'Hold-to-trigger with auto location share' },
            { icon: '🤖', title: 'AI Safety Assistant',  desc: 'Understands Hindi, Tamil, Telugu & more'  },
            { icon: '🔒', title: 'End-to-End Encrypted', desc: 'Your data is always private and secure'    },
          ].map(f => (
            <div className="auth-feature" key={f.title}>
              <div className="auth-feature-icon">{f.icon}</div>
              <div className="auth-feature-text">
                <span className="auth-feature-title">{f.title}</span>
                <span className="auth-feature-desc">{f.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: Form ────────────────────────────── */}
      <div className="auth-form-panel">
        <div className="auth-form-box">

          <div className="auth-form-header">
            <p className="auth-form-eyebrow">Welcome back</p>
            <h2 className="auth-form-title">Sign in to your account</h2>
            <p className="auth-form-subtitle">
              Your emergency profile and contacts are waiting.
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>

            {error && (
              <div className="auth-alert" role="alert">
                <IconAlert />
                <span>{error}</span>
              </div>
            )}

            {/* Email */}
            <div className="auth-field">
              <label className="auth-label" htmlFor="email">Email address</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon"><IconMail /></span>
                <input
                  id="email"
                  type="email"
                  className="auth-input"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={set('email')}
                  autoComplete="email"
                  inputMode="email"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div className="auth-field">
              <label className="auth-label" htmlFor="password">Password</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon"><IconLock /></span>
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={set('password')}
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="auth-pw-toggle"
                  onClick={() => setShowPw(p => !p)}
                  tabIndex={-1}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  <IconEye off={showPw} />
                </button>
              </div>
            </div>

            {/* Submit */}
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="auth-spinner" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign In
                  <IconArrow />
                </>
              )}
            </button>

          </form>

          <div className="auth-switch" style={{ marginTop: '24px' }}>
            Don't have an account?{' '}
            <Link to="/register">Create one free</Link>
          </div>

        </div>
      </div>
    </div>
  );
}