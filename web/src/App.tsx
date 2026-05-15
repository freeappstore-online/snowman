import { useRef } from 'react';
import { Shell } from './components/Shell';
import { WorldMap, type WorldMapHandle } from './components/WorldMap';
import { SnowmanNav } from './components/SnowmanNav';
import { useSnowData } from './hooks/useSnowData';

export default function App() {
  const { snowSet, loading, error, lastUpdated } = useSnowData();
  const mapRef = useRef<WorldMapHandle>(null);

  return (
    <Shell>
      <WorldMap ref={mapRef} snowSet={snowSet} loading={loading} />

      <SnowmanNav
        panTo={(lat, lon, zoom) => mapRef.current?.panTo(lat, lon, zoom)}
        snowSet={snowSet}
      />

      {/* Attribution — bottom center */}
      <div style={{
        position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 100,
        fontSize: '0.65rem', color: '#6b7280', textAlign: 'center', whiteSpace: 'nowrap',
      }}>
        {error
          ? <span style={{ color: '#ef4444' }}>Snow data unavailable</span>
          : lastUpdated
            ? <>Updated {lastUpdated.toLocaleTimeString()}</>
            : loading ? 'Fetching snow data…' : null
        }
      </div>
    </Shell>
  );
}
