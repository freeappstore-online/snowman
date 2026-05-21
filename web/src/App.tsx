import { useRef, useState, useEffect, useCallback } from 'react';
import { Shell } from './components/Shell';
import { WorldMap, type WorldMapHandle } from './components/WorldMap';
import { SnowmanNav } from './components/SnowmanNav';
import { COUNTRY_BY_ID } from './lib/countries';

const EMPTY_SNOW_SET = new Set<string>();
const EMPTY_QUERY_SET = new Set<string>();

const STATE_COUNTRIES = new Set(['036','076','356','484','566','840','862']);
const PROVINCE_COUNTRIES = new Set(['032','056','124','156','192','360','364','368','528','586','608','682','704','710','764','792']);

function subdivisionLabel(countryId: string | undefined) {
  if (!countryId) return 'state/province';
  if (STATE_COUNTRIES.has(countryId)) return 'state';
  if (PROVINCE_COUNTRIES.has(countryId)) return 'province';
  return 'state/province';
}

export default function App() {
  const mapRef = useRef<WorldMapHandle>(null);
  const [focusedCountry, setFocusedCountry] = useState<{ id: string; name: string; lat: number; lon: number } | null>(null);
  const [focusedState, setFocusedState] = useState<{ stateId: string; name: string } | null>(null);
  const [queryingCountries, setQueryingCountries] = useState<Set<string>>(EMPTY_QUERY_SET);
  const [fadingCountries,   setFadingCountries]   = useState<Set<string>>(EMPTY_QUERY_SET);
  const prevQueryingRef = useRef<Set<string>>(EMPTY_QUERY_SET);
  const [wide, setWide] = useState(() => window.innerWidth >= 560);
  const [snowFetchError, setSnowFetchError] = useState(false);

  const handleQueryingCountries = useCallback((newIds: Set<string>) => {
    const prev = prevQueryingRef.current;
    prevQueryingRef.current = newIds;
    setQueryingCountries(newIds);
    // Countries leaving the active set fade out over 650ms then disappear
    const dequeued = new Set([...prev].filter(id => !newIds.has(id)));
    if (dequeued.size > 0) {
      setFadingCountries(f => new Set([...f, ...dequeued]));
      setTimeout(() => setFadingCountries(f => {
        const next = new Set(f);
        dequeued.forEach(id => next.delete(id));
        return next;
      }), 700);
    }
  }, []);

  useEffect(() => {
    const update = () => setWide(window.innerWidth >= 560);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const handleCountryClick = useCallback((id: string) => {
    const country = COUNTRY_BY_ID.get(id);
    if (!country) return;
    mapRef.current?.fitToCountry(country.id);
    setFocusedCountry({ id: country.id, name: country.name, lat: country.lat, lon: country.lon });
    setFocusedState(null);
  }, []);

  return (
    <Shell>
      <WorldMap
        ref={mapRef}
        snowSet={EMPTY_SNOW_SET}
        queryingCountries={queryingCountries}
        fadingCountries={fadingCountries}
        focusedCountry={focusedCountry}
        focusedState={focusedState}
        onCountryClick={handleCountryClick}
        onStateClick={(stateId, name) => {
          if (focusedState?.stateId === stateId) { setFocusedState(null); return; }
          setFocusedState({ stateId, name });
        }}
        onOceanClick={() => {
          if (focusedState) { setFocusedState(null); setFocusedCountry(null); return; }
          setFocusedCountry(null);
        }}
        onSnowError={() => setSnowFetchError(true)}
        onSnowLoad={() => setSnowFetchError(false)}
      />

      <SnowmanNav
        panTo={(lat, lon, zoom) => mapRef.current?.panTo(lat, lon, zoom)}
        fitToCountry={(id) => mapRef.current?.fitToCountry(id)}
        snowSet={EMPTY_SNOW_SET}
        onFocusCountry={c => { setFocusedCountry(c); setFocusedState(null); }}
        focusedCountry={focusedCountry}
        onQueryingCountries={handleQueryingCountries}
      />

      {/* Focused country island */}
      {focusedCountry && (
        <div
          className="absolute left-1/2 -translate-x-1/2 z-[200] bg-[rgba(10,10,10,0.88)] border border-white/10 rounded-[1.25rem] pl-4 pr-2 py-[0.45rem] flex items-center gap-3 text-[0.8rem] text-[#d4d4d8] w-max max-w-[calc(100vw-2rem)]"
          style={wide ? { bottom: 16 } : { top: 12 }}
        >
          <div className="flex flex-col gap-[2px] min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-1">
              <span className="text-[#9ca3af] shrink-0">Viewing:</span>
              {focusedState
                ? <span><span className="text-[#f5f5f5] font-medium">{focusedState.name}</span>, {focusedCountry.name}</span>
                : <span>{focusedCountry.name}</span>
              }
            </div>
            {focusedState ? (
              <span className="text-[0.68rem] text-[#6b7280]">
                Tap the selected {subdivisionLabel(focusedCountry?.id)} again to return to country view
              </span>
            ) : (
              <span className="text-[0.68rem] text-[#6b7280]">
                Click a {subdivisionLabel(focusedCountry?.id)} to see snow resorts
              </span>
            )}
          </div>
          <button
            onClick={() => { if (focusedState) { setFocusedState(null); } else { setFocusedCountry(null); } }}
            className="bg-white/[0.08] border border-white/[0.12] rounded-[0.65rem] text-[#f5f5f5] text-[0.75rem] font-semibold cursor-pointer py-[0.2rem] px-[0.65rem] shrink-0"
          >
            Done
          </button>
        </div>
      )}

      {/* World-view tip */}
      {!focusedCountry && (
        <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-[100] text-[0.65rem] text-center w-[min(90vw,320px)] ${snowFetchError ? 'text-[#f87171]' : 'text-[#9ca3af]'}`}>
          {snowFetchError ? 'Failed to fetch snow data, please try again later' : 'Click or search a country to view snow'}
        </div>
      )}
    </Shell>
  );
}
