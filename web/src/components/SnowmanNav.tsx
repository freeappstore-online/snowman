import { useState, useEffect, useRef, useMemo } from 'react';
import { COUNTRIES, COUNTRY_BY_ID, COUNTRY_EXTENT_POINTS, type Country } from '../lib/countries';
import { SAMPLE_POINTS } from '../hooks/useSnowData';

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


const glass: React.CSSProperties = {
  background: 'rgba(10,10,10,0.88)',
  border: '1px solid rgba(255,255,255,0.10)',
};

const navBtn: React.CSSProperties = {
  background: 'none', border: 'none',
  color: '#9ca3af', fontSize: '0.8rem', fontWeight: 600,
  cursor: 'pointer', padding: '0 0.5rem', whiteSpace: 'nowrap',
};

const inputStyle: React.CSSProperties = {
  background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '0.65rem', outline: 'none',
  color: '#f5f5f5', fontSize: '0.78rem',
  padding: '0.3rem 0.7rem', boxSizing: 'border-box',
};

interface Props {
  panTo: (lat: number, lon: number, zoom?: number) => void;
  snowSet: Set<string>;
  onFocusCountry: (c: { id: string; name: string; lat: number; lon: number } | null) => void;
  focusedCountry: { id: string } | null;
}

export function SnowmanNav({ panTo, snowSet, onFocusCountry, focusedCountry }: Props) {
  const [query, setQuery]             = useState('');
  const [showAbout, setShowAbout]     = useState(false);
  const [showNearMe, setShowNearMe]   = useState(false);
  const [wide, setWide]               = useState(() => window.innerWidth >= 560);
  const [searchOpen, setSearchOpen]   = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searchFocused, setSearchFocused] = useState(false);
  const [history, setHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('snowman-search-history') || '[]'); }
    catch { return []; }
  });
  const [nearMeQuery, setNearMeQuery]           = useState('');
  const [nearMeActiveIndex, setNearMeActiveIndex] = useState(-1);
  const [nearMePicked, setNearMePicked]         = useState(false);
  const [nearMeSearching, setNearMeSearching]   = useState(false);
  const [navRect, setNavRect] = useState<{ left: number; width: number } | null>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const navHeaderRef   = useRef<HTMLElement>(null);
  const nearMePanelRef = useRef<HTMLDivElement>(null);
  const aboutPanelRef  = useRef<HTMLDivElement>(null);

  const nearMeSuggestions = useMemo(() =>
    nearMeQuery.trim()
      ? COUNTRIES.filter(c => c.name.toLowerCase().startsWith(nearMeQuery.trim().toLowerCase()))
      : [],
  [nearMeQuery]);

  useEffect(() => { setNearMeActiveIndex(-1); }, [nearMeQuery]);

  // Fetch country from IP on mount
  useEffect(() => {
    fetch('https://get.geojs.io/v1/ip/country.json')
      .then(r => r.ok ? r.json() : null)
      .then((d: { name?: string } | null) => {
        const name = d?.name ?? '';
        if (name) {
          setNearMeQuery(prev => prev === '' ? name : prev);
          setNearMePicked(true);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => { setActiveIndex(-1); }, [query]);

  useEffect(() => {
    const update = () => setWide(window.innerWidth >= 560);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => { if (wide) setSearchOpen(false); }, [wide]);

  useEffect(() => {
    const update = () => {
      const r = navHeaderRef.current?.getBoundingClientRect();
      if (r) setNavRect({ left: r.left, width: r.width });
    };
    update();
    const ro = new ResizeObserver(update);
    if (navHeaderRef.current) ro.observe(navHeaderRef.current);
    window.addEventListener('resize', update);
    return () => { ro.disconnect(); window.removeEventListener('resize', update); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setQuery(''); setShowAbout(false); setShowNearMe(false); setSearchOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!showNearMe && !showAbout) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (navHeaderRef.current?.contains(t)) return;
      if (showNearMe && !nearMePanelRef.current?.contains(t)) setShowNearMe(false);
      if (showAbout && !aboutPanelRef.current?.contains(t)) setShowAbout(false);
    };
    const onWheel = () => { setShowNearMe(false); setShowAbout(false); };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('wheel', onWheel);
    };
  }, [showNearMe, showAbout]);

  function saveToHistory(id: string) {
    setHistory(prev => {
      const next = [id, ...prev.filter(h => h !== id)].slice(0, 10);
      localStorage.setItem('snowman-search-history', JSON.stringify(next));
      return next;
    });
  }

  async function handleGoNearMe() {
    const origin = nearMeSuggestions[nearMeActiveIndex >= 0 ? nearMeActiveIndex : 0]
      ?? (() => { const q = nearMeQuery.trim().toLowerCase(); return COUNTRIES.find(c => c.name.toLowerCase() === q); })();
    if (!origin || nearMeSearching) return;

    setNearMeSearching(true);
    try {
      // Use min(centroid, sample point) distance — handles both small countries where
      // sample points are far-north outliers, and large countries (Russia, Canada) where
      // the centroid is deep inland but the closest territory is near the origin
      const sorted = SAMPLE_POINTS
        .filter(([id]) => id !== '010')
        .map(([id, lat, lon]) => {
          const centroid = COUNTRY_BY_ID.get(id);
          const centroidDist = centroid ? haversineKm(origin.lat, origin.lon, centroid.lat, centroid.lon) : Infinity;
          const sampleDist = haversineKm(origin.lat, origin.lon, lat, lon);
          const extentDist = Math.min(...(COUNTRY_EXTENT_POINTS.get(id) ?? []).map(([elat, elon]) => haversineKm(origin.lat, origin.lon, elat, elon)), Infinity);
          return { id, lat, lon, dist: Math.min(centroidDist, sampleDist, extentDist) };
        })
        .sort((a, b) => a.dist - b.dist);

      // Single batch request — 80 queried points (excl. Antarctica) fit within Open-Meteo's 100-location limit
      const lats = sorted.map(p => p.lat.toFixed(4)).join(',');
      const lons = sorted.map(p => p.lon.toFixed(4)).join(',');
      const r = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=snow_depth&forecast_days=1&timezone=auto`
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const results: unknown[] = Array.isArray(data) ? data : [data];

      // Check ALL sample points for origin country first — some countries (Bolivia, Russia, Argentina,
      // Chile) have multiple sample points; findIndex only returns the first, which may not have snow.
      const hasOriginSnow = sorted.some((p, i) =>
        p.id === origin.id &&
        ((results[i] as { current?: { snow_depth?: number } })?.current?.snow_depth ?? 0) > 0
      );
      if (hasOriginSnow) { selectCountry(origin); setShowNearMe(false); return; }

      // Walk sorted order — first hit is geographically closest snowy country
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i]?.id === origin.id) continue; // already checked above
        const depth = (results[i] as { current?: { snow_depth?: number } })?.current?.snow_depth ?? 0;
        if (depth > 0) {
          const country = COUNTRY_BY_ID.get(sorted[i]?.id ?? '');
          if (country) { selectCountry(country); setShowNearMe(false); return; }
        }
      }
      // No snow found globally — stay put (could add a toast here)
    } catch {
      // Network error — silently ignore
    } finally {
      setNearMeSearching(false);
    }
  }

  const dropdownSections = useMemo(() => {
    if (query.trim()) {
      const results = COUNTRIES.filter(c => c.name.toLowerCase().startsWith(query.toLowerCase()));
      return results.length ? [{ items: results }] : [];
    }
    if (!(searchFocused || searchOpen)) return [];
    const historyIds = new Set(history);
    const historyItems = history.map(id => COUNTRIES.find(c => c.id === id)).filter((c): c is Country => !!c);
    const snowItems = COUNTRIES.filter(c => snowSet.has(c.id) && !historyIds.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    const sections: { label?: string; items: Country[] }[] = [];
    if (historyItems.length) sections.push({ label: 'Recent', items: historyItems });
    if (snowItems.length) sections.push({ label: 'Snow Available', items: snowItems });
    return sections;
  }, [query, searchFocused, searchOpen, wide, history, snowSet]);

  const flatItems = useMemo(() => dropdownSections.flatMap(s => s.items), [dropdownSections]);

  function selectCountry(c: Country) {
    panTo(c.lat, c.lon, 5);
    saveToHistory(c.id);
    onFocusCountry({ id: c.id, name: c.name, lat: c.lat, lon: c.lon });
    setQuery('');
    setSearchOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  }

  const searchInput = (autoFocus = false, fullWidth = false) => {
    const activeItem = activeIndex >= 0 ? flatItems[activeIndex] : null;
    const suffix = activeItem && activeItem.name.toLowerCase().startsWith(query.toLowerCase())
      ? activeItem.name.slice(query.length) : '';
    return (
      <div style={{
        position: 'relative', width: fullWidth ? '100%' : 185,
        background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '0.65rem',
      }}>
        {suffix && (
          <div aria-hidden style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            padding: '0.3rem 0.7rem', boxSizing: 'border-box',
            fontSize: '0.78rem', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center',
            pointerEvents: 'none', overflow: 'hidden', whiteSpace: 'pre',
          }}>
            <span style={{ color: 'transparent' }}>{query}</span>
            <span style={{ color: 'rgba(245,245,245,0.5)' }}>{suffix}</span>
          </div>
        )}
        <input
          ref={autoFocus ? undefined : inputRef}
          autoFocus={autoFocus}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => { setShowAbout(false); setShowNearMe(false); setSearchFocused(true); }}
          onBlur={() => setSearchFocused(false)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, flatItems.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, -1)); }
            else if (e.key === 'Enter') { e.preventDefault(); const c = flatItems[activeIndex]; if (c) selectCountry(c); }
          }}
          placeholder={suffix ? '' : 'Search countries…'}
          style={{ ...inputStyle, width: '100%', background: 'transparent', border: 'none', borderRadius: 0, position: 'relative', zIndex: 1 }}
        />
      </div>
    );
  };

  function clearHistory() {
    setHistory([]);
    localStorage.removeItem('snowman-search-history');
  }

  const sectionLabel = (text: string, showClear = false) => (
    <div style={{ padding: '0.35rem 0.85rem 0.2rem', fontSize: '0.67rem', fontWeight: 700, color: '#71717a', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span>{text}</span>
      {showClear && (
        <button
          onMouseDown={e => e.preventDefault()}
          onClick={clearHistory}
          onMouseEnter={e => (e.currentTarget.style.color = '#d4d4d8')}
          onMouseLeave={e => (e.currentTarget.style.color = '#71717a')}
          style={{ background: 'none', border: 'none', color: '#71717a', fontSize: '0.67rem', fontWeight: 600, cursor: 'pointer', padding: 0, textTransform: 'uppercase', letterSpacing: '0.06em', transition: 'color 0.15s' }}
        >
          Clear
        </button>
      )}
    </div>
  );

  const dropdownItem = (c: Country, flatIdx: number) => (
    <button
      key={c.id}
      onClick={() => selectCountry(c)}
      onMouseEnter={() => setActiveIndex(flatIdx)}
      onMouseLeave={() => setActiveIndex(-1)}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        width: '100%', padding: '0.42rem 0.85rem',
        background: flatIdx === activeIndex ? 'rgba(255,255,255,0.08)' : 'none',
        border: 'none',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        color: '#d4d4d8', fontSize: '0.8rem',
        cursor: 'pointer', textAlign: 'left',
      }}
    >
      <span style={{ color: snowSet.has(c.id) ? '#4ade80' : '#52525b', fontSize: '0.55rem' }}>●</span>
      {c.name}
    </button>
  );

  function renderSections(offset = 0) {
    let idx = offset;
    return dropdownSections.map((section, si) => (
      <div key={si}>
        {section.label && sectionLabel(section.label, section.label === 'Recent')}
        {section.items.map(c => dropdownItem(c, idx++))}
      </div>
    ));
  }

  const nearMeDropdownEl = nearMeSuggestions.length > 0 && !nearMePicked ? (
    <div
      onMouseDown={e => e.preventDefault()}
      style={{
        ...glass, borderRadius: '0.85rem',
        position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
        zIndex: 300, overflow: 'hidden', maxHeight: 'calc(100dvh - 160px)', overflowY: 'auto',
      }}
    >
      {nearMeSuggestions.map((c, i) => (
        <button
          key={c.id}
          onClick={() => { setNearMeQuery(c.name); setNearMeActiveIndex(-1); setNearMePicked(true); }}
          onMouseEnter={() => setNearMeActiveIndex(i)}
          onMouseLeave={() => setNearMeActiveIndex(-1)}
          style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: '0.42rem 0.85rem',
            background: i === nearMeActiveIndex ? 'rgba(255,255,255,0.08)' : 'none',
            border: 'none', borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)',
            color: '#d4d4d8', fontSize: '0.8rem', cursor: 'pointer',
          }}
        >
          {c.name}
        </button>
      ))}
    </div>
  ) : null;

  if (!wide && focusedCountry) return null;

  return (
    <>
      {/* Main navbar pill */}
      <header ref={navHeaderRef} style={{
        ...glass,
        position: 'absolute', top: 12, zIndex: 200,
        borderRadius: '1.25rem',
        height: 44,
        display: 'flex', alignItems: 'center', gap: '0.2rem',
        ...(wide ? {
          left: '50%', transform: 'translateX(-50%)',
          width: 'max-content', maxWidth: '92vw',
          padding: '0 0.75rem 0 0.875rem',
        } : {
          left: 8, right: 8,
          padding: '0 0.875rem',
        }),
      }}>
        {/* Brand */}
        <span style={{
          fontFamily: 'Fraunces, "Times New Roman", Georgia, serif',
          fontWeight: 800, fontSize: '1rem',
          letterSpacing: '-0.01em', flexShrink: 0, paddingRight: '0.4rem',
          background: 'linear-gradient(to bottom, #87ceeb, #ffffff)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          Snowman
        </span>

        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />

        {/* Nav links */}
        <button style={{ ...navBtn, color: showNearMe ? '#f5f5f5' : '#9ca3af' }} onClick={() => { setShowNearMe(v => !v); setShowAbout(false); setQuery(''); setSearchOpen(false); }}>
          Snow Near Me
        </button>
        <button style={{ ...navBtn, color: showAbout ? '#f5f5f5' : '#9ca3af' }} onClick={() => { setShowAbout(v => !v); setShowNearMe(false); setQuery(''); setSearchOpen(false); }}>
          About
        </button>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '0.5rem', marginLeft: 'auto' }}>
          <button
            onClick={() => { setSearchOpen(v => !v); setShowAbout(false); setShowNearMe(false); }}
            style={{ ...navBtn, padding: '0 0.1rem', display: 'flex', alignItems: 'center', color: searchOpen ? '#f5f5f5' : '#9ca3af' }}
            aria-label={searchOpen ? 'Close search' : 'Search countries'}
          >
            {searchOpen ? (
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="3" y1="3" x2="12" y2="12" />
                <line x1="12" y1="3" x2="3" y2="12" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <circle cx="6.5" cy="6.5" r="4.5" />
                <line x1="10" y1="10" x2="13.5" y2="13.5" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Wide search panel */}
      {wide && searchOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 198 }} onClick={() => setSearchOpen(false)} />
          <div style={{
            ...glass, borderRadius: '1rem',
            position: 'absolute', top: 64, zIndex: 199,
            ...(navRect
              ? { left: navRect.left, width: navRect.width }
              : { left: '50%', transform: 'translateX(-50%)', width: 'min(92vw, 340px)' }),
            padding: '0.5rem',
          }}>
            <div style={{ position: 'relative' }}>
              {searchInput(true, true)}
              {dropdownSections.length > 0 && (
                <div onMouseDown={e => e.preventDefault()} style={{
                  ...glass, borderRadius: '0.85rem',
                  position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                  zIndex: 300, overflow: 'hidden',
                  maxHeight: 'calc(100dvh - 140px)', overflowY: 'auto',
                }}>
                  {renderSections()}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Narrow search overlay */}
      {!wide && searchOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 198 }} onClick={() => setSearchOpen(false)} />
      )}
      {!wide && searchOpen && (
        <div style={{
          ...glass,
          position: 'absolute', top: 64, left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(96vw, 420px)', zIndex: 199,
          borderRadius: '1rem',
          maxHeight: 'calc(100dvh - 80px)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '0.5rem 0.5rem 0.35rem', flexShrink: 0 }}>
            {searchInput(true, true)}
          </div>
          <div style={{ overflowY: 'auto' }}>
            {renderSections()}
          </div>
        </div>
      )}

      {/* Snow Near Me panel */}
      {showNearMe && (
        <>
          <div ref={nearMePanelRef} style={{
            ...glass, borderRadius: '1rem',
            position: 'absolute', top: 64, zIndex: 199,
            padding: '0.5rem 0.5rem 0.35rem',
            ...(navRect
              ? { left: navRect.left, width: navRect.width }
              : { left: '50%', transform: 'translateX(-50%)', width: 'min(92vw, 340px)' }),
          }}>
            {/* Input row */}
            <div style={{ display: 'flex', gap: '0.4rem', ...(!wide && { position: 'relative' }) }}>
              {/* Wrap input — on wide, dropdown anchors to input width; on mobile, anchors to outer row */}
              <div style={{
                position: 'relative', flex: 1,
                background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '0.65rem',
              }}>
                {/* Ghost completion text */}
                {(() => {
                  const s = nearMeSuggestions[nearMeActiveIndex >= 0 ? nearMeActiveIndex : 0];
                  const suffix = (!nearMePicked && s) ? s.name.slice(nearMeQuery.length) : '';
                  return suffix ? (
                    <div aria-hidden style={{
                      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                      padding: '0.3rem 0.7rem', boxSizing: 'border-box',
                      fontSize: '0.78rem', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center',
                      pointerEvents: 'none', overflow: 'hidden', whiteSpace: 'pre',
                    }}>
                      <span style={{ color: 'transparent' }}>{nearMeQuery}</span>
                      <span style={{ color: 'rgba(245,245,245,0.5)' }}>{suffix}</span>
                    </div>
                  ) : null;
                })()}
                <input
                  autoFocus
                  value={nearMeQuery}
                  onChange={e => { setNearMeQuery(e.target.value); setNearMePicked(false); }}
                  onKeyDown={e => {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setNearMeActiveIndex(i => Math.min(i + 1, nearMeSuggestions.length - 1)); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); setNearMeActiveIndex(i => Math.max(i - 1, -1)); }
                    else if (e.key === 'Enter') { e.preventDefault(); handleGoNearMe(); }
                  }}
                  placeholder='Enter your country…'
                  style={{ ...inputStyle, width: '100%', background: 'transparent', border: 'none', borderRadius: 0, position: 'relative', zIndex: 1 }}
                />
                {wide && nearMeDropdownEl}
              </div>

              <button
                onClick={handleGoNearMe}
                disabled={!nearMeQuery.trim() || nearMeSuggestions.length === 0 || nearMeSearching}
                style={{
                  background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '0.65rem', color: '#f5f5f5',
                  cursor: nearMeQuery.trim() && nearMeSuggestions.length > 0 && !nearMeSearching ? 'pointer' : 'default',
                  opacity: nearMeQuery.trim() && nearMeSuggestions.length > 0 && !nearMeSearching ? 1 : 0.4,
                  padding: '0.3rem 0.75rem', display: 'flex', alignItems: 'center',
                }}
              >
                {nearMeSearching ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <circle cx="7" cy="7" r="5" strokeDasharray="20" strokeDashoffset="10" style={{ transformOrigin: '7px 7px', animation: 'spin 0.8s linear infinite' }} />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="2" y1="7" x2="12" y2="7" />
                    <polyline points="8,3 12,7 8,11" />
                  </svg>
                )}
              </button>
              {!wide && nearMeDropdownEl}
            </div>

            {/* Disclaimer / validation */}
            {nearMeQuery.trim() !== '' && nearMeSuggestions.length === 0 ? (
              <p style={{ fontSize: '0.7rem', color: '#ef4444', margin: '0.3rem 0.2rem 0', lineHeight: 1.4 }}>
                Country not found
              </p>
            ) : (
              <p style={{ fontSize: '0.7rem', color: '#6b7280', margin: '0.3rem 0.2rem 0', lineHeight: 1.4 }}>
                Pre-filled country is based on your IP address
              </p>
            )}
          </div>
        </>
      )}

      {/* About panel */}
      {showAbout && (
        <>
          <div ref={aboutPanelRef} style={{
            ...glass, borderRadius: '1rem',
            position: 'absolute', top: 64, zIndex: 199,
            padding: '1.1rem 1.25rem',
            maxHeight: 'calc(100dvh - 80px)', overflowY: 'auto',
            ...(navRect
              ? { left: navRect.left, width: navRect.width }
              : { left: '50%', transform: 'translateX(-50%)', width: 'min(92vw, 340px)' }),
          }}>
            <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.1rem', fontWeight: 800, color: '#f5f5f5', margin: '0 0 0.5rem' }}>
              Snowman
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#9ca3af', lineHeight: 1.55, margin: '0 0 0.75rem' }}>
              See where it's snowing right now across 190+ countries, updated hourly.
              Pan and zoom the map, or search for a country above.
            </p>
            <p style={{ fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.5, margin: '0 0 0.4rem' }}>
              Snow data reflects general regional depths. Isolated high-altitude peaks may vary.
            </p>
            <p style={{ fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.5, margin: '0 0 0.4rem' }}>
              Snow depth: <a href="https://open-meteo.com" style={{ color: '#6b7280' }}>Open-Meteo</a>
              {' · '}Map: <a href="https://github.com/topojson/world-atlas" style={{ color: '#6b7280' }}>Natural Earth</a>
            </p>
            <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>
              Proudly a member of{' '}
              <a href="https://freeappstore.online" style={{ color: '#60a5fa' }}>FreeAppStore</a>
            </p>
          </div>
        </>
      )}
    </>
  );
}
