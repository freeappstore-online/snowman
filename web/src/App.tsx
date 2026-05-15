import { Shell } from './components/Shell';
import { WorldMap } from './components/WorldMap';
import { useSnowData } from './hooks/useSnowData';

const glass: React.CSSProperties = {
  background: 'rgba(10,10,10,0.72)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '1.25rem',
};

export default function App() {
  const { snowSet, loading, error, lastUpdated } = useSnowData();

  return (
    <Shell>
      {/* Full-screen map */}
      <WorldMap snowSet={snowSet} loading={loading} />

      {/* Floating title card — top left, below nav */}
      <div
        style={{
          ...glass,
          position: 'absolute',
          top: 68,
          left: 16,
          zIndex: 100,
          padding: '0.75rem 1rem',
          maxWidth: 220,
        }}
      >
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.4rem', fontWeight: 800, margin: '0 0 0.2rem', color: '#f5f5f5', lineHeight: 1.1 }}>
          Snowman
        </h1>
        <p style={{ margin: 0, fontSize: '0.78rem', color: '#9ca3af', lineHeight: 1.4 }}>
          Where is it snowing right now?
        </p>
        {!loading && !error && (
          <p style={{ margin: '0.4rem 0 0', fontSize: '0.68rem', color: '#6b7280' }}>
            Drag to pan · scroll to zoom
          </p>
        )}
      </div>

      {/* Attribution — bottom right above zoom buttons */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          zIndex: 100,
          fontSize: '0.65rem',
          color: '#6b7280',
          textAlign: 'right',
          lineHeight: 1.4,
        }}
      >
        {error
          ? <span style={{ color: '#ef4444' }}>Snow data unavailable</span>
          : lastUpdated
            ? <>Snow depth: <a href="https://open-meteo.com" style={{ color: '#6b7280' }}>Open-Meteo</a><br />Updated {lastUpdated.toLocaleTimeString()}</>
            : loading ? 'Fetching snow data…' : null
        }
      </div>
    </Shell>
  );
}
