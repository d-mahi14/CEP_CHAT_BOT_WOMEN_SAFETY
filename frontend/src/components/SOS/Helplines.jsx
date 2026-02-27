// =====================================================
// Helplines Component — Module 13
// Shows helplines by category with click-to-call
// =====================================================

import React, { useState, useEffect } from 'react';
import { sosAPI } from '../../services/sosService';

const CATEGORIES = [
  { key: 'all',          label: 'All',           icon: '📋' },
  { key: 'police',       label: 'Police',         icon: '👮' },
  { key: 'medical',      label: 'Medical',        icon: '🏥' },
  { key: 'fire',         label: 'Fire',           icon: '🔥' },
  { key: 'women',        label: 'Women',          icon: '👩' },
  { key: 'child',        label: 'Child',          icon: '👶' },
  { key: 'mental_health',label: 'Mental Health',  icon: '🧠' },
  { key: 'legal',        label: 'Legal',          icon: '⚖️' },
];

const Helplines = () => {
  const [helplines, setHelplines] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    sosAPI.getHelplines()
      .then(res => {
        setHelplines(res.data.helplines || []);
        setFiltered(res.data.helplines || []);
      })
      .catch(() => setError('Failed to load helplines'))
      .finally(() => setLoading(false));
  }, []);

  const handleCategoryChange = (cat) => {
    setActiveCategory(cat);
    if (cat === 'all') {
      setFiltered(helplines);
    } else {
      setFiltered(helplines.filter(h => h.category === cat));
    }
  };

  if (loading) return <div className="helplines-loading">Loading helplines...</div>;
  if (error)   return <div className="helplines-error">{error}</div>;

  return (
    <div className="helplines-container">
      <h3 className="helplines-title">📞 Emergency Helplines</h3>
      <p className="helplines-subtitle">Tap any number to call immediately</p>

      {/* Category filter */}
      <div className="helplines-categories">
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            className={`cat-btn ${activeCategory === cat.key ? 'active' : ''}`}
            onClick={() => handleCategoryChange(cat.key)}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Helpline cards */}
      <div className="helplines-list">
        {filtered.length === 0 ? (
          <p className="no-helplines">No helplines found for this category.</p>
        ) : (
          filtered.map(h => (
            <div key={h.id} className={`helpline-card cat-${h.category}`}>
              <div className="helpline-left">
                <div className="helpline-icon">
                  {CATEGORIES.find(c => c.key === h.category)?.icon || '📞'}
                </div>
                <div>
                  <h4 className="helpline-name">{h.name}</h4>
                  {h.description && <p className="helpline-desc">{h.description}</p>}
                  <div className="helpline-meta">
                    {h.available_24x7
                      ? <span className="badge-24x7">24×7</span>
                      : <span className="badge-hours">{h.working_hours}</span>}
                    {h.state && <span className="badge-state">{h.state}</span>}
                  </div>
                </div>
              </div>
              <a
                href={`tel:${h.phone_number.replace(/\s/g, '')}`}
                className="helpline-call-btn"
                aria-label={`Call ${h.name} at ${h.phone_number}`}
              >
                <span className="call-icon">📞</span>
                <span className="call-number">{h.phone_number}</span>
              </a>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Helplines;