import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../../services/api';
import './Auth.css';

/* ── Icons ────────────────────────────────────────── */
const I = {
  user: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  mail: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  ),
  phone: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12 19.79 19.79 0 0 1 1.08 3.4 2 2 0 0 1 3.06 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16l.02.92z"/>
    </svg>
  ),
  lock: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  contact: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  eye: (off) => off ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  alert: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  arrow: (back) => back ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  ),
};

const ShieldSVG = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
  </svg>
);

/* ── Password strength ────────────────────────────── */
function getStrength(pw) {
  let score = 0;
  if (pw.length >= 8)              score++;
  if (/[A-Z]/.test(pw))            score++;
  if (/[0-9]/.test(pw))            score++;
  if (/[^A-Za-z0-9]/.test(pw))    score++;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const classes = ['', 'weak', 'fair', 'good', 'strong'];
  return { score, label: labels[score] || '', cls: classes[score] || '' };
}

function PwStrength({ pw }) {
  if (!pw) return null;
  const { score, label, cls } = getStrength(pw);
  return (
    <div className="auth-pw-strength">
      <div className="auth-pw-bars">
        {[1,2,3,4].map(i => (
          <div key={i} className={`auth-pw-bar${i <= score ? ' ' + cls : ''}`} />
        ))}
      </div>
      <span className={`auth-pw-label ${cls}`}>{label}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   REGISTER
   ═══════════════════════════════════════════════════ */
export default function Register() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1 = account, 2 = contacts
  const [showPw, setShowPw]     = useState(false);
  const [showCpw, setShowCpw]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [agreed, setAgreed]     = useState(false);

  const [form, setForm] = useState({
    full_name:      '',
    email:          '',
    phone:          '',
    password:       '',
    confirm_pw:     '',
    contact1_name:  '',
    contact1_phone: '',
    contact2_name:  '',
    contact2_phone: '',
    language:       'en',
  });

  const set = (k) => (e) => {
    setForm(f => ({ ...f, [k]: e.target.value }));
    if (error) setError('');
  };

  /* Step 1 → Step 2 validation */
  const goStep2 = (e) => {
    e.preventDefault();
    if (!form.full_name.trim())         { setError('Please enter your full name.'); return; }
    if (!form.email.trim())             { setError('Please enter your email.'); return; }
    if (!form.phone.trim())             { setError('Please enter your phone number.'); return; }
    if (form.password.length < 8)       { setError('Password must be at least 8 characters.'); return; }
    if (form.password !== form.confirm_pw) { setError('Passwords do not match.'); return; }
    setError('');
    setStep(2);
  };

  /* Final submit */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agreed) { setError('Please agree to the terms and conditions.'); return; }
    if (!form.contact1_name || !form.contact1_phone) {
      setError('Please add at least one emergency contact.'); return;
    }

    setLoading(true);
    setError('');
    try {
      const contacts = [
        { name: form.contact1_name, phone: form.contact1_phone, priority: 1 },
        ...(form.contact2_name && form.contact2_phone
          ? [{ name: form.contact2_name, phone: form.contact2_phone, priority: 2 }]
          : []),
      ];
      await authAPI.register({
        full_name:         form.full_name.trim(),
        email:             form.email.trim(),
        phone:             form.phone.trim(),
        password:          form.password,
        emergency_contacts: contacts,
        preferred_language: form.language,
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Registration failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const STEPS = [
    { n: 1, label: 'Account' },
    { n: 2, label: 'Contacts' },
  ];

  return (
    <div className="auth-page">

      {/* ── Left: Brand ──────────────────────────── */}
      <div className="auth-brand">
        <div className="auth-logo">
          <div className="auth-logo-shield"><ShieldSVG /></div>
          <span className="auth-logo-text">SafeGuard</span>
        </div>

        <div className="auth-hero">
          <div className="auth-hero-tag">
            <span />
            Free to join
          </div>
          <h1>
            Set up your
            <em>safety profile.</em>
          </h1>
          <p>
            Two quick steps — your account details, then your emergency contacts.
            We'll take care of the rest when it matters most.
          </p>

          <div className="auth-stats">
            <div className="auth-stat">
              <span className="auth-stat-num">2</span>
              <span className="auth-stat-label">Quick Steps</span>
            </div>
            <div className="auth-stat">
              <span className="auth-stat-num">2min</span>
              <span className="auth-stat-label">To Set Up</span>
            </div>
            <div className="auth-stat">
              <span className="auth-stat-num">Free</span>
              <span className="auth-stat-label">Always</span>
            </div>
          </div>
        </div>

        <div className="auth-features">
          {[
            { icon: '📱', title: 'Emergency Contacts',    desc: 'Notified instantly when you trigger SOS'    },
            { icon: '🗺️', title: 'Live Location Share',  desc: 'Contacts see exactly where you are'          },
            { icon: '🌐', title: '10 Indian Languages',   desc: 'AI responds in your native language'         },
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

      {/* ── Right: Form ──────────────────────────── */}
      <div className="auth-form-panel">
        <div className="auth-form-box">

          {/* Step indicator */}
          <div className="auth-steps">
            {STEPS.map((s, i) => (
              <React.Fragment key={s.n}>
                <div className="auth-step">
                  <div className={`auth-step-dot ${step > s.n ? 'done' : step === s.n ? 'active' : ''}`}>
                    {step > s.n ? <I.check /> : s.n}
                  </div>
                  <span className={`auth-step-label ${step === s.n ? 'active' : ''}`}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && <div className="auth-step-line" />}
              </React.Fragment>
            ))}
          </div>

          {/* Header */}
          <div className="auth-form-header">
            <p className="auth-form-eyebrow">{step === 1 ? 'Step 1 of 2' : 'Step 2 of 2'}</p>
            <h2 className="auth-form-title">
              {step === 1 ? 'Create your account' : 'Add emergency contacts'}
            </h2>
            <p className="auth-form-subtitle">
              {step === 1
                ? 'Your details are encrypted and never shared without consent.'
                : 'These people will be alerted the moment you trigger SOS.'}
            </p>
          </div>

          {/* ── STEP 1 ─────────────────────────────── */}
          {step === 1 && (
            <form className="auth-form" onSubmit={goStep2} noValidate>
              {error && (
                <div className="auth-alert" role="alert">
                  <I.alert /><span>{error}</span>
                </div>
              )}

              {/* Name + Language */}
              <div className="auth-row-2">
                <div className="auth-field">
                  <label className="auth-label" htmlFor="full_name">Full name</label>
                  <div className="auth-input-wrap">
                    <span className="auth-input-icon"><I.user /></span>
                    <input id="full_name" type="text" className="auth-input" placeholder="Priya Sharma"
                      value={form.full_name} onChange={set('full_name')} autoComplete="name" />
                  </div>
                </div>
                <div className="auth-field">
                  <label className="auth-label" htmlFor="language">Language</label>
                  <div className="auth-input-wrap">
                    <span className="auth-input-icon" style={{ fontSize: '1rem' }}>🌐</span>
                    <select id="language" className="auth-input" value={form.language} onChange={set('language')}
                      style={{ paddingLeft: '42px', cursor: 'pointer' }}>
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
                <label className="auth-label" htmlFor="email">Email address</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon"><I.mail /></span>
                  <input id="email" type="email" className="auth-input" placeholder="priya@example.com"
                    value={form.email} onChange={set('email')} autoComplete="email" inputMode="email" />
                </div>
              </div>

              {/* Phone */}
              <div className="auth-field">
                <label className="auth-label" htmlFor="phone">Mobile number</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon"><I.phone /></span>
                  <input id="phone" type="tel" className="auth-input" placeholder="+91 98765 43210"
                    value={form.phone} onChange={set('phone')} autoComplete="tel" inputMode="tel" />
                </div>
              </div>

              {/* Password */}
              <div className="auth-field">
                <label className="auth-label" htmlFor="password">Password</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon"><I.lock /></span>
                  <input id="password" type={showPw ? 'text' : 'password'} className="auth-input"
                    placeholder="Min. 8 characters" value={form.password} onChange={set('password')}
                    autoComplete="new-password" />
                  <button type="button" className="auth-pw-toggle" onClick={() => setShowPw(p => !p)}
                    tabIndex={-1} aria-label="Toggle password visibility">
                    <I.eye off={showPw} />
                  </button>
                </div>
                <PwStrength pw={form.password} />
              </div>

              {/* Confirm */}
              <div className="auth-field">
                <label className="auth-label" htmlFor="confirm_pw">Confirm password</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon"><I.lock /></span>
                  <input id="confirm_pw" type={showCpw ? 'text' : 'password'} className="auth-input"
                    placeholder="Re-enter password" value={form.confirm_pw} onChange={set('confirm_pw')}
                    autoComplete="new-password" />
                  <button type="button" className="auth-pw-toggle" onClick={() => setShowCpw(p => !p)}
                    tabIndex={-1} aria-label="Toggle confirm password visibility">
                    <I.eye off={showCpw} />
                  </button>
                </div>
                {form.confirm_pw && form.password !== form.confirm_pw && (
                  <span className="auth-field-error"><I.alert />Passwords don't match</span>
                )}
              </div>

              <button type="submit" className="auth-submit">
                Continue to Contacts <I.arrow />
              </button>
            </form>
          )}

          {/* ── STEP 2 ─────────────────────────────── */}
          {step === 2 && (
            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              {error && (
                <div className="auth-alert" role="alert">
                  <I.alert /><span>{error}</span>
                </div>
              )}

              {/* Contact 1 */}
              <div className="auth-section-label">
                <span>Primary contact</span>
              </div>

              <div className="auth-row-2">
                <div className="auth-field">
                  <label className="auth-label" htmlFor="c1name">Full name</label>
                  <div className="auth-input-wrap">
                    <span className="auth-input-icon"><I.contact /></span>
                    <input id="c1name" type="text" className="auth-input" placeholder="e.g. Mom"
                      value={form.contact1_name} onChange={set('contact1_name')} />
                  </div>
                </div>
                <div className="auth-field">
                  <label className="auth-label" htmlFor="c1phone">Phone number</label>
                  <div className="auth-input-wrap">
                    <span className="auth-input-icon"><I.phone /></span>
                    <input id="c1phone" type="tel" className="auth-input" placeholder="+91 ..."
                      value={form.contact1_phone} onChange={set('contact1_phone')} inputMode="tel" />
                  </div>
                </div>
              </div>

              {/* Contact 2 */}
              <div className="auth-section-label">
                <span>Secondary contact <span style={{ color: 'var(--text-dim)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></span>
              </div>

              <div className="auth-row-2">
                <div className="auth-field">
                  <label className="auth-label" htmlFor="c2name">Full name</label>
                  <div className="auth-input-wrap">
                    <span className="auth-input-icon"><I.contact /></span>
                    <input id="c2name" type="text" className="auth-input" placeholder="e.g. Friend"
                      value={form.contact2_name} onChange={set('contact2_name')} />
                  </div>
                </div>
                <div className="auth-field">
                  <label className="auth-label" htmlFor="c2phone">Phone number</label>
                  <div className="auth-input-wrap">
                    <span className="auth-input-icon"><I.phone /></span>
                    <input id="c2phone" type="tel" className="auth-input" placeholder="+91 ..."
                      value={form.contact2_phone} onChange={set('contact2_phone')} inputMode="tel" />
                  </div>
                </div>
              </div>

              {/* Terms */}
              <label className="auth-check-row">
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
                <span>
                  I agree to the{' '}
                  <a href="#terms" onClick={e => e.preventDefault()}>Terms of Service</a>
                  {' '}and{' '}
                  <a href="#privacy" onClick={e => e.preventDefault()}>Privacy Policy</a>.
                  My emergency contacts will receive alerts when I trigger SOS.
                </span>
              </label>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => { setStep(1); setError(''); }}
                  style={{
                    padding: '13px 18px',
                    background: 'var(--ink-3)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 10,
                    color: 'var(--text)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontFamily: 'inherit',
                    fontSize: '0.88rem',
                    flexShrink: 0,
                    transition: 'border-color 0.2s',
                  }}
                >
                  <I.arrow back /> Back
                </button>

                <button type="submit" className="auth-submit" disabled={loading} style={{ flex: 1 }}>
                  {loading ? (
                    <><span className="auth-spinner" />Creating account…</>
                  ) : (
                    <>Create Account <I.arrow /></>
                  )}
                </button>
              </div>
            </form>
          )}

          <div className="auth-switch" style={{ marginTop: '20px' }}>
            Already have an account?{' '}
            <Link to="/login">Sign in</Link>
          </div>

        </div>
      </div>
    </div>
  );
}