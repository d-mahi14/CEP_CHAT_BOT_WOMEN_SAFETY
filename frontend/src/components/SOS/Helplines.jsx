// =====================================================
// Helplines.jsx — FULL i18n FIXED VERSION
// =====================================================

import React, { useState, useEffect } from 'react';
import { sosAPI } from '../../services/sosService';
import { useLanguage } from '../../context/LanguageContext';

const Helplines = () => {
  const { t } = useLanguage();

  // ✅ Categories (translated)
  const CATEGORIES = [
    { key: 'all',           label: t('hl_all'),     icon: '📋' },
    { key: 'police',        label: t('hl_police'),  icon: '👮' },
    { key: 'medical',       label: t('hl_medical'), icon: '🏥' },
    { key: 'fire',          label: t('hl_fire'),    icon: '🔥' },
    { key: 'women',         label: t('hl_women'),   icon: '👩' },
    { key: 'child',         label: t('hl_child'),   icon: '👶' },
    { key: 'mental_health', label: t('hl_mental'),  icon: '🧠' },
    { key: 'legal',         label: t('hl_legal'),   icon: '⚖️' },
  ];

  // ✅ NEW: Category-based name translation (BEST WAY)
  const CATEGORY_NAME_MAP = {
    police: t('hl_police_emergency'),
    medical: t('hl_medical_emergency'),
    fire: t('hl_fire_emergency'),
    women: t('hl_women'),
    child: t('hl_child'),
    mental_health: t('hl_mental'),
    legal: t('hl_legal'),
  };

  const [helplines, setHelplines] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch helplines
  useEffect(() => {
    sosAPI.getHelplines()
      .then(res => {
        const data = res.data.helplines || [];
        setHelplines(data);
        setFiltered(data);
      })
      .catch(() => setError(t('hl_error')))
      .finally(() => setLoading(false));
  }, []);

  // Category filter
  const handleCategoryChange = (cat) => {
    setActiveCategory(cat);
    if (cat === 'all') {
      setFiltered(helplines);
    } else {
      setFiltered(helplines.filter(h => h.category === cat));
    }
  };

  if (loading) return <div className="helplines-loading">{t('hl_loading')}</div>;
  if (error)   return <div className="helplines-error">{error}</div>;

  return (
    <div className="helplines-container">

      {/* Title */}
      <h3 className="helplines-title">📞 {t('hl_title')}</h3>
      <p className="helplines-subtitle">{t('hl_subtitle')}</p>

      {/* Categories */}
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

      {/* Helpline Cards */}
      <div className="helplines-list">
        {filtered.length === 0 ? (
          <p className="no-helplines">{t('hl_empty')}</p>
        ) : (
          filtered.map(h => (
            <div key={h.id} className={`helpline-card cat-${h.category}`}>

              {/* Left */}
              <div className="helpline-left">
                <div className="helpline-icon">
                  {CATEGORIES.find(c => c.key === h.category)?.icon || '📞'}
                </div>

                <div>
                  {/* ✅ FIXED NAME TRANSLATION */}
                  <h4 className="helpline-name">
                    {CATEGORY_NAME_MAP[h.category] || h.name}
                  </h4>

                  {/* Optional description (can also translate later) */}
                  {h.description && (
                    <p className="helpline-desc">{h.description}</p>
                  )}

                  <div className="helpline-meta">
                    {h.available_24x7
                      ? <span className="badge-24x7">24×7</span>
                      : <span className="badge-hours">{h.working_hours}</span>}

                    {h.state && (
                      <span className="badge-state">{h.state}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Call Button */}
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
