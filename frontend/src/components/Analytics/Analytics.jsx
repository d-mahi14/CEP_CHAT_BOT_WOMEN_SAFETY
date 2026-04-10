// =====================================================
// Analytics.jsx — Module 30: Analytics & Reports
// Shows app usage, emergency trends, response times
// Missing from codebase — listed in PDF modules
// =====================================================

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getCurrentSession } from '../../services/supabaseClient';

const NODE_API = process.env.REACT_APP_NODE_API_URL || 'http://localhost:5000';

const getHeaders = async () => {
  const session = await getCurrentSession();
  return { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' };
};

const COLORS = {
  emergency:     '#ef4444', harassment: '#f97316', mental_health: '#8b5cf6',
  legal_help:    '#3b82f6', information: '#06b6d4', other:        '#64748b',
  fear:          '#f59e0b', panic:       '#ef4444', distress:     '#f97316',
  anger:         '#dc2626', sadness:     '#6b7280', calm:         '#10b981', neutral: '#64748b',
  manual:        '#3b82f6', voice:       '#8b5cf6', panic_type:   '#ef4444', auto:    '#f97316',
};

const StatCard = ({ label, value, sub, color = '#E63946' }) => (
  <div style={{
    padding: '14px 16px', background: '#131929',
    border: '1px solid rgba(255,255,255,.07)', borderRadius: 12,
    borderTop: `3px solid ${color}`,
  }}>
    <div style={{ fontSize: '.72rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fff', fontFamily: 'Syne,sans-serif', lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: '.72rem', color: '#64748b', marginTop: 4 }}>{sub}</div>}
  </div>
);

const MiniBarChart = ({ data, title, colorMap }) => {
  const entries = Object.entries(data || {}).filter(([, v]) => v > 0);
  if (!entries.length) return <div style={{ color: '#64748b', fontSize: '.83rem', padding: '12px 0' }}>No data yet</div>;
  const max = Math.max(...entries.map(([, v]) => v));
  return (
    <div>
      {title && <div style={{ fontSize: '.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>{title}</div>}
      {entries.map(([key, val]) => (
        <div key={key} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: '.78rem', color: '#CBD5E4', textTransform: 'capitalize' }}>{key.replace('_', ' ')}</span>
            <span style={{ fontSize: '.78rem', color: '#64748b' }}>{val}</span>
          </div>
          <div style={{ height: 5, background: 'rgba(255,255,255,.05)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 3,
              width: `${(val / max) * 100}%`,
              background: colorMap?.[key] || '#E63946',
              transition: 'width .5s ease',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
};

const TrendLine = ({ data }) => {
  const entries = Object.entries(data || {});
  if (!entries.length) return null;
  const max = Math.max(...entries.map(([, v]) => v), 1);
  const W = 360, H = 80, pad = 20;
  const pts = entries.map(([, v], i) => {
    const x = pad + (i / Math.max(entries.length - 1, 1)) * (W - pad * 2);
    const y = H - pad - (v / max) * (H - pad * 2);
    return [x, y];
  });
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');

  return (
    <div>
      <div style={{ fontSize: '.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>Monthly SOS Trend</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
        <path d={pathD} fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3" fill="#E63946" />
        ))}
        {entries.map(([label], i) => (
          <text key={i} x={pts[i][0]} y={H - 4} textAnchor="middle" fontSize="9" fill="#64748b">{label}</text>
        ))}
      </svg>
    </div>
  );
};

const Analytics = () => {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    (async () => {
      try {
        const h = await getHeaders();
        const r = await axios.get(`${NODE_API}/api/legal/analytics`, { headers: h });
        setData(r.data?.data);
      } catch {
        setError('Could not load analytics. Make sure the backend is running.');
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b', fontFamily: 'DM Sans,sans-serif' }}>
      <div style={{ width: 28, height: 28, border: '3px solid rgba(255,255,255,.1)', borderTopColor: '#E63946', borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto 12px', display: 'inline-block' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <p style={{ margin: 0 }}>Loading analytics…</p>
    </div>
  );

  if (error) return (
    <div style={{ padding: 20, color: '#FF6B74', background: 'rgba(230,57,70,.1)', border: '1px solid rgba(230,57,70,.3)', borderRadius: 10, fontFamily: 'DM Sans,sans-serif' }}>
      {error}
    </div>
  );

  if (!data) return null;

  const { sos_stats, emergency_types, trigger_types, chat_intents, emotions, monthly_trend,
          contacts_count, chat_total, emergency_chats, languages_used } = data;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', fontFamily: 'DM Sans,sans-serif' }}>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10, marginBottom: 20 }}>
        <StatCard label="Total SOS" value={sos_stats.total} sub="incidents triggered" color="#ef4444" />
        <StatCard label="Resolved" value={sos_stats.resolved} sub="safely closed" color="#10b981" />
        <StatCard label="AI Chats" value={chat_total} sub={`${emergency_chats} emergencies`} color="#8b5cf6" />
        <StatCard label="Avg Risk" value={`${sos_stats.avg_risk}/10`} sub="across all SOS" color="#f97316" />
        <StatCard label="Contacts" value={contacts_count} sub="emergency contacts" color="#3b82f6" />
        <StatCard label="Panic Alerts" value={sos_stats.panic_mode} sub="high-risk triggers" color="#dc2626" />
      </div>

      {/* Trend line */}
      <div style={{ background: '#131929', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: 18, marginBottom: 16 }}>
        <TrendLine data={monthly_trend} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        {/* Emergency Types */}
        <div style={{ background: '#131929', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: 18 }}>
          <MiniBarChart data={emergency_types} title="Emergency Types" colorMap={{
            violence: '#ef4444', medical: '#f97316', fire: '#f59e0b',
            harassment: '#8b5cf6', accident: '#3b82f6', mental_health: '#06b6d4', other: '#64748b',
          }} />
        </div>

        {/* Trigger Types */}
        <div style={{ background: '#131929', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: 18 }}>
          <MiniBarChart data={trigger_types} title="How SOS Was Triggered" colorMap={{
            manual: '#3b82f6', voice: '#8b5cf6', panic: '#ef4444', auto: '#f97316',
          }} />
        </div>

        {/* Chat Intents */}
        <div style={{ background: '#131929', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: 18 }}>
          <MiniBarChart data={chat_intents} title="AI Chat Topics" colorMap={COLORS} />
        </div>

        {/* Emotions */}
        <div style={{ background: '#131929', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: 18 }}>
          <MiniBarChart data={emotions} title="Emotions Detected" colorMap={COLORS} />
        </div>
      </div>

      {/* Status breakdown */}
      <div style={{ background: '#131929', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: 18, marginBottom: 14 }}>
        <div style={{ fontSize: '.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>SOS Status Breakdown</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Resolved', val: sos_stats.resolved,    color: '#10b981' },
            { label: 'False Alarm', val: sos_stats.false_alarm, color: '#f59e0b' },
            { label: 'Cancelled', val: sos_stats.cancelled,   color: '#64748b' },
            { label: 'Panic Mode', val: sos_stats.panic_mode,  color: '#ef4444' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.82rem', color: '#CBD5E4' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <span>{s.label}: <strong style={{ color: '#fff' }}>{s.val}</strong></span>
            </div>
          ))}
        </div>
      </div>

      {/* Languages used */}
      {languages_used?.length > 0 && (
        <div style={{ background: '#131929', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: '.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>Languages Used in AI Chats</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {languages_used.map(l => (
              <span key={l} style={{
                padding: '4px 12px', background: 'rgba(99,102,241,.12)',
                border: '1px solid rgba(99,102,241,.3)', borderRadius: 20,
                fontSize: '.78rem', color: '#a5b4fc',
              }}>{l.toUpperCase()}</span>
            ))}
          </div>
        </div>
      )}

      {sos_stats.total === 0 && chat_total === 0 && (
        <div style={{ textAlign: 'center', padding: '30px 20px', color: '#64748b', marginTop: 20 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>📊</div>
          <p style={{ margin: 0 }}>No activity yet. Analytics will appear as you use the app.</p>
        </div>
      )}
    </div>
  );
};

export default Analytics;