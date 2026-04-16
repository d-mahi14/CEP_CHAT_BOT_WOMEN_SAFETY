import React, { useState, useEffect } from 'react';
import { sosAPI } from '../../services/sosService';
import { useLanguage } from '../../context/LanguageContext';

const STATUS_CONFIG = {
  triggered:   { label: 'Triggered',   color: '#f59e0b', icon: '⚡' },
  active:      { label: 'Active',      color: '#ef4444', icon: '🔴' },
  resolved:    { label: 'Resolved',    color: '#10b981', icon: '✅' },
  cancelled:   { label: 'Cancelled',   color: '#6b7280', icon: '❌' },
  false_alarm: { label: 'False Alarm', color: '#8b5cf6', icon: '⚠️' },
};

const TRIGGER_LABELS = {
  manual: '👆 Manual',
  voice:  '🎙️ Voice',
  panic:  '🚨 Panic',
  auto:   '🤖 Auto',
};

const HelpHistory = () => {
  const { t } = useLanguage();

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expanded, setExpanded] = useState(null);
  const LIMIT = 10;

  useEffect(() => {
    loadHistory(page);
  }, [page]);

  const loadHistory = async (p) => {
    setLoading(true);
    try {
      const res = await sosAPI.getHistory(p, LIMIT);
      setHistory(res.data.history || []);
      setTotal(res.data.pagination?.total || 0);
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const getDuration = (start, end) => {
    if (!end) return t('hh_ongoing');
    const ms = new Date(end) - new Date(start);
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  if (loading && page === 1) {
    return <div className="history-loading">{t('hh_loading')}</div>;
  }

  return (
    <div className="help-history-container">
      <h3 className="history-title">📋 {t('hh_title')}</h3>
      <p className="history-subtitle">
        {total} {t('hh_incidents')}
      </p>

      {history.length === 0 ? (
        <div className="history-empty">
          <span className="empty-icon">🛡️</span>
          <p>{t('hh_empty')}</p>
          <p className="empty-sub">{t('hh_empty_sub')}</p>
        </div>
      ) : (
        <>
          <div className="history-list">
            {history.map(inc => {
              const statusCfg = STATUS_CONFIG[inc.status] || STATUS_CONFIG.resolved;
              const isExpanded = expanded === inc.id;

              return (
                <div
                  key={inc.id}
                  className={`history-card ${isExpanded ? 'expanded' : ''}`}
                  onClick={() => setExpanded(isExpanded ? null : inc.id)}
                >
                  <div className="history-card-header">
                    <div className="history-left">
                      <span className="history-status-icon">{statusCfg.icon}</span>
                      <div>
                        <div className="history-type">
                          {inc.emergency_type
                            ? inc.emergency_type.replace('_', ' ').toUpperCase()
                            : 'EMERGENCY'}
                        </div>
                        <div className="history-date">{formatDate(inc.created_at)}</div>
                      </div>
                    </div>

                    <div className="history-right">
                      <span
                        className="history-status-badge"
                        style={{ background: statusCfg.color }}
                      >
                        {statusCfg.label}
                      </span>
                      <span className="history-chevron">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="history-card-body">
                      <div className="history-detail-grid">

                        <div className="detail-item">
                          <span className="detail-label">{t('hh_trigger')}</span>
                          <span className="detail-value">
                            {TRIGGER_LABELS[inc.trigger_type] || inc.trigger_type}
                          </span>
                        </div>

                        <div className="detail-item">
                          <span className="detail-label">{t('hh_risk')}</span>
                          <span className="detail-value risk">
                            {inc.risk_score}/10
                          </span>
                        </div>

                        <div className="detail-item">
                          <span className="detail-label">{t('hh_duration')}</span>
                          <span className="detail-value">
                            {getDuration(inc.created_at, inc.resolved_at)}
                          </span>
                        </div>

                        <div className="detail-item">
                          <span className="detail-label">{t('hh_notif')}</span>
                          <span className="detail-value">
                            {inc.notifications_sent || 0} {t('hh_sent')}
                          </span>
                        </div>

                      </div>

                      {inc.city && (
                        <div className="detail-location">
                          📍 {inc.address || inc.city}
                        </div>
                      )}

                      {inc.description && (
                        <div className="detail-description">
                          💬 "{inc.description}"
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {total > LIMIT && (
            <div className="history-pagination">
              <button
                className="page-btn"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
              >
                ← {t('hh_prev')}
              </button>

              <span className="page-info">
                {t('hh_page')} {page} {t('hh_of')} {Math.ceil(total / LIMIT)}
              </span>

              <button
                className="page-btn"
                onClick={() => setPage(p => p + 1)}
                disabled={page >= Math.ceil(total / LIMIT) || loading}
              >
                {t('hh_next')} →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default HelpHistory;
