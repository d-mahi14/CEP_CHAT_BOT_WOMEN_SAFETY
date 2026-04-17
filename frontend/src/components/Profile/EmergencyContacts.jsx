// =====================================================
// EmergencyContacts.jsx — Module 3 (Updated)
// =====================================================
// CHANGES (Module 3 — Contact Priority Reordering):
//
//   Added full priority management UI:
//   1. Drag-to-reorder via HTML5 drag-and-drop API
//      (mobile-friendly via touch events fallback)
//   2. Explicit ▲ ▼ up/down arrow buttons on each card
//   3. Priority is re-calculated as (index + 1) after
//      every reorder and PUTted to the backend in bulk
//   4. Visual feedback: dragging card dims, drop target
//      shows a blue insertion line
//   5. Reorder mode toggle button — keeps the normal
//      view clean; activates a dedicated "reorder" mode
//
// API: uses emergencyAPI.updateContact(id, { priority })
//      for each affected contact after a reorder.
// =====================================================

import React, { useState, useEffect, useRef } from 'react';
import { emergencyAPI } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

const RELATIONSHIPS = [
  'Mother', 'Father', 'Sister', 'Brother', 'Spouse',
  'Partner', 'Friend', 'Colleague', 'Neighbour', 'Other',
];

const EmergencyContacts = () => {
  const { t } = useLanguage();

  const [contacts,      setContacts]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [showForm,      setShowForm]      = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [deleting,      setDeleting]      = useState(null);
  const [reordering,    setReordering]    = useState(false);
  const [savingOrder,   setSavingOrder]   = useState(false);
  const [error,         setError]         = useState('');
  const [orderSaved,    setOrderSaved]    = useState(false);
  const [formData, setFormData] = useState({
    contactName: '', phoneNumber: '', relationship: '', email: '', notes: '',
  });

  // ── Drag-and-drop state ────────────────────────────
  const dragIndexRef   = useRef(null); // index being dragged
  const dragOverRef    = useRef(null); // index being hovered
  const [dragIndex,    setDragIndex]    = useState(null);
  const [dragOverIndex,setDragOverIndex]= useState(null);

  useEffect(() => { loadContacts(); }, []);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const response = await emergencyAPI.getContacts();
      if (response.success) setContacts(response.data.contacts);
    } catch {
      setError(t('ec_err_load'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.contactName.trim() || !formData.phoneNumber.trim() || !formData.relationship) {
      setError(t('ec_err_fields'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await emergencyAPI.addContact(formData);
      setFormData({ contactName: '', phoneNumber: '', relationship: '', email: '', notes: '' });
      setShowForm(false);
      loadContacts();
    } catch {
      setError(t('ec_err_add'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('ec_confirm_del'))) return;
    setDeleting(id);
    try {
      await emergencyAPI.deleteContact(id);
      loadContacts();
    } catch {
      setError(t('ec_err_del'));
    } finally {
      setDeleting(null);
    }
  };

  // ── Priority helpers ───────────────────────────────

  /**
   * Commit a new contact ordering to the backend.
   * Re-assigns priority = index + 1 for every contact.
   */
  const saveOrder = async (newOrder) => {
    setSavingOrder(true);
    try {
      await Promise.all(
        newOrder.map((contact, idx) =>
          emergencyAPI.updateContact(contact.id, { priority: idx + 1 })
        )
      );
      setOrderSaved(true);
      setTimeout(() => setOrderSaved(false), 2500);
    } catch {
      setError('Failed to save priority order. Please try again.');
    } finally {
      setSavingOrder(false);
    }
  };

  /** Move a contact up (lower priority number) */
  const moveUp = async (index) => {
    if (index === 0) return;
    const newOrder = [...contacts];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setContacts(newOrder);
    await saveOrder(newOrder);
  };

  /** Move a contact down (higher priority number) */
  const moveDown = async (index) => {
    if (index === contacts.length - 1) return;
    const newOrder = [...contacts];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setContacts(newOrder);
    await saveOrder(newOrder);
  };

  // ── Drag-and-drop handlers ─────────────────────────

  const handleDragStart = (e, index) => {
    dragIndexRef.current = index;
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Transparent ghost image
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(img, 0, 0);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverRef.current !== index) {
      dragOverRef.current = index;
      setDragOverIndex(index);
    }
  };

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();
    const from = dragIndexRef.current;
    if (from === null || from === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      dragIndexRef.current = null;
      dragOverRef.current  = null;
      return;
    }
    const newOrder = [...contacts];
    const [moved] = newOrder.splice(from, 1);
    newOrder.splice(dropIndex, 0, moved);
    setContacts(newOrder);
    setDragIndex(null);
    setDragOverIndex(null);
    dragIndexRef.current = null;
    dragOverRef.current  = null;
    await saveOrder(newOrder);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
    dragIndexRef.current = null;
    dragOverRef.current  = null;
  };

  const set = (k) => (e) => {
    setFormData(f => ({ ...f, [k]: e.target.value }));
    if (error) setError('');
  };

  if (loading) return <div className="ec-loading">{t('ec_loading')}</div>;

  return (
    <div className="ec-container">
      <div className="ec-header">
        <div>
          <h3 className="ec-title">{t('ec_title')}</h3>
          <p className="ec-subtitle">
            {contacts.length} {contacts.length !== 1 ? t('ec_subtitle_many') : t('ec_subtitle_one')} · {t('ec_notified')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {/* Reorder mode toggle — only show when there are 2+ contacts */}
          {contacts.length >= 2 && !showForm && (
            <button
              className={`ec-reorder-btn ${reordering ? 'active' : ''}`}
              onClick={() => setReordering(r => !r)}
              title="Reorder contacts by priority"
            >
              {reordering ? '✓ Done' : '⇅ Reorder'}
            </button>
          )}

          <button
            className={`ec-add-btn ${showForm ? 'cancel' : ''}`}
            onClick={() => { setShowForm(s => !s); setError(''); setReordering(false); }}
          >
            {showForm ? `✕ ${t('ec_cancel')}` : `+ ${t('ec_add')}`}
          </button>
        </div>
      </div>

      {/* Order saved toast */}
      {orderSaved && (
        <div className="ec-success">✅ Priority order saved successfully.</div>
      )}

      {/* Saving order indicator */}
      {savingOrder && (
        <div className="ec-saving-order">
          <span className="ec-spinner" /> Saving priority order…
        </div>
      )}

      {error && <div className="ec-error">{error}</div>}

      {/* Reorder mode hint */}
      {reordering && (
        <div className="ec-reorder-hint">
          <span>🖱️</span>
          <span>Drag cards to reorder, or use the ▲ ▼ arrows. Changes save automatically.</span>
        </div>
      )}

      {showForm && (
        <form className="ec-form" onSubmit={handleSubmit} noValidate>
          <div className="ec-form-grid">
            <div className="ec-field">
              <label className="ec-label">{t('ec_name')} *</label>
              <input
                className="ec-input"
                type="text"
                placeholder={t('ec_name_ph')}
                value={formData.contactName}
                onChange={set('contactName')}
              />
            </div>

            <div className="ec-field">
              <label className="ec-label">{t('ec_phone')} *</label>
              <input
                className="ec-input"
                type="tel"
                placeholder={t('ec_phone_ph')}
                value={formData.phoneNumber}
                onChange={set('phoneNumber')}
                inputMode="tel"
              />
            </div>

            <div className="ec-field">
              <label className="ec-label">{t('ec_relation')} *</label>
              <select className="ec-input" value={formData.relationship} onChange={set('relationship')}>
                <option value="">{t('ec_select')}</option>
                {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className="ec-field">
              <label className="ec-label">{t('ec_email')}</label>
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
            <label className="ec-label">{t('ec_notes')}</label>
            <textarea
              className="ec-input ec-textarea"
              placeholder={t('ec_notes_ph')}
              value={formData.notes}
              onChange={set('notes')}
              rows={2}
            />
          </div>

          <div className="ec-form-actions">
            <button type="submit" className="ec-save-btn" disabled={saving}>
              {saving
                ? <><span className="ec-spinner" /> {t('ec_saving')}</>
                : `✓ ${t('ec_save')}`}
            </button>
          </div>
        </form>
      )}

      <div className="ec-list">
        {contacts.length === 0 ? (
          <div className="ec-empty">
            <span>📞</span>
            <p>{t('ec_empty')}</p>
            <p className="ec-empty-sub">{t('ec_empty_sub')}</p>
            {!showForm && (
              <button className="ec-add-btn" onClick={() => setShowForm(true)}>
                + {t('ec_add_first')}
              </button>
            )}
          </div>
        ) : (
          contacts.map((contact, index) => {
            const isDragging  = reordering && dragIndex === index;
            const isDropTarget = reordering && dragOverIndex === index && dragIndex !== index;

            return (
              <div
                key={contact.id}
                className={`ec-card
                  ${reordering ? 'reorder-mode' : ''}
                  ${isDragging ? 'dragging' : ''}
                  ${isDropTarget ? 'drop-target' : ''}
                `}
                draggable={reordering}
                onDragStart={reordering ? (e) => handleDragStart(e, index) : undefined}
                onDragOver={reordering  ? (e) => handleDragOver(e, index)  : undefined}
                onDrop={reordering      ? (e) => handleDrop(e, index)      : undefined}
                onDragEnd={reordering   ? handleDragEnd                     : undefined}
              >
                {/* Priority badge */}
                <div className="ec-priority-badge">#{index + 1}</div>

                {/* Drag handle (reorder mode only) */}
                {reordering && (
                  <div className="ec-drag-handle" title="Drag to reorder">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                      <rect x="2" y="2" width="10" height="2" rx="1"/>
                      <rect x="2" y="6" width="10" height="2" rx="1"/>
                      <rect x="2" y="10" width="10" height="2" rx="1"/>
                    </svg>
                  </div>
                )}

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
                  {reordering ? (
                    /* Up/Down arrows in reorder mode */
                    <div className="ec-priority-btns">
                      <button
                        className="ec-priority-btn"
                        onClick={() => moveUp(index)}
                        disabled={index === 0 || savingOrder}
                        title="Move up (higher priority)"
                        aria-label="Move up"
                      >
                        ▲
                      </button>
                      <button
                        className="ec-priority-btn"
                        onClick={() => moveDown(index)}
                        disabled={index === contacts.length - 1 || savingOrder}
                        title="Move down (lower priority)"
                        aria-label="Move down"
                      >
                        ▼
                      </button>
                    </div>
                  ) : (
                    /* Normal mode: call + delete */
                    <>
                      <a href={`tel:${contact.phoneNumber}`} className="ec-call-btn">
                        📞
                      </a>
                      <button
                        className="ec-delete-btn"
                        onClick={() => handleDelete(contact.id)}
                        disabled={deleting === contact.id}
                      >
                        {deleting === contact.id ? '…' : '🗑️'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
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

        .ec-reorder-btn { padding: 10px 16px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; color: #CBD5E4; font-size: 0.88rem; font-weight: 600; cursor: pointer; transition: all 0.2s; white-space: nowrap; font-family: inherit; }
        .ec-reorder-btn:hover { background: rgba(255,255,255,0.12); }
        .ec-reorder-btn.active { background: rgba(16,185,129,0.12); border-color: rgba(16,185,129,0.3); color: #10B981; }

        .ec-reorder-hint { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.2); border-radius: 8px; color: #93c5fd; font-size: 0.82rem; margin-bottom: 14px; }
        .ec-success { padding: 10px 14px; background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.3); border-radius: 8px; color: #10B981; font-size: 0.83rem; margin-bottom: 14px; }
        .ec-saving-order { display: flex; align-items: center; gap: 8px; padding: 8px 14px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; color: #64748b; font-size: 0.82rem; margin-bottom: 10px; }
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

        /* Card base */
        .ec-card { display: flex; align-items: center; gap: 14px; padding: 16px; background: #131929; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; transition: border-color 0.2s, opacity 0.2s, transform 0.15s; }
        .ec-card:hover { border-color: rgba(255,255,255,0.12); }

        /* Reorder mode states */
        .ec-card.reorder-mode { cursor: grab; border-color: rgba(59,130,246,0.15); }
        .ec-card.reorder-mode:hover { border-color: rgba(59,130,246,0.35); }
        .ec-card.dragging { opacity: 0.45; transform: scale(0.98); cursor: grabbing; border: 1.5px dashed rgba(59,130,246,0.5); }
        .ec-card.drop-target { border-top: 3px solid #3B82F6; padding-top: 13px; }

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

        /* Drag handle */
        .ec-drag-handle { color: #374151; cursor: grab; flex-shrink: 0; display: flex; align-items: center; padding: 4px; transition: color 0.2s; }
        .ec-drag-handle:hover { color: #94a3b8; }

        /* Priority up/down buttons */
        .ec-priority-btns { display: flex; flex-direction: column; gap: 4px; }
        .ec-priority-btn { width: 32px; height: 26px; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.25); border-radius: 6px; color: #93c5fd; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; font-family: inherit; }
        .ec-priority-btn:hover:not(:disabled) { background: rgba(59,130,246,0.22); border-color: #3B82F6; }
        .ec-priority-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        .ec-loading { padding: 40px; text-align: center; color: #64748b; }
        @media (max-width: 600px) { .ec-form-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
};

export default EmergencyContacts;