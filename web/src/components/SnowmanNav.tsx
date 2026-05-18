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

const glass = 'bg-[rgba(10,10,10,0.88)] border border-white/10';
const inputCls = 'w-full bg-transparent border-0 outline-none text-[#f5f5f5] text-[0.78rem] py-[0.3rem] px-[0.7rem] relative z-[1]';

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
    const onWheel = () => { setShowNearMe(false); setShowAbout(false); };
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => window.removeEventListener('wheel', onWheel);
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
      const sorted = SAMPLE_POINTS
        .map(([id, lat, lon]) => {
          const centroid = COUNTRY_BY_ID.get(id);
          const centroidDist = centroid ? haversineKm(origin.lat, origin.lon, centroid.lat, centroid.lon) : Infinity;
          const sampleDist = haversineKm(origin.lat, origin.lon, lat, lon);
          const extentDist = Math.min(...(COUNTRY_EXTENT_POINTS.get(id) ?? []).map(([elat, elon]) => haversineKm(origin.lat, origin.lon, elat, elon)), Infinity);
          return { id, lat, lon, dist: Math.min(centroidDist, sampleDist, extentDist) };
        })
        .sort((a, b) => a.dist - b.dist);

      const lats = sorted.map(p => p.lat.toFixed(4)).join(',');
      const lons = sorted.map(p => p.lon.toFixed(4)).join(',');
      const r = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=snow_depth&forecast_days=1&timezone=auto`
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const results: unknown[] = Array.isArray(data) ? data : [data];

      const hasOriginSnow = sorted.some((p, i) =>
        p.id === origin.id &&
        ((results[i] as { current?: { snow_depth?: number } })?.current?.snow_depth ?? 0) > 0
      );
      if (hasOriginSnow) { selectCountry(origin); setShowNearMe(false); return; }

      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i]?.id === origin.id) continue;
        const depth = (results[i] as { current?: { snow_depth?: number } })?.current?.snow_depth ?? 0;
        if (depth > 0) {
          const country = COUNTRY_BY_ID.get(sorted[i]?.id ?? '');
          if (country) { selectCountry(country); setShowNearMe(false); return; }
        }
      }
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
      <div
        className="relative bg-[#1c1c1e] border border-white/[0.12] rounded-[0.65rem]"
        style={{ width: fullWidth ? '100%' : 185 }}
      >
        {suffix && (
          <div aria-hidden className="absolute inset-0 px-[0.7rem] text-[0.78rem] flex items-center pointer-events-none overflow-hidden whitespace-pre">
            <span className="text-transparent">{query}</span>
            <span className="text-white/50">{suffix}</span>
          </div>
        )}
        <input
          ref={autoFocus ? undefined : inputRef}
          autoFocus={autoFocus}
          name="country-search"
          autoComplete="off"
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
          className={inputCls}
        />
      </div>
    );
  };

  function clearHistory() {
    setHistory([]);
    localStorage.removeItem('snowman-search-history');
  }

  const sectionLabel = (text: string, showClear = false) => (
    <div className="px-[0.85rem] pt-[0.35rem] pb-[0.2rem] text-[0.67rem] font-bold text-[#9ca3af] tracking-[0.06em] uppercase flex items-center justify-between">
      <span>{text}</span>
      {showClear && (
        <button
          onMouseDown={e => e.preventDefault()}
          onClick={clearHistory}
          onMouseEnter={e => (e.currentTarget.style.color = '#d4d4d8')}
          onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
          className="bg-transparent border-0 text-[#9ca3af] text-[0.67rem] font-semibold cursor-pointer p-0 uppercase tracking-[0.06em] transition-colors duration-150"
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
      className="flex items-center gap-2 w-full px-[0.85rem] py-[0.42rem] border-0 border-t border-white/[0.06] text-[#d4d4d8] text-[0.8rem] cursor-pointer text-left"
      style={{ background: flatIdx === activeIndex ? 'rgba(255,255,255,0.08)' : 'transparent' }}
    >
      <span className="text-[0.55rem]" style={{ color: snowSet.has(c.id) ? '#4ade80' : '#71717a' }}>●</span>
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
      className={`${glass} rounded-[0.85rem] absolute top-[calc(100%+6px)] left-0 right-0 z-[300] overflow-hidden max-h-[calc(100dvh-160px)] overflow-y-auto`}
    >
      {nearMeSuggestions.map((c, i) => (
        <button
          key={c.id}
          onClick={() => { setNearMeQuery(c.name); setNearMeActiveIndex(-1); setNearMePicked(true); }}
          onMouseEnter={() => setNearMeActiveIndex(i)}
          onMouseLeave={() => setNearMeActiveIndex(-1)}
          className="block w-full text-left px-[0.85rem] py-[0.42rem] border-0 text-[#d4d4d8] text-[0.8rem] cursor-pointer"
          style={{
            background: i === nearMeActiveIndex ? 'rgba(255,255,255,0.08)' : 'transparent',
            borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {c.name}
        </button>
      ))}
    </div>
  ) : null;

  if (!wide && focusedCountry) return null;

  const panelPos = navRect
    ? { left: navRect.left, width: navRect.width }
    : { left: '50%', transform: 'translateX(-50%)', width: 'min(92vw, 340px)' };

  return (
    <>
      {/* Main navbar pill */}
      <header
        ref={navHeaderRef}
        className={`${glass} absolute top-3 z-[200] rounded-[1.25rem] h-11 flex items-center gap-1`}
        style={wide
          ? { left: '50%', transform: 'translateX(-50%)', width: 'max-content', maxWidth: '92vw', padding: '0 0.75rem 0 0.875rem' }
          : { left: 8, right: 8, padding: '0 0.875rem' }
        }
      >
        {/* Brand */}
        <span
          className="font-extrabold text-[1rem] tracking-[-0.01em] shrink-0 pr-[0.4rem]"
          style={{ fontFamily: 'Fraunces, serif', background: 'linear-gradient(to bottom, #87ceeb, #ffffff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
        >
          Snowman
        </span>

        <div className="w-px h-5 bg-white/[0.12] shrink-0" />

        <button
          className="bg-transparent border-0 text-[0.8rem] font-semibold cursor-pointer px-2 whitespace-nowrap"
          style={{ color: showNearMe ? '#f5f5f5' : '#9ca3af' }}
          onClick={() => { setShowNearMe(v => !v); setShowAbout(false); setQuery(''); setSearchOpen(false); }}
        >
          Snow Near Me
        </button>
        <button
          className="bg-transparent border-0 text-[0.8rem] font-semibold cursor-pointer px-2 whitespace-nowrap"
          style={{ color: showAbout ? '#f5f5f5' : '#9ca3af' }}
          onClick={() => { setShowAbout(v => !v); setShowNearMe(false); setQuery(''); setSearchOpen(false); }}
        >
          About
        </button>

        <div className="flex items-center pl-2 ml-auto">
          <button
            onClick={() => { setSearchOpen(v => !v); setShowAbout(false); setShowNearMe(false); }}
            className="bg-transparent border-0 px-[0.1rem] flex items-center cursor-pointer"
            style={{ color: searchOpen ? '#f5f5f5' : '#9ca3af' }}
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
          <div className="fixed inset-0 z-[198]" onClick={() => setSearchOpen(false)} />
          <div className={`${glass} rounded-[1rem] absolute top-16 z-[199] p-2`} style={panelPos}>
            <div className="relative">
              {searchInput(true, true)}
              {dropdownSections.length > 0 && (
                <div
                  onMouseDown={e => e.preventDefault()}
                  className={`${glass} rounded-[0.85rem] absolute top-[calc(100%+8px)] left-0 right-0 z-[300] overflow-hidden max-h-[calc(100dvh-140px)] overflow-y-auto`}
                >
                  {renderSections()}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Narrow search overlay + panel */}
      {!wide && searchOpen && (
        <div className="fixed inset-0 z-[198]" onClick={() => setSearchOpen(false)} />
      )}
      {!wide && searchOpen && (
        <div className={`${glass} absolute top-16 left-1/2 -translate-x-1/2 w-[min(96vw,420px)] z-[199] rounded-[1rem] max-h-[calc(100dvh-80px)] flex flex-col`}>
          <div className="p-2 pb-[0.35rem] shrink-0">{searchInput(true, true)}</div>
          <div className="overflow-y-auto">{renderSections()}</div>
        </div>
      )}

      {/* Snow Near Me panel */}
      {showNearMe && <div className="fixed inset-0 z-[198]" onMouseDown={() => setShowNearMe(false)} />}
      {showNearMe && (
        <div ref={nearMePanelRef} className={`${glass} rounded-[1rem] absolute top-16 z-[199] p-2 pb-[0.35rem]`} style={panelPos}>
          <div className={`flex gap-[0.4rem] ${!wide ? 'relative' : ''}`}>
            <div className="relative flex-1 bg-[#1c1c1e] border border-white/[0.12] rounded-[0.65rem]">
              {(() => {
                const s = nearMeSuggestions[nearMeActiveIndex >= 0 ? nearMeActiveIndex : 0];
                const suffix = (!nearMePicked && s) ? s.name.slice(nearMeQuery.length) : '';
                return suffix ? (
                  <div aria-hidden className="absolute inset-0 px-[0.7rem] text-[0.78rem] flex items-center pointer-events-none overflow-hidden whitespace-pre">
                    <span className="text-transparent">{nearMeQuery}</span>
                    <span className="text-white/50">{suffix}</span>
                  </div>
                ) : null;
              })()}
              <input
                autoFocus
                name="near-me-country"
                autoComplete="off"
                value={nearMeQuery}
                onChange={e => { setNearMeQuery(e.target.value); setNearMePicked(false); }}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setNearMeActiveIndex(i => Math.min(i + 1, nearMeSuggestions.length - 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setNearMeActiveIndex(i => Math.max(i - 1, -1)); }
                  else if (e.key === 'Enter') { e.preventDefault(); handleGoNearMe(); }
                }}
                placeholder="Enter your country…"
                className={inputCls}
              />
              {wide && nearMeDropdownEl}
            </div>

            <button
              onClick={handleGoNearMe}
              disabled={!nearMeQuery.trim() || nearMeSuggestions.length === 0 || nearMeSearching}
              className="bg-white/10 border border-white/[0.15] rounded-[0.65rem] text-[#f5f5f5] flex items-center px-3 py-[0.3rem] transition-opacity"
              style={{
                cursor: nearMeQuery.trim() && nearMeSuggestions.length > 0 && !nearMeSearching ? 'pointer' : 'default',
                opacity: nearMeQuery.trim() && nearMeSuggestions.length > 0 && !nearMeSearching ? 1 : 0.4,
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

          {nearMeQuery.trim() !== '' && nearMeSuggestions.length === 0 ? (
            <p className="text-[0.7rem] text-[#ef4444] mt-[0.3rem] mx-[0.2rem] mb-0 leading-[1.4]">Country not found</p>
          ) : (
            <p className="text-[0.7rem] text-[#9ca3af] mt-[0.3rem] mx-[0.2rem] mb-0 leading-[1.4]">Pre-filled country is based on your IP address</p>
          )}
        </div>
      )}

      {/* About panel */}
      {showAbout && <div className="fixed inset-0 z-[198]" onMouseDown={() => setShowAbout(false)} />}
      {showAbout && (
        <div ref={aboutPanelRef} className={`${glass} rounded-[1rem] absolute top-16 z-[199] p-[1.1rem] px-[1.25rem] max-h-[calc(100dvh-80px)] overflow-y-auto`} style={panelPos}>
          <h2 className="text-[1.1rem] font-extrabold text-[#f5f5f5] mt-0 mb-2" style={{ fontFamily: 'Fraunces, serif' }}>
            Snowman
          </h2>
          <p className="text-[0.8rem] text-[#d4d4d8] leading-[1.55] mt-0 mb-3">
            See where it's snowing right now across 190+ countries, updated hourly.
            Pan and zoom the map, or search for a country above.
          </p>
          <p className="text-[0.75rem] text-[#a1a1aa] leading-[1.5] mt-0 mb-[0.4rem]">
            Snow data reflects general regional depths. Isolated high-altitude peaks may vary.
          </p>
          <p className="text-[0.75rem] text-[#a1a1aa] leading-[1.5] mt-0 mb-[0.4rem]">
            Snow depth: <a href="https://open-meteo.com" className="text-[#a1a1aa]">Open-Meteo</a>
            {' · '}Map: <a href="https://github.com/topojson/world-atlas" className="text-[#a1a1aa]">Natural Earth</a>
          </p>
          <p className="text-[0.75rem] text-[#a1a1aa] m-0">
            Proudly a member of{' '}
            <a href="https://freeappstore.online" className="text-[#60a5fa]">FreeAppStore</a>
          </p>
        </div>
      )}
    </>
  );
}
