// =====================================================
// NearbyResources.jsx — Module 15: Nearby Safety Resources
// =====================================================
// Displays nearby hospitals, police stations, and safe
// zones using the existing GET /api/sos/nearby endpoint.
// Uses browser Geolocation API to get user's position,
// then shows results sorted by distance with click-to-navigate.
// =====================================================

import React, { useState, useEffect, useCallback } from 'react';
import { sosAPI } from '../../services/sosService';
import { useLanguage } from '../../context/LanguageContext';

const RESOURCE_TYPES = [
  { key: 'all',             label: 'All',           icon: '📍' },
  { key: 'hospital',        label: 'Hospitals',      icon: '🏥' },
  { key: 'police_station',  label: 'Police',         icon: '👮' },
  { key: 'safe_zone',       label: 'Safe Zones',     icon: '🛡️' },
  { key: 'shelter',         label: 'Shelters',       icon: '🏠' },
  { key: 'fire_station',    label: 'Fire Station',   icon: '🚒' },
];

const TYPE_COLORS = {
  hospital:       '#10b981',
  police_station: '#3b82f6',
  safe_zone:      '#8b5cf6',
  shelter:        '#f59e0b',
  fire_station:   '#ef4444',
};

const TYPE_ICONS = {
  hospital:       '🏥',
  police_station: '👮',
  safe_zone:      '🛡️',
  shelter:        '🏠',
  fire_station:   '🚒',
};

function formatDistance(meters) {
  if (meters < 1000) return `${meters}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function getGoogleMapsUrl(lat, lng, name) {
  return `https://maps.google.com/?q=${encodeURIComponent(name)}&ll=${lat},${lng}&z=16`;
}

function getDirectionsUrl(userLat, userLng, destLat, destLng) {
  return `https://www.google.com/maps/dir/${userLat},${userLng}/${destLat},${destLng}`;
}

const ResourceCard = ({ resource, userLocation }) => {
  const color = TYPE_COLORS[resource.resource_type] || '#64748b';
  const icon  = TYPE_ICONS[resource.resource_type]  || '📍';

  return (
    <div style={s.card}>
      <div style={{ ...s.cardAccent, background: color }} />

      <div style={s.cardBody}>
        <div style={s.cardLeft}>
          <div style={{ ...s.typeIcon, background: `${color}18`, border: `1px solid ${color}30` }}>
            <span style={{ fontSize: 18 }}>{icon}</span>
          </div>
          <div style={s.cardInfo}>
            <h4 style={s.cardName}>{resource.name}</h4>
            {resource.address && (
              <p style={s.cardAddr}>{resource.address}</p>
            )}
            <div style={s.cardMeta}>
              <span style={{ ...s.badge, background: `${color}15`, color, border: `1px solid ${color}30` }}>
                {resource.resource_type?.replace('_', ' ')}
              </span>
              {resource.distance_meters && (
                <span style={s.dist}>
                  📍 {formatDistance(resource.distance_meters)} away
                </span>
              )}
              {resource.phone && (
                <a href={`tel:${resource.phone}`} style={s.phoneLink}>
                  📞 {resource.phone}
                </a>
              )}
            </div>
          </div>
        </div>

        <div style={s.cardActions}>
          {resource.phone && (
            <a
              href={`tel:${resource.phone}`}
              style={{ ...s.actionBtn, ...s.callBtn }}
              title="Call"
            >
              📞
            </a>
          )}
          {userLocation && (
            <a
              href={getDirectionsUrl(
                userLocation.latitude, userLocation.longitude,
                resource.latitude, resource.longitude
              )}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...s.actionBtn, ...s.navBtn }}
              title="Get directions"
            >
              🧭
            </a>
          )}
          <a
            href={getGoogleMapsUrl(resource.latitude, resource.longitude, resource.name)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...s.actionBtn, ...s.mapBtn }}
            title="View on map"
          >
            🗺️
          </a>
        </div>
      </div>
    </div>
  );
};

const NearbyResources = () => {
  const { t } = useLanguage();

  const [resources,      setResources]      = useState([]);
  const [filtered,       setFiltered]       = useState([]);
  const [activeType,     setActiveType]     = useState('all');
  const [userLocation,   setUserLocation]   = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [locError,       setLocError]       = useState('');
  const [fetchError,     setFetchError]     = useState('');
  const [radius,         setRadius]         = useState(5000);
  const [searched,       setSearched]       = useState(false);

  const fetchNearby = useCallback(async (lat, lng) => {
    setLoading(true);
    setFetchError('');
    try {
      const type = activeType === 'all' ? null : activeType;
      const res  = await sosAPI.getNearby(lat, lng, radius, type);
      const data = res.data?.resources || [];
      setResources(data);
      setFiltered(data);
      setSearched(true);
    } catch (err) {
      setFetchError('Could not load nearby resources. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }, [radius, activeType]);

  const locateAndFetch = useCallback(async () => {
    setLocError('');
    setLoading(true);

    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported by your browser.');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setUserLocation(loc);
        fetchNearby(loc.latitude, loc.longitude);
      },
      (err) => {
        setLocError(`Location error: ${err.message}. Please enable location access.`);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [fetchNearby]);

  // Filter locally when type changes (after initial fetch)
  useEffect(() => {
    if (!resources.length) return;
    if (activeType === 'all') {
      setFiltered(resources);
    } else {
      setFiltered(resources.filter(r => r.resource_type === activeType));
    }
  }, [activeType, resources]);

  const radiusOptions = [1000, 2000, 5000, 10000, 20000];

  return (
    <div style={s.container}>

      {/* Header */}
      <div style={s.header}>
        <div>
          <h3 style={s.title}>🗺️ Nearby Safety Resources</h3>
          <p style={s.subtitle}>Find hospitals, police stations, and safe zones near you</p>
        </div>
      </div>

      {/* Controls */}
      <div style={s.controls}>
        <div style={s.radiusRow}>
          <span style={s.ctrlLabel}>Search radius:</span>
          <div style={s.radiusBtns}>
            {radiusOptions.map(r => (
              <button
                key={r}
                style={{ ...s.radiusBtn, ...(radius === r ? s.radiusBtnActive : {}) }}
                onClick={() => setRadius(r)}
              >
                {r >= 1000 ? `${r / 1000}km` : `${r}m`}
              </button>
            ))}
          </div>
        </div>

        <button style={s.locateBtn} onClick={locateAndFetch} disabled={loading}>
          {loading ? (
            <><span style={s.spin} /> Finding nearby...</>
          ) : (
            <> 📍 {searched ? 'Refresh' : 'Find Nearby Resources'}</>
          )}
        </button>
      </div>

      {/* Errors */}
      {(locError || fetchError) && (
        <div style={s.error}>{locError || fetchError}</div>
      )}

      {/* Type filter tabs */}
      {searched && resources.length > 0 && (
        <div style={s.typeTabs}>
          {RESOURCE_TYPES.map(type => (
            <button
              key={type.key}
              style={{ ...s.typeTab, ...(activeType === type.key ? s.typeTabActive : {}) }}
              onClick={() => setActiveType(type.key)}
            >
              <span style={{ fontSize: 14 }}>{type.icon}</span>
              <span>{type.label}</span>
              {type.key !== 'all' && (
                <span style={s.typeCount}>
                  {resources.filter(r => r.resource_type === type.key).length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {searched && (
        <div style={s.results}>
          {filtered.length === 0 ? (
            <div style={s.empty}>
              <span style={{ fontSize: '2.5rem' }}>🔍</span>
              <p style={{ margin: '8px 0 0', color: '#CBD5E4' }}>
                No {activeType === 'all' ? 'resources' : activeType.replace('_', ' ')} found within {radius >= 1000 ? `${radius / 1000}km` : `${radius}m`}.
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                Try increasing the search radius.
              </p>
            </div>
          ) : (
            <>
              <p style={s.resultCount}>
                {filtered.length} resource{filtered.length !== 1 ? 's' : ''} found
                {userLocation ? ` within ${radius >= 1000 ? `${radius / 1000}km` : `${radius}m`}` : ''}
              </p>
              <div style={s.list}>
                {filtered.map(r => (
                  <ResourceCard key={r.id} resource={r} userLocation={userLocation} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Empty state before search */}
      {!searched && !loading && (
        <div style={s.emptyState}>
          <div style={s.emptyIcon}>🏥</div>
          <p style={{ color: '#CBD5E4', margin: '12px 0 6px', fontSize: '1rem', fontWeight: 500 }}>
            Find safety resources near you
          </p>
          <p style={{ color: '#64748b', margin: 0, fontSize: '0.85rem' }}>
            Tap the button above to locate nearby hospitals, police stations, shelters, and safe zones.
          </p>
        </div>
      )}

      <style>{`
        @keyframes nr-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

const s = {
  container: {
    maxWidth: 700,
    margin: '0 auto',
    fontFamily: "'DM Sans', sans-serif",
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontFamily: "'Syne', sans-serif",
    fontWeight: 700,
    fontSize: '1.2rem',
    color: '#fff',
    margin: '0 0 4px',
  },
  subtitle: {
    fontSize: '0.85rem',
    color: '#64748b',
    margin: 0,
  },
  controls: {
    background: '#131929',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  radiusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  ctrlLabel: {
    fontSize: '0.78rem',
    color: '#64748b',
    whiteSpace: 'nowrap',
  },
  radiusBtns: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  radiusBtn: {
    padding: '5px 12px',
    background: '#1E2740',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 20,
    color: '#CBD5E4',
    fontSize: '0.78rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s',
  },
  radiusBtnActive: {
    background: 'rgba(230,57,70,0.15)',
    borderColor: '#E63946',
    color: '#FF6B74',
  },
  locateBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 20px',
    background: '#E63946',
    border: 'none',
    borderRadius: 10,
    color: '#fff',
    fontSize: '0.92rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s',
    justifyContent: 'center',
  },
  spin: {
    display: 'inline-block',
    width: 14,
    height: 14,
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'nr-spin 0.7s linear infinite',
  },
  error: {
    padding: '10px 14px',
    background: 'rgba(230,57,70,0.1)',
    border: '1px solid rgba(230,57,70,0.3)',
    borderRadius: 8,
    color: '#FF6B74',
    fontSize: '0.83rem',
    marginBottom: 14,
  },
  typeTabs: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  typeTab: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '7px 12px',
    background: '#131929',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 20,
    color: '#64748b',
    fontSize: '0.8rem',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s',
  },
  typeTabActive: {
    background: 'rgba(230,57,70,0.12)',
    borderColor: '#E63946',
    color: '#FF6B74',
  },
  typeCount: {
    background: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: '1px 6px',
    fontSize: '0.68rem',
  },
  results: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  resultCount: {
    fontSize: '0.82rem',
    color: '#64748b',
    margin: '0 0 8px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  card: {
    background: '#131929',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12,
    overflow: 'hidden',
    transition: 'border-color 0.2s',
    display: 'flex',
    flexDirection: 'column',
  },
  cardAccent: {
    height: 3,
    width: '100%',
    flexShrink: 0,
  },
  cardBody: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '14px 16px',
  },
  cardLeft: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  typeIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
  },
  cardName: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#fff',
    margin: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cardAddr: {
    fontSize: '0.78rem',
    color: '#64748b',
    margin: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  badge: {
    padding: '2px 8px',
    borderRadius: 6,
    fontSize: '0.7rem',
    fontWeight: 500,
    textTransform: 'capitalize',
  },
  dist: {
    fontSize: '0.75rem',
    color: '#94a3b8',
  },
  phoneLink: {
    fontSize: '0.75rem',
    color: '#10b981',
    textDecoration: 'none',
  },
  cardActions: {
    display: 'flex',
    gap: 6,
    flexShrink: 0,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.07)',
    background: '#1E2740',
    fontSize: '1rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none',
    transition: 'all 0.2s',
  },
  callBtn: { border: '1px solid rgba(16,185,129,0.2)' },
  navBtn:  { border: '1px solid rgba(59,130,246,0.2)' },
  mapBtn:  { border: '1px solid rgba(255,255,255,0.07)' },
  empty: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#64748b',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  emptyState: {
    textAlign: 'center',
    padding: '50px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 0,
  },
  emptyIcon: {
    fontSize: '3.5rem',
    lineHeight: 1,
  },
};

export default NearbyResources;