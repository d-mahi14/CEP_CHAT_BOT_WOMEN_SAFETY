// =====================================================
// Register.jsx — FIXED
// =====================================================
// ROOT CAUSE OF "User already registered" ERROR:
//   The original handleSubmit() called BOTH:
//     1. supabase.auth.signUp()   ← creates auth user
//     2. authAPI.register()       ← backend ALSO calls signUp → duplicate → error
//
// FIX — clean two-step flow:
//   STEP 1 (goStep2):
//     a) supabase.auth.signUp()  → creates Supabase auth user, gets session token
//     b) POST /api/auth/register (body has NO password) → backend skips signUp,
//        only inserts into public.users with phone + full_name
//     c) Store access_token in component state for Step 2
//
//   STEP 2 (handleSubmit):
//     a) POST /api/emergency-contacts (×2) using stored token
//     b) Navigate to /dashboard
//     *** Never calls register or signUp again ***
// =====================================================

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { emergencyAPI } from '../../services/api';
import axios from 'axios';
import './Auth.css';

const NODE_API = process.env.REACT_APP_NODE_API_URL || 'http://localhost:5000';

/* ── inline SVG icons (zero deps) ──────────────────── */
const Ico = {
  user:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  mail:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
  phone: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12 19.79 19.79 0 0 1 1.08 3.4 2 2 0 0 1 3.06 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16l.02.92z"/></svg>,
  lock:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  eye:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  eyeOff:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>,
  alert: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  arrow: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  back:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  shield:<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>,
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
};

/* ── Password strength ─────────────────────────────── */
function pwStrength(pw) {
  let s = 0;
  if (pw.length >= 8)            s++;
  if (/[A-Z]/.test(pw))          s++;
  if (/[0-9]/.test(pw))          s++;
  if (/[^A-Za-z0-9]/.test(pw))   s++;
  return { score: s, label: ['','Weak','Fair','Good','Strong'][s] || '', cls: ['','weak','fair','good','strong'][s] || '' };
}

function PwStrength({ pw }) {
  if (!pw) return null;
  const { score, label, cls } = pwStrength(pw);
  return (
    <div className="auth-pw-strength">
      <div className="auth-pw-bars">
        {[1,2,3,4].map(i => <div key={i} className={`auth-pw-bar${i <= score ? ' ' + cls : ''}`} />)}
      </div>
      <span className={`auth-pw-label ${cls}`}>{label}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   REGISTER COMPONENT
   ══════════════════════════════════════════════════════ */
export default function Register() {
  const navigate = useNavigate();
  const [step,     setStep]     = useState(1);
  const [showPw,   setShowPw]   = useState(false);
  const [showCpw,  setShowCpw]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [agreed,   setAgreed]   = useState(false);

  // Step-1 stores the session token so Step-2 can make auth'd requests
  const [sessionToken, setSessionToken] = useState('');

  const [form, setForm] = useState({
    full_name:       '',
    email:           '',
    phone:           '',
    password:        '',
    confirm_pw:      '',
    contact1_name:   '',
    contact1_phone:  '',
    contact2_name:   '',
    contact2_phone:  '',
    language:        'en',
  });

  const set = k => e => { setForm(f => ({ ...f, [k]: e.target.value })); setError(''); };

  /* ── STEP 1 → validate + register ─────────────────── */
  const goStep2 = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim())               return setError('Full name is required.');
    if (!form.email.trim())                   return setError('Email is required.');
    if (!form.phone.trim())                   return setError('Phone number is required.');
    if (form.password.length < 8)             return setError('Password must be at least 8 characters.');
    if (!/[A-Z]/.test(form.password))         return setError('Password needs at least one uppercase letter.');
    if (!/\d/.test(form.password))            return setError('Password needs at least one number.');
    if (form.password !== form.confirm_pw)    return setError('Passwords do not match.');

    setLoading(true);
    setError('');

    try {
      // ── 1a. Create Supabase auth user ──────────────
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email:    form.email.trim().toLowerCase(),
        password: form.password,
        options:  { data: { full_name: form.full_name.trim() } },
      });

      if (signUpError) {
        // Handle "already registered" gracefully — offer sign-in
        if (signUpError.message?.toLowerCase().includes('already registered')) {
          setError('This email is already registered. Please sign in instead.');
        } else {
          setError(signUpError.message);
        }
        setLoading(false);
        return;
      }

      const token = signUpData?.session?.access_token;
      if (!token) {
        // Email confirmation required — tell user
        setError('A confirmation email has been sent. Please verify your email, then sign in.');
        setLoading(false);
        return;
      }

      // ── 1b. Create users row via backend (NO re-signUp) ──
      // Backend register endpoint must NOT call supabase.auth.signUp again.
      // We send skip_auth_signup: true so the backend only does DB inserts.
      await axios.post(
        `${NODE_API}/api/auth/register`,
        {
          fullName:           form.full_name.trim(),
          email:              form.email.trim().toLowerCase(),
          phone:              form.phone.trim(),
          preferred_language: form.language,
          skip_auth_signup:   true,  // ← tells backend to skip signUp, only insert rows
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Store token for Step 2
      setSessionToken(token);
      setStep(2);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Registration failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  /* ── STEP 2 → save contacts only (NO register/signUp) */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agreed)                                      return setError('Please agree to the terms to continue.');
    if (!form.contact1_name.trim() || !form.contact1_phone.trim())
                                                      return setError('At least one emergency contact is required.');
    if (!sessionToken)                                return setError('Session expired. Please go back to Step 1.');

    setLoading(true);
    setError('');

    const headers = {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    };

    try {
      // Primary contact
      await axios.post(
        `${NODE_API}/api/emergency-contacts`,
        {
          contactName:  form.contact1_name.trim(),
          phoneNumber:  form.contact1_phone.trim(),
          relationship: 'Emergency Contact',
          priority:     1,
        },
        { headers }
      );

      // Secondary contact (optional)
      if (form.contact2_name.trim() && form.contact2_phone.trim()) {
        await axios.post(
          `${NODE_API}/api/emergency-contacts`,
          {
            contactName:  form.contact2_name.trim(),
            phoneNumber:  form.contact2_phone.trim(),
            relationship: 'Emergency Contact',
            priority:     2,
          },
          { headers }
        );
      }

      navigate('/dashboard');
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to save contacts. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  /* ── Brand panel (shared) ───────────────────────── */
  const BrandPanel = () => (
    <div className="auth-brand">
      <div className="auth-logo">
        <div className="auth-logo-shield">{Ico.shield}</div>
        <span className="auth-logo-text">SafeGuard</span>
      </div>
      <div className="auth-hero">
        <div className="auth-hero-tag"><span />Free to join</div>
        <h1>Set up your<em>safety profile.</em></h1>
        <p>Two quick steps — your account details, then your emergency contacts. We'll take care of the rest when it matters most.</p>
        <div className="auth-stats">
          <div className="auth-stat"><span className="auth-stat-num">2</span><span className="auth-stat-label">Quick Steps</span></div>
          <div className="auth-stat"><span className="auth-stat-num">2min</span><span className="auth-stat-label">To Set Up</span></div>
          <div className="auth-stat"><span className="auth-stat-num">Free</span><span className="auth-stat-label">Always</span></div>
        </div>
      </div>
      <div className="auth-features">
        {[
          { icon: '📱', title: 'Emergency Contacts',  desc: 'Notified instantly when you trigger SOS' },
          { icon: '🗺️', title: 'Live Location Share', desc: 'Contacts see exactly where you are'       },
          { icon: '🌐', title: '10 Indian Languages', desc: 'AI responds in your native language'       },
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
  );

  const STEPS = [{ n: 1, label: 'Account' }, { n: 2, label: 'Contacts' }];

  return (
    <div className="auth-page">
      <BrandPanel />

      <div className="auth-form-panel">
        <div className="auth-form-box">

          {/* Step dots */}
          <div className="auth-steps">
            {STEPS.map((s, i) => (
              <React.Fragment key={s.n}>
                <div className="auth-step">
                  <div className={`auth-step-dot ${step > s.n ? 'done' : step === s.n ? 'active' : ''}`}>
                    {step > s.n ? Ico.check : s.n}
                  </div>
                  <span className={`auth-step-label ${step === s.n ? 'active' : ''}`}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && <div className="auth-step-line" />}
              </React.Fragment>
            ))}
          </div>

          {/* ────── STEP 1 ────── */}
          {step === 1 && (
            <>
              <div className="auth-form-header">
                <p className="auth-form-eyebrow">Step 1 of 2</p>
                <h2 className="auth-form-title">Create your account</h2>
                <p className="auth-form-subtitle">Your details are encrypted and never shared without consent.</p>
              </div>

              <form className="auth-form" onSubmit={goStep2} noValidate>
                {error && (
                  <div className="auth-alert" role="alert">
                    {Ico.alert}<span>{error}</span>
                  </div>
                )}

                {/* Name + Language */}
                <div className="auth-row-2">
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="full_name">Full name</label>
                    <div className="auth-input-wrap">
                      <span className="auth-input-icon">{Ico.user}</span>
                      <input id="full_name" type="text" className="auth-input" placeholder="Priya Sharma"
                        value={form.full_name} onChange={set('full_name')} autoComplete="name" disabled={loading} />
                    </div>
                  </div>
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="language">Language</label>
                    <div className="auth-input-wrap">
                      <span className="auth-input-icon" style={{ fontSize: '1rem' }}>🌐</span>
                      <select id="language" className="auth-input" value={form.language} onChange={set('language')}
                        style={{ paddingLeft: '42px', cursor: 'pointer' }} disabled={loading}>
                        <option value="en">English</option>
                        <option value="hi">हिंदी</option>
                        <option value="ta">தமிழ்</option>
                        <option value="te">తెలుగు</option>
                        <option value="mr">मराठी</option>
                        <option value="bn">বাংলা</option>
                        <option value="gu">ગુજરાતી</option>
                        <option value="kn">ಕನ್ನಡ</option>
                        <option value="ml">മലയാളം</option>
                        <option value="pa">ਪੰਜਾਬੀ</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div className="auth-field">
                  <label className="auth-label" htmlFor="reg_email">Email address</label>
                  <div className="auth-input-wrap">
                    <span className="auth-input-icon">{Ico.mail}</span>
                    <input id="reg_email" type="email" className="auth-input" placeholder="priya@example.com"
                      value={form.email} onChange={set('email')} autoComplete="email" inputMode="email" disabled={loading} />
                  </div>
                </div>

                {/* Phone */}
                <div className="auth-field">
                  <label className="auth-label" htmlFor="reg_phone">Mobile number</label>
                  <div className="auth-input-wrap">
                    <span className="auth-input-icon">{Ico.phone}</span>
                    <input id="reg_phone" type="tel" className="auth-input" placeholder="+91 98765 43210"
                      value={form.phone} onChange={set('phone')} autoComplete="tel" inputMode="tel" disabled={loading} />
                  </div>
                </div>

                {/* Password */}
                <div className="auth-field">
                  <label className="auth-label" htmlFor="reg_pw">Password</label>
                  <div className="auth-input-wrap">
                    <span className="auth-input-icon">{Ico.lock}</span>
                    <input id="reg_pw" type={showPw ? 'text' : 'password'} className="auth-input"
                      placeholder="Min 8 chars, 1 uppercase, 1 number" value={form.password}
                      onChange={set('password')} autoComplete="new-password" disabled={loading} />
                    <button type="button" className="auth-pw-toggle" tabIndex={-1}
                      onClick={() => setShowPw(v => !v)} aria-label="Toggle password">
                      {showPw ? Ico.eyeOff : Ico.eye}
                    </button>
                  </div>
                  <PwStrength pw={form.password} />
                </div>

                {/* Confirm Password */}
                <div className="auth-field">
                  <label className="auth-label" htmlFor="reg_cpw">Confirm password</label>
                  <div className="auth-input-wrap">
                    <span className="auth-input-icon">{Ico.lock}</span>
                    <input id="reg_cpw" type={showCpw ? 'text' : 'password'} className="auth-input"
                      placeholder="Re-enter password" value={form.confirm_pw}
                      onChange={set('confirm_pw')} autoComplete="new-password" disabled={loading} />
                    <button type="button" className="auth-pw-toggle" tabIndex={-1}
                      onClick={() => setShowCpw(v => !v)} aria-label="Toggle confirm">
                      {showCpw ? Ico.eyeOff : Ico.eye}
                    </button>
                  </div>
                  {form.confirm_pw && form.password !== form.confirm_pw && (
                    <span className="auth-field-error">{Ico.alert} Passwords don't match</span>
                  )}
                </div>

                <button type="submit" className="auth-submit" disabled={loading}>
                  {loading ? <><span className="auth-spinner" />Creating account…</> : <>Continue to Contacts {Ico.arrow}</>}
                </button>
              </form>
            </>
          )}

          {/* ────── STEP 2 ────── */}
          {step === 2 && (
            <>
              <div className="auth-form-header">
                <p className="auth-form-eyebrow">Step 2 of 2</p>
                <h2 className="auth-form-title">Add emergency contacts</h2>
                <p className="auth-form-subtitle">These people will be alerted the moment you trigger SOS.</p>
              </div>

              <form className="auth-form" onSubmit={handleSubmit} noValidate>
                {error && (
                  <div className="auth-alert" role="alert">
                    {Ico.alert}<span>{error}</span>
                  </div>
                )}

                {/* Primary contact */}
                <div className="auth-section-label"><span>Primary contact</span></div>
                <div className="auth-row-2">
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="c1name">Full name</label>
                    <div className="auth-input-wrap">
                      <span className="auth-input-icon" style={{ fontSize: '0.95rem' }}>👤</span>
                      <input id="c1name" type="text" className="auth-input" placeholder="e.g. Mom"
                        value={form.contact1_name} onChange={set('contact1_name')} disabled={loading} />
                    </div>
                  </div>
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="c1phone">Phone number</label>
                    <div className="auth-input-wrap">
                      <span className="auth-input-icon">{Ico.phone}</span>
                      <input id="c1phone" type="tel" className="auth-input" placeholder="+91 ..."
                        value={form.contact1_phone} onChange={set('contact1_phone')} inputMode="tel" disabled={loading} />
                    </div>
                  </div>
                </div>

                {/* Secondary contact */}
                <div className="auth-section-label">
                  <span>Secondary contact <span style={{ color: 'var(--text-dim)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></span>
                </div>
                <div className="auth-row-2">
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="c2name">Full name</label>
                    <div className="auth-input-wrap">
                      <span className="auth-input-icon" style={{ fontSize: '0.95rem' }}>👤</span>
                      <input id="c2name" type="text" className="auth-input" placeholder="e.g. Friend"
                        value={form.contact2_name} onChange={set('contact2_name')} disabled={loading} />
                    </div>
                  </div>
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="c2phone">Phone number</label>
                    <div className="auth-input-wrap">
                      <span className="auth-input-icon">{Ico.phone}</span>
                      <input id="c2phone" type="tel" className="auth-input" placeholder="+91 ..."
                        value={form.contact2_phone} onChange={set('contact2_phone')} inputMode="tel" disabled={loading} />
                    </div>
                  </div>
                </div>

                {/* Terms */}
                <label className="auth-check-row">
                  <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
                  <span>
                    I agree to the <a href="#terms" onClick={e => e.preventDefault()}>Terms of Service</a>{' '}
                    and <a href="#privacy" onClick={e => e.preventDefault()}>Privacy Policy</a>.
                    My emergency contacts will receive alerts when I trigger SOS.
                  </span>
                </label>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => { setStep(1); setError(''); }}
                    style={{
                      padding: '13px 18px', background: 'var(--ink-3)',
                      border: '1.5px solid var(--border)', borderRadius: 10,
                      color: 'var(--text)', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', gap: 8, fontFamily: 'inherit',
                      fontSize: '0.88rem', flexShrink: 0, transition: 'border-color 0.2s',
                    }}
                  >
                    {Ico.back} Back
                  </button>
                  <button type="submit" className="auth-submit" disabled={loading} style={{ flex: 1 }}>
                    {loading ? <><span className="auth-spinner" />Saving…</> : <>Create Account {Ico.arrow}</>}
                  </button>
                </div>
              </form>
            </>
          )}

          <div className="auth-switch" style={{ marginTop: '20px' }}>
            Already have an account? <Link to="/login">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}