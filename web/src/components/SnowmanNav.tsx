import { useState, useEffect, useRef, useMemo } from 'react';

const COUNTRIES = [
  { id: '010', name: 'Antarctica',      lat:-82.86,  lon: 135.00 },
  { id: '304', name: 'Greenland',       lat: 72.00,  lon: -40.00 },
  { id: '004', name: 'Afghanistan',     lat: 33.93,  lon:  67.71 },
  { id: '008', name: 'Albania',         lat: 41.15,  lon:  20.17 },
  { id: '012', name: 'Algeria',         lat: 28.03,  lon:   1.66 },
  { id: '024', name: 'Angola',          lat:-11.20,  lon:  17.87 },
  { id: '032', name: 'Argentina',       lat:-38.42,  lon: -63.62 },
  { id: '036', name: 'Australia',       lat:-25.27,  lon: 133.78 },
  { id: '040', name: 'Austria',         lat: 47.52,  lon:  14.55 },
  { id: '050', name: 'Bangladesh',      lat: 23.68,  lon:  90.36 },
  { id: '056', name: 'Belgium',         lat: 50.50,  lon:   4.47 },
  { id: '064', name: 'Bhutan',          lat: 27.51,  lon:  90.43 },
  { id: '068', name: 'Bolivia',         lat:-16.29,  lon: -63.59 },
  { id: '076', name: 'Brazil',          lat:-14.24,  lon: -51.93 },
  { id: '100', name: 'Bulgaria',        lat: 42.73,  lon:  25.49 },
  { id: '104', name: 'Myanmar',         lat: 21.92,  lon:  95.96 },
  { id: '116', name: 'Cambodia',        lat: 12.57,  lon: 104.99 },
  { id: '120', name: 'Cameroon',        lat:  7.37,  lon:  12.35 },
  { id: '124', name: 'Canada',          lat: 56.13,  lon:-106.35 },
  { id: '144', name: 'Sri Lanka',       lat:  7.87,  lon:  80.77 },
  { id: '152', name: 'Chile',           lat:-35.68,  lon: -71.54 },
  { id: '156', name: 'China',           lat: 35.86,  lon: 104.20 },
  { id: '170', name: 'Colombia',        lat:  4.57,  lon: -74.30 },
  { id: '180', name: 'DR Congo',        lat: -4.04,  lon:  21.76 },
  { id: '191', name: 'Croatia',         lat: 45.10,  lon:  15.20 },
  { id: '192', name: 'Cuba',            lat: 21.52,  lon: -77.78 },
  { id: '203', name: 'Czechia',         lat: 49.82,  lon:  15.47 },
  { id: '208', name: 'Denmark',         lat: 56.26,  lon:   9.50 },
  { id: '218', name: 'Ecuador',         lat: -1.83,  lon: -78.18 },
  { id: '818', name: 'Egypt',           lat: 26.82,  lon:  30.80 },
  { id: '231', name: 'Ethiopia',        lat:  9.15,  lon:  40.49 },
  { id: '246', name: 'Finland',         lat: 61.92,  lon:  25.75 },
  { id: '250', name: 'France',          lat: 46.23,  lon:   2.21 },
  { id: '268', name: 'Georgia',         lat: 42.32,  lon:  43.36 },
  { id: '276', name: 'Germany',         lat: 51.17,  lon:  10.45 },
  { id: '288', name: 'Ghana',           lat:  7.95,  lon:  -1.02 },
  { id: '300', name: 'Greece',          lat: 39.07,  lon:  21.82 },
  { id: '320', name: 'Guatemala',       lat: 15.78,  lon: -90.23 },
  { id: '332', name: 'Haiti',           lat: 18.97,  lon: -72.29 },
  { id: '340', name: 'Honduras',        lat: 15.20,  lon: -86.24 },
  { id: '348', name: 'Hungary',         lat: 47.16,  lon:  19.50 },
  { id: '352', name: 'Iceland',         lat: 64.96,  lon: -19.02 },
  { id: '356', name: 'India',           lat: 20.59,  lon:  78.96 },
  { id: '360', name: 'Indonesia',       lat: -0.79,  lon: 113.92 },
  { id: '364', name: 'Iran',            lat: 32.43,  lon:  53.69 },
  { id: '368', name: 'Iraq',            lat: 33.22,  lon:  43.68 },
  { id: '372', name: 'Ireland',         lat: 53.41,  lon:  -8.24 },
  { id: '376', name: 'Israel',          lat: 31.05,  lon:  34.85 },
  { id: '380', name: 'Italy',           lat: 41.87,  lon:  12.57 },
  { id: '392', name: 'Japan',           lat: 36.20,  lon: 138.25 },
  { id: '398', name: 'Kazakhstan',      lat: 48.02,  lon:  66.92 },
  { id: '404', name: 'Kenya',           lat: -0.02,  lon:  37.91 },
  { id: '417', name: 'Kyrgyzstan',      lat: 41.20,  lon:  74.76 },
  { id: '408', name: 'North Korea',     lat: 40.34,  lon: 127.51 },
  { id: '410', name: 'South Korea',     lat: 35.91,  lon: 127.77 },
  { id: '418', name: 'Laos',            lat: 19.86,  lon: 102.50 },
  { id: '434', name: 'Libya',           lat: 26.34,  lon:  17.23 },
  { id: '440', name: 'Lithuania',       lat: 55.17,  lon:  23.88 },
  { id: '484', name: 'Mexico',          lat: 23.63,  lon:-102.55 },
  { id: '496', name: 'Mongolia',        lat: 46.86,  lon: 103.85 },
  { id: '504', name: 'Morocco',         lat: 31.79,  lon:  -7.09 },
  { id: '524', name: 'Nepal',           lat: 28.39,  lon:  84.12 },
  { id: '528', name: 'Netherlands',     lat: 52.13,  lon:   5.29 },
  { id: '554', name: 'New Zealand',     lat:-40.90,  lon: 174.89 },
  { id: '566', name: 'Nigeria',         lat:  9.08,  lon:   8.68 },
  { id: '578', name: 'Norway',          lat: 60.47,  lon:   8.47 },
  { id: '586', name: 'Pakistan',        lat: 30.38,  lon:  69.35 },
  { id: '604', name: 'Peru',            lat: -9.19,  lon: -75.02 },
  { id: '608', name: 'Philippines',     lat: 12.88,  lon: 121.77 },
  { id: '616', name: 'Poland',          lat: 51.92,  lon:  19.15 },
  { id: '620', name: 'Portugal',        lat: 39.40,  lon:  -8.22 },
  { id: '642', name: 'Romania',         lat: 45.94,  lon:  24.97 },
  { id: '643', name: 'Russia',          lat: 61.52,  lon: 105.32 },
  { id: '682', name: 'Saudi Arabia',    lat: 23.89,  lon:  45.08 },
  { id: '710', name: 'South Africa',    lat:-30.56,  lon:  22.94 },
  { id: '724', name: 'Spain',           lat: 40.46,  lon:  -3.75 },
  { id: '762', name: 'Tajikistan',       lat: 38.86,  lon:  71.28 },
  { id: '834', name: 'Tanzania',        lat: -6.37,  lon:  34.89 },
  { id: '752', name: 'Sweden',          lat: 60.13,  lon:  18.64 },
  { id: '756', name: 'Switzerland',     lat: 46.82,  lon:   8.23 },
  { id: '760', name: 'Syria',           lat: 34.80,  lon:  38.99 },
  { id: '764', name: 'Thailand',        lat: 15.87,  lon: 100.99 },
  { id: '792', name: 'Turkey',          lat: 38.96,  lon:  35.24 },
  { id: '804', name: 'Ukraine',         lat: 48.38,  lon:  31.17 },
  { id: '800', name: 'Uganda',          lat:  1.37,  lon:  32.29 },
  { id: '784', name: 'UAE',             lat: 23.42,  lon:  53.85 },
  { id: '826', name: 'United Kingdom',  lat: 55.38,  lon:  -3.44 },
  { id: '840', name: 'United States',   lat: 37.09,  lon: -95.71 },
  { id: '858', name: 'Uruguay',         lat:-32.52,  lon: -55.77 },
  { id: '860', name: 'Uzbekistan',      lat: 41.38,  lon:  64.59 },
  { id: '862', name: 'Venezuela',       lat:  6.42,  lon: -66.59 },
  { id: '704', name: 'Vietnam',         lat: 14.06,  lon: 108.28 },
];

type Country = typeof COUNTRIES[number];

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
}

export function SnowmanNav({ panTo, snowSet }: Props) {
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
    const snowItems = COUNTRIES.filter(c => snowSet.has(c.id) && !historyIds.has(c.id));
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
    setQuery('');
    setSearchOpen(false);
    setActiveIndex(-1);
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
              See where it's snowing right now across 76 countries, updated hourly.
              Pan and zoom the map, or search for a country above.
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
