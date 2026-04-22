// =====================================================
// NearbyResources.jsx — Module 15: Nearby Safety Resources
// =====================================================
// CHANGES:
//   - All UI labels, buttons, status messages, and
//     resource type names are now pulled from the
//     translation system via useLanguage() so they
//     display in the user's selected language.
//   - languageCode is passed to the backend API so
//     the Groq AI generates resource descriptions /
//     notes in the user's language.
//   - Added translation keys: nearby_title,
//     nearby_subtitle, nearby_radius_label,
//     nearby_find_btn, nearby_refresh, nearby_finding,
//     nearby_no_results, nearby_ai_suggested,
//     nearby_ai_enriched, nearby_away, nearby_directions,
//     nearby_call, nearby_map, nearby_open_map,
//     nearby_resource_hospital, nearby_resource_police,
//     nearby_resource_safe_zone, nearby_resource_shelter,
//     nearby_resource_fire_station, nearby_resource_all
// =====================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { sosAPI } from '../../services/sosService';
import { useLanguage } from '../../context/LanguageContext';

// Resource type config — labels pulled from translations at render time
const RESOURCE_TYPE_KEYS = [
  { key: 'all',             tKey: 'nearby_resource_all',          icon: '📍' },
  { key: 'hospital',        tKey: 'nearby_resource_hospital',     icon: '🏥' },
  { key: 'police_station',  tKey: 'nearby_resource_police',       icon: '👮' },
  { key: 'safe_zone',       tKey: 'nearby_resource_safe_zone',    icon: '🛡️' },
  { key: 'shelter',         tKey: 'nearby_resource_shelter',      icon: '🏠' },
  { key: 'fire_station',    tKey: 'nearby_resource_fire_station', icon: '🚒' },
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

function formatDistance(meters, t) {
  if (!meters && meters !== 0) return null;
  if (meters < 1000) return `${Math.round(meters)}m ${t('nearby_away') || 'away'}`;
  return `${(meters / 1000).toFixed(1)}km ${t('nearby_away') || 'away'}`;
}

function getDirectionsUrl(userLat, userLng, destLat, destLng) {
  return `https://www.google.com/maps/dir/${userLat},${userLng}/${destLat},${destLng}`;
}

function getGoogleMapsUrl(lat, lng, name) {
  return `https://maps.google.com/?q=${encodeURIComponent(name)}&ll=${lat},${lng}&z=16`;
}

const ResourceCard = ({ resource, userLocation, t }) => {
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
            {resource.address && <p style={s.cardAddr}>{resource.address}</p>}
            <div style={s.cardMeta}>
              <span style={{ ...s.badge, background: `${color}15`, color, border: `1px solid ${color}30` }}>
                {resource.resource_type?.replace('_', ' ')}
              </span>
              {resource.source === 'ai_generated' && (
                <span style={{
                  padding: '2px 8px', background: 'rgba(139,92,246,0.15)',
                  border: '1px solid rgba(139,92,246,0.3)', borderRadius: 6,
                  fontSize: '0.68rem', color: '#a78bfa', fontWeight: 600,
                }}>
                  {t('nearby_ai_suggested') || '🤖 AI suggested'}
                </span>
              )}
              {resource.distance_meters != null && (
                <span style={s.dist}>
                  📍 {formatDistance(resource.distance_meters, t)}
                </span>
              )}
              {resource.phone && (
                <a href={`tel:${resource.phone}`} style={s.phoneLink}>
                  📞 {resource.phone}
                </a>
              )}
              {resource.notes && (
                <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginTop: 2 }}>
                  {resource.notes}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={s.cardActions}>
          {resource.phone && (
            <a href={`tel:${resource.phone}`} style={{ ...s.actionBtn, ...s.callBtn }}
               title={t('nearby_call') || 'Call'}>📞</a>
          )}
          {userLocation && (
            <a
              href={getDirectionsUrl(userLocation.latitude, userLocation.longitude, resource.latitude, resource.longitude)}
              target="_blank" rel="noopener noreferrer"
              style={{ ...s.actionBtn, ...s.navBtn }}
              title={t('nearby_directions') || 'Get directions'}
            >🧭</a>
          )}
          <a
            href={getGoogleMapsUrl(resource.latitude, resource.longitude, resource.name)}
            target="_blank" rel="noopener noreferrer"
            style={{ ...s.actionBtn, ...s.mapBtn }}
            title={t('nearby_open_map') || 'View on map'}
          >🗺️</a>
        </div>
      </div>
    </div>
  );
};

const NearbyResources = () => {
  const { t, languageCode } = useLanguage();

  const [resources,    setResources]    = useState([]);
  const [filtered,     setFiltered]     = useState([]);
  const [activeType,   setActiveType]   = useState('all');
  const [userLocation, setUserLocation] = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [locError,     setLocError]     = useState('');
  const [fetchError,   setFetchError]   = useState('');
  const [radius,       setRadius]       = useState(5000);
  const [searched,     setSearched]     = useState(false);
  const [aiEnriched,   setAiEnriched]   = useState(false);

  const userLocationRef = useRef(null);
  useEffect(() => { userLocationRef.current = userLocation; }, [userLocation]);

  // ── Core fetch — passes languageCode to backend ──
  const doFetch = useCallback(async (lat, lng, currentRadius, currentType) => {
    setLoading(true);
    setFetchError('');
    try {
      const type = currentType === 'all' ? null : currentType;
      const res  = await sosAPI.getNearby(lat, lng, currentRadius, type, languageCode);
      const data = res.data?.resources || [];
      setResources(data);
      setFiltered(data);
      setAiEnriched(res.data?.meta?.ai_enriched || false);
      setSearched(true);
    } catch {
      setFetchError(t('nearby_error') || 'Could not load nearby resources. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }, [languageCode, t]);

  // ── Get location then fetch ────────────────────────
  const locateAndFetch = useCallback(async (overrideRadius, overrideType) => {
    setLocError('');

    const existingLoc = userLocationRef.current;
    if (existingLoc) {
      await doFetch(
        existingLoc.latitude,
        existingLoc.longitude,
        overrideRadius ?? radius,
        overrideType  ?? activeType
      );
      return;
    }

    if (!navigator.geolocation) {
      setLocError(t('nearby_geo_unsupported') || 'Geolocation is not supported by your browser.');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setUserLocation(loc);
        userLocationRef.current = loc;
        await doFetch(loc.latitude, loc.longitude, overrideRadius ?? radius, overrideType ?? activeType);
      },
      (err) => {
        setLocError(`${t('nearby_location_error') || 'Location error'}: ${err.message}`);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [doFetch, radius, activeType, t]);

  // Re-fetch when radius changes (after first search)
  useEffect(() => {
    if (!searched || !userLocationRef.current) return;
    doFetch(userLocationRef.current.latitude, userLocationRef.current.longitude, radius, activeType);
  }, [radius]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when type filter changes (after first search)
  useEffect(() => {
    if (!searched || !userLocationRef.current) return;
    doFetch(userLocationRef.current.latitude, userLocationRef.current.longitude, radius, activeType);
  }, [activeType]); // eslint-disable-line react-hooks/exhaustive-deps

  const radiusOptions = [1000, 2000, 5000, 10000, 20000];

  // Translate resource type labels at render time
  const RESOURCE_TYPES = RESOURCE_TYPE_KEYS.map(rt => ({
    ...rt,
    label: t(rt.tKey) || rt.key.replace('_', ' '),
  }));

  return (
    <div style={s.container}>
      <div style={s.header}>
        <h3 style={s.title}>{t('nearby_title') || '🗺️ Nearby Safety Resources'}</h3>
        <p style={s.subtitle}>{t('nearby_subtitle') || 'Find hospitals, police stations, and safe zones near you'}</p>
      </div>

      {/* Controls */}
      <div style={s.controls}>
        <div style={s.radiusRow}>
          <span style={s.ctrlLabel}>{t('nearby_radius_label') || 'Search radius:'}</span>
          <div style={s.radiusBtns}>
            {radiusOptions.map(r => (
              <button
                key={r}
                style={{ ...s.radiusBtn, ...(radius === r ? s.radiusBtnActive : {}) }}
                onClick={() => setRadius(r)}
                disabled={loading}
              >
                {r >= 1000 ? `${r / 1000}km` : `${r}m`}
              </button>
            ))}
          </div>
        </div>

        <button
          style={{ ...s.locateBtn, opacity: loading ? 0.7 : 1 }}
          onClick={() => locateAndFetch()}
          disabled={loading}
        >
          {loading
            ? <><span style={s.spin} /> {t('nearby_finding') || 'Searching…'}</>
            : <> 📍 {searched
                ? (t('nearby_refresh') || 'Refresh Location')
                : (t('nearby_find_btn') || 'Find Nearby Resources')
              }</>
          }
        </button>
      </div>

      {(locError || fetchError) && (
        <div style={s.error}>{locError || fetchError}</div>
      )}

      {/* Type filter tabs */}
      {searched && (
        <div style={s.typeTabs}>
          {RESOURCE_TYPES.map(type => (
            <button
              key={type.key}
              style={{ ...s.typeTab, ...(activeType === type.key ? s.typeTabActive : {}) }}
              onClick={() => setActiveType(type.key)}
              disabled={loading}
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
          {loading ? (
            <div style={s.loadingBox}>
              <span style={s.spin} />
              <span style={{ color: '#64748b', fontSize: '0.9rem' }}>
                {t('nearby_finding') || 'Finding resources'} {radius >= 1000 ? `${radius / 1000}km` : `${radius}m`}…
              </span>
            </div>
          ) : filtered.length === 0 ? (
            <div style={s.empty}>
              <span style={{ fontSize: '2.5rem' }}>🔍</span>
              <p style={{ margin: '8px 0 0', color: '#CBD5E4' }}>
                {t('nearby_no_results') || `No resources found. Try increasing the search radius.`}
              </p>
            </div>
          ) : (
            <>
              <p style={s.resultCount}>
                {filtered.length} {filtered.length !== 1
                  ? (t('nearby_resources_found_many') || 'resources found')
                  : (t('nearby_resources_found_one') || 'resource found')
                } {t('nearby_within') || 'within'} {radius >= 1000 ? `${radius / 1000}km` : `${radius}m`}
                {aiEnriched && (
                  <span style={{ marginLeft: 8, color: '#a78bfa', fontSize: '0.75rem' }}>
                    · {t('nearby_ai_enriched') || '🤖 AI-enriched'}
                  </span>
                )}
              </p>
              <div style={s.list}>
                {filtered.map(r => (
                  <ResourceCard key={r.id} resource={r} userLocation={userLocation} t={t} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Empty state before first search */}
      {!searched && !loading && (
        <div style={s.emptyState}>
          <div style={s.emptyIcon}>🏥</div>
          <p style={{ color: '#CBD5E4', margin: '12px 0 6px', fontSize: '1rem', fontWeight: 500 }}>
            {t('nearby_empty_title') || 'Find safety resources near you'}
          </p>
          <p style={{ color: '#64748b', margin: 0, fontSize: '0.85rem' }}>
            {t('nearby_empty_sub') || 'Tap the button above to locate nearby hospitals, police stations, shelters, and safe zones.'}
          </p>
        </div>
      )}

      <style>{`@keyframes nr-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

const s = {
  container:  { maxWidth: 700, margin: '0 auto', fontFamily: "'DM Sans', sans-serif" },
  header:     { marginBottom: 20 },
  title:      { fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '1.2rem', color: '#fff', margin: '0 0 4px' },
  subtitle:   { fontSize: '0.85rem', color: '#64748b', margin: 0 },
  controls:   { background: '#131929', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 14 },
  radiusRow:  { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  ctrlLabel:  { fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap' },
  radiusBtns: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  radiusBtn:  { padding: '5px 12px', background: '#1E2740', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, color: '#CBD5E4', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' },
  radiusBtnActive: { background: 'rgba(230,57,70,0.15)', borderColor: '#E63946', color: '#FF6B74' },
  locateBtn:  { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', background: '#E63946', border: 'none', borderRadius: 10, color: '#fff', fontSize: '0.92rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s', justifyContent: 'center' },
  spin:       { display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'nr-spin 0.7s linear infinite' },
  error:      { padding: '10px 14px', background: 'rgba(230,57,70,0.1)', border: '1px solid rgba(230,57,70,0.3)', borderRadius: 8, color: '#FF6B74', fontSize: '0.83rem', marginBottom: 14 },
  typeTabs:   { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 },
  typeTab:    { display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: '#131929', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, color: '#64748b', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' },
  typeTabActive: { background: 'rgba(230,57,70,0.12)', borderColor: '#E63946', color: '#FF6B74' },
  typeCount:  { background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '1px 6px', fontSize: '0.68rem' },
  results:    { display: 'flex', flexDirection: 'column', gap: 10 },
  resultCount:{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 8px' },
  loadingBox: { display: 'flex', alignItems: 'center', gap: 10, padding: '30px 20px', justifyContent: 'center' },
  list:       { display: 'flex', flexDirection: 'column', gap: 10 },
  card:       { background: '#131929', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  cardAccent: { height: 3, width: '100%', flexShrink: 0 },
  cardBody:   { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' },
  cardLeft:   { display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 },
  typeIcon:   { width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardInfo:   { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  cardName:   { fontSize: '0.95rem', fontWeight: 600, color: '#fff', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  cardAddr:   { fontSize: '0.78rem', color: '#64748b', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  cardMeta:   { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badge:      { padding: '2px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 500, textTransform: 'capitalize' },
  dist:       { fontSize: '0.75rem', color: '#94a3b8' },
  phoneLink:  { fontSize: '0.75rem', color: '#10b981', textDecoration: 'none' },
  cardActions:{ display: 'flex', gap: 6, flexShrink: 0 },
  actionBtn:  { width: 36, height: 36, borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)', background: '#1E2740', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', transition: 'all 0.2s' },
  callBtn:    { border: '1px solid rgba(16,185,129,0.2)' },
  navBtn:     { border: '1px solid rgba(59,130,246,0.2)' },
  mapBtn:     { border: '1px solid rgba(255,255,255,0.07)' },
  empty:      { textAlign: 'center', padding: '40px 20px', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  emptyState: { textAlign: 'center', padding: '50px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 },
  emptyIcon:  { fontSize: '3.5rem', lineHeight: 1 },
};

export default NearbyResources;