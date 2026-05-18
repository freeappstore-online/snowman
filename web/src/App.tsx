import { useRef, useState, useEffect, useCallback } from 'react';
import { Shell } from './components/Shell';
import { WorldMap, type WorldMapHandle } from './components/WorldMap';
import { SnowmanNav } from './components/SnowmanNav';
import { useSnowData } from './hooks/useSnowData';
import { COUNTRY_BY_ID } from './lib/countries';

function relativeTime(date: Date, now: number): string {
  const secs = Math.floor((now - date.getTime()) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(days / 365);
  if (years > 69) return 'Time travelling?';
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

export default function App() {
  const { snowSet, loading, error, lastUpdated } = useSnowData();
  const mapRef = useRef<WorldMapHandle>(null);
  const [now, setNow] = useState(() => Date.now());
  const [focusedCountry, setFocusedCountry] = useState<{ id: string; name: string; lat: number; lon: number } | null>(null);
  const [wide, setWide] = useState(() => window.innerWidth >= 560);

  useEffect(() => {
    const update = () => setWide(window.innerWidth >= 560);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const handleCountryClick = useCallback((id: string) => {
    const country = COUNTRY_BY_ID.get(id);
    if (!country) return;
    mapRef.current?.panTo(country.lat, country.lon, 5);
    setFocusedCountry({ id: country.id, name: country.name, lat: country.lat, lon: country.lon });
  }, []);

  return (
    <Shell>
      <WorldMap ref={mapRef} snowSet={snowSet} focusedCountry={focusedCountry} onCountryClick={handleCountryClick} onOceanClick={() => setFocusedCountry(null)} />

      <SnowmanNav
        panTo={(lat, lon, zoom) => mapRef.current?.panTo(lat, lon, zoom)}
        snowSet={snowSet}
        onFocusCountry={c => setFocusedCountry(c)}
        focusedCountry={focusedCountry}
      />

      {/* Focused country island — bottom center (desktop) / below nav (mobile) */}
      {focusedCountry && (
        <div
          className="absolute left-1/2 -translate-x-1/2 z-[200] bg-[rgba(10,10,10,0.88)] border border-white/10 rounded-[1.25rem] pl-4 pr-2 py-[0.35rem] flex items-center gap-3 text-[0.8rem] text-[#d4d4d8] whitespace-nowrap"
          style={wide ? { bottom: 16 } : { top: 12 }}
        >
          <span><span className="text-[#9ca3af]">Viewing:</span> {focusedCountry.name}</span>
          <button
            onClick={() => setFocusedCountry(null)}
            className="bg-white/[0.08] border border-white/[0.12] rounded-[0.65rem] text-[#f5f5f5] text-[0.75rem] font-semibold cursor-pointer py-[0.2rem] px-[0.65rem]"
          >
            Done
          </button>
        </div>
      )}

      {/* Attribution — bottom center */}
      {!focusedCountry && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[100] text-[0.65rem] text-[#9ca3af] text-center whitespace-nowrap">
          {error
            ? <span className="text-[#ef4444]">Snow data unavailable</span>
            : lastUpdated
              ? <>Updated {relativeTime(lastUpdated, now)}</>
              : loading ? 'Fetching snow data…' : null
          }
          {!error && <div className="mt-[2px]">World map can make mistakes, check country's snow via searching</div>}
        </div>
      )}
    </Shell>
  );
}
