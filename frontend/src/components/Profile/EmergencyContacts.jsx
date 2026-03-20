// =====================================================
// EmergencyContacts.jsx — REDESIGNED
// Dark theme · works inside Dashboard.css overrides
// =====================================================

import React, { useState, useEffect } from 'react';
import { emergencyAPI } from '../../services/api';

const RELATIONSHIPS = [
  'Mother', 'Father', 'Sister', 'Brother', 'Spouse',
  'Partner', 'Friend', 'Colleague', 'Neighbour', 'Other',
];

const EmergencyContacts = () => {
  const [contacts,  setContacts]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(null);
  const [error,     setError]     = useState('');
  const [formData,  setFormData]  = useState({
    contactName: '', phoneNumber: '', relationship: '', email: '', notes: '',
  });

  useEffect(() => { loadContacts(); }, []);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const response = await emergencyAPI.getContacts();
      if (response.success) setContacts(response.data.contacts);
    } catch (err) {
      setError('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.contactName.trim() || !formData.phoneNumber.trim() || !formData.relationship) {
      setError('Name, phone, and relationship are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await emergencyAPI.addContact(formData);
      setFormData({ contactName: '', phoneNumber: '', relationship: '', email: '', notes: '' });
      setShowForm(false);
      loadContacts();
    } catch (err) {
      setError('Failed to add contact. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this emergency contact?')) return;
    setDeleting(id);
    try {
      await emergencyAPI.deleteContact(id);
      loadContacts();
    } catch {
      setError('Failed to delete contact.');
    } finally {
      setDeleting(null);
    }
  };

  const set = (k) => (e) => {
    setFormData(f => ({ ...f, [k]: e.target.value }));
    if (error) setError('');
  };

  if (loading) return <div className="ec-loading">Loading contacts…</div>;

  return (
    <div className="ec-container">
      <div className="ec-header">
        <div>
          <h3 className="ec-title">Emergency Contacts</h3>
          <p className="ec-subtitle">
            {contacts.length} contact{contacts.length !== 1 ? 's' : ''} · Notified when you trigger SOS
          </p>
        </div>
        <button
          className={`ec-add-btn ${showForm ? 'cancel' : ''}`}
          onClick={() => { setShowForm(s => !s); setError(''); }}
        >
          {showForm ? '✕ Cancel' : '+ Add Contact'}
        </button>
      </div>

      {error && <div className="ec-error">{error}</div>}

      {/* Add form */}
      {showForm && (
        <form className="ec-form" onSubmit={handleSubmit} noValidate>
          <div className="ec-form-grid">
            <div className="ec-field">
              <label className="ec-label">Full Name *</label>
              <input
                className="ec-input"
                type="text"
                placeholder="e.g. Priya's Mom"
                value={formData.contactName}
                onChange={set('contactName')}
              />
            </div>
            <div className="ec-field">
              <label className="ec-label">Phone Number *</label>
              <input
                className="ec-input"
                type="tel"
                placeholder="+91 98765 43210"
                value={formData.phoneNumber}
                onChange={set('phoneNumber')}
                inputMode="tel"
              />
            </div>
            <div className="ec-field">
              <label className="ec-label">Relationship *</label>
              <select className="ec-input" value={formData.relationship} onChange={set('relationship')}>
                <option value="">Select…</option>
                {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="ec-field">
              <label className="ec-label">Email (optional)</label>
              <input
                className="ec-input"
                type="email"
                placeholder="contact@email.com"
                value={formData.email}
                onChange={set('email')}
              />
            </div>
          </div>
          <div className="ec-field">
            <label className="ec-label">Notes (optional)</label>
            <textarea
              className="ec-input ec-textarea"
              placeholder="Any additional info…"
              value={formData.notes}
              onChange={set('notes')}
              rows={2}
            />
          </div>
          <div className="ec-form-actions">
            <button type="submit" className="ec-save-btn" disabled={saving}>
              {saving ? <><span className="ec-spinner" /> Saving…</> : '✓ Save Contact'}
            </button>
          </div>
        </form>
      )}

      {/* Contacts list */}
      <div className="ec-list">
        {contacts.length === 0 ? (
          <div className="ec-empty">
            <span>📞</span>
            <p>No emergency contacts yet.</p>
            <p className="ec-empty-sub">Add contacts so they're notified when you trigger SOS.</p>
            {!showForm && (
              <button className="ec-add-btn" onClick={() => setShowForm(true)}>
                + Add Your First Contact
              </button>
            )}
          </div>
        ) : (
          contacts.map((contact, index) => (
            <div key={contact.id} className="ec-card">
              <div className="ec-priority-badge">#{index + 1}</div>
              <div className="ec-card-info">
                <h4 className="ec-card-name">{contact.contactName}</h4>
                <a href={`tel:${contact.phoneNumber}`} className="ec-card-phone">
                  📞 {contact.phoneNumber}
                </a>
                <span className="ec-card-rel">{contact.relationship}</span>
                {contact.email && (
                  <span className="ec-card-email">✉️ {contact.email}</span>
                )}
              </div>
              <div className="ec-card-actions">
                <a href={`tel:${contact.phoneNumber}`} className="ec-call-btn" title="Call now">
                  📞
                </a>
                <button
                  className="ec-delete-btn"
                  onClick={() => handleDelete(contact.id)}
                  disabled={deleting === contact.id}
                  title="Remove contact"
                >
                  {deleting === contact.id ? '…' : '🗑️'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        .ec-container { max-width: 700px; margin: 0 auto; font-family: 'DM Sans', sans-serif; }
        .ec-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; gap: 12px; flex-wrap: wrap; }
        .ec-title { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 1.2rem; color: #fff; margin: 0 0 4px 0; }
        .ec-subtitle { font-size: 0.82rem; color: #64748b; margin: 0; }
        .ec-add-btn { padding: 10px 18px; background: #E63946; border: none; border-radius: 8px; color: white; font-size: 0.88rem; font-weight: 600; cursor: pointer; transition: all 0.2s; white-space: nowrap; font-family: inherit; }
        .ec-add-btn:hover { background: #c8303c; transform: translateY(-1px); }
        .ec-add-btn.cancel { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); }
        .ec-add-btn.cancel:hover { background: rgba(255,255,255,0.15); transform: none; }
        .ec-error { padding: 10px 14px; background: rgba(230,57,70,0.12); border: 1px solid rgba(230,57,70,0.3); border-radius: 8px; color: #FF6B74; font-size: 0.83rem; margin-bottom: 14px; }
        .ec-form { background: #131929; border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 20px; margin-bottom: 20px; animation: form-in 0.3s ease; }
        @keyframes form-in { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
        .ec-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
        .ec-field { display: flex; flex-direction: column; gap: 6px; }
        .ec-label { font-size: 0.75rem; font-weight: 500; color: #CBD5E4; letter-spacing: 0.03em; }
        .ec-input { padding: 11px 14px; background: #1E2740; border: 1.5px solid rgba(255,255,255,0.07); border-radius: 8px; color: #fff; font-size: 0.9rem; font-family: inherit; transition: border-color 0.2s; outline: none; }
        .ec-input:focus { border-color: #E63946; }
        .ec-input::placeholder { color: #374151; }
        .ec-input option { background: #1E2740; color: #fff; }
        .ec-textarea { resize: vertical; min-height: 60px; }
        .ec-form-actions { display: flex; justify-content: flex-end; margin-top: 8px; }
        .ec-save-btn { display: flex; align-items: center; gap: 8px; padding: 11px 22px; background: #E63946; border: none; border-radius: 8px; color: white; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.2s; font-family: inherit; }
        .ec-save-btn:hover:not(:disabled) { background: #c8303c; }
        .ec-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .ec-spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .ec-list { display: flex; flex-direction: column; gap: 10px; }
        .ec-empty { text-align: center; padding: 50px 20px; color: #64748b; display: flex; flex-direction: column; align-items: center; gap: 8px; }
        .ec-empty span { font-size: 3rem; }
        .ec-empty p { margin: 0; }
        .ec-empty-sub { font-size: 0.82rem; }
        .ec-card { display: flex; align-items: center; gap: 14px; padding: 16px; background: #131929; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; transition: border-color 0.2s; }
        .ec-card:hover { border-color: rgba(255,255,255,0.12); }
        .ec-priority-badge { width: 36px; height: 36px; background: rgba(230,57,70,0.15); border: 1px solid rgba(230,57,70,0.3); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'Syne', sans-serif; font-weight: 700; font-size: 0.85rem; color: #FF6B74; flex-shrink: 0; }
        .ec-card-info { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .ec-card-name { font-weight: 600; font-size: 0.95rem; color: #fff; margin: 0; }
        .ec-card-phone { font-size: 0.85rem; color: #10B981; text-decoration: none; transition: color 0.2s; }
        .ec-card-phone:hover { color: #34d399; }
        .ec-card-rel { font-size: 0.75rem; color: #64748b; }
        .ec-card-email { font-size: 0.75rem; color: #64748b; }
        .ec-card-actions { display: flex; gap: 8px; flex-shrink: 0; }
        .ec-call-btn, .ec-delete-btn { width: 36px; height: 36px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.07); background: #1E2740; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; text-decoration: none; transition: all 0.2s; }
        .ec-call-btn:hover { background: rgba(16,185,129,0.15); border-color: rgba(16,185,129,0.3); }
        .ec-delete-btn:hover { background: rgba(230,57,70,0.15); border-color: rgba(230,57,70,0.3); }
        .ec-delete-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .ec-loading { padding: 40px; text-align: center; color: #64748b; }
        @media (max-width: 600px) { .ec-form-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
};

export default EmergencyContacts;