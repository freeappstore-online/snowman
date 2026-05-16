import { useState, useEffect, useRef, useMemo } from 'react';
import { COUNTRIES, type Country } from '../lib/countries';


const glass: React.CSSProperties = {
  background: 'rgba(10,10,10,0.88)',
  border: '1px solid rgba(255,255,255,0.10)',
};

const navBtn: React.CSSProperties = {
  background: 'none', border: 'none',
  color: '#9ca3af', fontSize: '0.8rem', fontWeight: 600,
  cursor: 'pointer', padding: '0 0.5rem', whiteSpace: 'nowrap',
};

interface Props {
  panTo: (lat: number, lon: number, zoom?: number) => void;
  snowSet: Set<string>;
  onFocusCountry: (c: { id: string; name: string; lat: number; lon: number } | null) => void;
}

export function SnowmanNav({ panTo, snowSet, onFocusCountry }: Props) {
  const [query, setQuery]           = useState('');
  const [showAbout, setShowAbout]   = useState(false);
  const [locating, setLocating]     = useState(false);
  const [wide, setWide]             = useState(() => window.innerWidth >= 560);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searchFocused, setSearchFocused] = useState(false);
  const [history, setHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('snowman-search-history') || '[]'); }
    catch { return []; }
  });
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset keyboard selection when results change
  useEffect(() => { setActiveIndex(-1); }, [query]);

  useEffect(() => {
    const update = () => setWide(window.innerWidth >= 560);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Close narrow search overlay when viewport becomes wide
  useEffect(() => { if (wide) setSearchOpen(false); }, [wide]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setQuery(''); setShowAbout(false); setSearchOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function saveToHistory(id: string) {
    setHistory(prev => {
      const next = [id, ...prev.filter(h => h !== id)].slice(0, 10);
      localStorage.setItem('snowman-search-history', JSON.stringify(next));
      return next;
    });
  }

  // Sections for dropdown: [{label?, items}]
  const dropdownSections = useMemo(() => {
    if (query.trim()) {
      const results = COUNTRIES.filter(c => c.name.toLowerCase().startsWith(query.toLowerCase()));
      return results.length ? [{ items: results }] : [];
    }
    if (!searchFocused && !(searchOpen && !wide)) return [];
    const historyIds = new Set(history);
    const historyItems = history.map(id => COUNTRIES.find(c => c.id === id)).filter((c): c is Country => !!c);
    const snowItems = COUNTRIES.filter(c => snowSet.has(c.id) && !historyIds.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    const sections: { label?: string; items: Country[] }[] = [];
    if (historyItems.length) sections.push({ label: 'Recent', items: historyItems });
    if (snowItems.length) sections.push({ label: 'Snow Available', items: snowItems });
    return sections;
  }, [query, searchFocused, searchOpen, wide, history, snowSet]);

  // Flat list for keyboard navigation
  const flatItems = useMemo(() => dropdownSections.flatMap(s => s.items), [dropdownSections]);

  function handleSnowNearMe() {
    if (!navigator.geolocation || locating) return;
    setShowAbout(false);
    setQuery('');
    setSearchOpen(false);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { panTo(coords.latitude, coords.longitude, 6); setLocating(false); },
      () => setLocating(false),
    );
  }

  function selectCountry(c: Country) {
    panTo(c.lat, c.lon, 5);
    saveToHistory(c.id);
    onFocusCountry({ id: c.id, name: c.name, lat: c.lat, lon: c.lon });
    setQuery('');
    setSearchOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  }

  const searchInput = (autoFocus = false, fullWidth = false) => (
    <input
      ref={autoFocus ? undefined : inputRef}
      autoFocus={autoFocus}
      value={query}
      onChange={e => setQuery(e.target.value)}
      onFocus={() => { setShowAbout(false); setSearchFocused(true); }}
      onBlur={() => setSearchFocused(false)}
      onKeyDown={e => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, flatItems.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, -1)); }
        else if (e.key === 'Enter') { e.preventDefault(); const c = flatItems[activeIndex]; if (c) selectCountry(c); }
      }}
      placeholder={flatItems[activeIndex]?.name ?? 'Search countries…'}
      style={{
        background: '#1c1c1e',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '0.65rem', outline: 'none',
        color: '#f5f5f5', fontSize: '0.78rem',
        padding: '0.3rem 0.7rem',
        width: fullWidth ? '100%' : 185, boxSizing: 'border-box',
      }}
    />
  );

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
          onMouseEnter={e => (e.currentTarget.style.color = '#a1a1aa')}
          onMouseLeave={e => (e.currentTarget.style.color = '#52525b')}
          style={{ background: 'none', border: 'none', color: '#52525b', fontSize: '0.67rem', fontWeight: 600, cursor: 'pointer', padding: 0, textTransform: 'uppercase', letterSpacing: '0.06em', transition: 'color 0.15s' }}
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

  // Render all sections with flat index for keyboard nav
  function renderSections(offset = 0) {
    let idx = offset;
    return dropdownSections.map((section, si) => (
      <div key={si}>
        {section.label && sectionLabel(section.label, section.label === 'Recent')}
        {section.items.map(c => dropdownItem(c, idx++))}
      </div>
    ));
  }

  return (
    <>
      {/* Main navbar pill */}
      <header style={{
        ...glass,
        position: 'absolute', top: 12, left: '50%',
        transform: 'translateX(-50%)', zIndex: 200,
        borderRadius: '1.25rem',
        padding: wide ? '0 0.35rem 0 0.875rem' : '0 0.875rem',
        height: 44,
        display: 'flex', alignItems: 'center', gap: '0.2rem',
        width: 'max-content', maxWidth: '92vw',
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
        <button style={navBtn} onClick={handleSnowNearMe}>
          {locating ? '…' : 'Snow Near Me'}
        </button>
        <button style={navBtn} onClick={() => { setShowAbout(v => !v); setQuery(''); setSearchOpen(false); }}>
          About
        </button>

        {/* Search — natural width, pill shrinks to hug content */}
        <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '0.5rem' }}>
          {wide ? (
            <div style={{ position: 'relative' }}>
              {searchInput()}
              {dropdownSections.length > 0 && (
                <div onMouseDown={e => e.preventDefault()} style={{ ...glass, position: 'absolute', top: 'calc(100% + 6px)', right: 0, borderRadius: '0.85rem', minWidth: '100%', zIndex: 300, overflow: 'hidden', maxHeight: 'calc(100dvh - 80px)', overflowY: 'auto' }}>
                  {renderSections()}
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => { setSearchOpen(v => !v); setShowAbout(false); }}
              style={{ ...navBtn, padding: '0 0.1rem', display: 'flex', alignItems: 'center' }}
              aria-label="Search countries"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <circle cx="6.5" cy="6.5" r="4.5" />
                <line x1="10" y1="10" x2="13.5" y2="13.5" />
              </svg>
            </button>
          )}
        </div>
      </header>

      {/* Wide search backdrop — closes dropdown when clicking outside */}
      {wide && dropdownSections.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => { setSearchFocused(false); inputRef.current?.blur(); }} />
      )}

      {/* Narrow search overlay (drops below the pill) */}
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

      {/* About panel */}
      {showAbout && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 198 }} onClick={() => setShowAbout(false)} />
          <div style={{
            ...glass, borderRadius: '1rem',
            position: 'absolute', top: 64, left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(92vw, 340px)', zIndex: 199,
            padding: '1.1rem 1.25rem',
            maxHeight: 'calc(100dvh - 80px)', overflowY: 'auto',
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
