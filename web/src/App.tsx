import { useRef, useState, useEffect } from 'react';
import { Shell } from './components/Shell';
import { WorldMap, type WorldMapHandle } from './components/WorldMap';
import { SnowmanNav } from './components/SnowmanNav';
import { useSnowData } from './hooks/useSnowData';

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

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <Shell>
      <WorldMap ref={mapRef} snowSet={snowSet} loading={loading} focusedCountry={focusedCountry} onClearFocus={() => setFocusedCountry(null)} />

      <SnowmanNav
        panTo={(lat, lon, zoom) => mapRef.current?.panTo(lat, lon, zoom)}
        snowSet={snowSet}
        onFocusCountry={c => setFocusedCountry(c)}
      />

      {/* Focused country island — bottom center */}
      {focusedCountry && (
        <div style={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 200,
          background: 'rgba(10,10,10,0.88)', border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: '1.25rem', padding: '0.35rem 0.5rem 0.35rem 1rem',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          fontSize: '0.8rem', color: '#d4d4d8', whiteSpace: 'nowrap',
        }}>
          <span><span style={{ color: '#6b7280' }}>Viewing:</span> {focusedCountry.name}</span>
          <button
            onClick={() => setFocusedCountry(null)}
            style={{
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '0.65rem', color: '#f5f5f5', fontSize: '0.75rem', fontWeight: 600,
              cursor: 'pointer', padding: '0.2rem 0.65rem',
            }}
          >
            Done
          </button>
        </div>
      )}

      {/* Attribution — bottom center */}
      {!focusedCountry && (
        <div style={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 100,
          fontSize: '0.65rem', color: '#6b7280', textAlign: 'center', whiteSpace: 'nowrap',
        }}>
          {error
            ? <span style={{ color: '#ef4444' }}>Snow data unavailable</span>
            : lastUpdated
              ? <>Updated {relativeTime(lastUpdated, now)}</>
              : loading ? 'Fetching snow data…' : null
          }
        </div>
      )}
    </Shell>
  );
}
