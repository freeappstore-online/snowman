import { useState, useEffect } from 'react';
import type { Resort } from './useResorts';

const resortCache = new Map<string, boolean>();

export function useResortSnow(countryResorts: Resort[], focusedCountryId: string | null) {
  const [snowMap, setSnowMap] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (!focusedCountryId || countryResorts.length === 0) {
      setSnowMap(new Map());
      return;
    }

    const toFetch = countryResorts.filter(r => !resortCache.has(r.id));
    const merged = new Map<string, boolean>();
    countryResorts.forEach(r => { if (resortCache.has(r.id)) merged.set(r.id, resortCache.get(r.id)!); });

    if (toFetch.length === 0) { setSnowMap(merged); return; }
    setSnowMap(new Map(merged));

    const ctrl = new AbortController();
    const chunks: Resort[][] = [];
    for (let i = 0; i < toFetch.length; i += 100) chunks.push(toFetch.slice(i, i + 100));

    (async () => {
      try {
        for (const batch of chunks) {
          if (ctrl.signal.aborted) return;
          const lats = batch.map(r => r.lat.toFixed(4)).join(',');
          const lons = batch.map(r => r.lon.toFixed(4)).join(',');
          const r = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=snow_depth&forecast_days=1&timezone=auto`,
            { signal: ctrl.signal }
          );
          if (!r.ok) continue;
          const data = await r.json();
          const results = Array.isArray(data) ? data : [data];
          batch.forEach((resort, i) => {
            const hasSnow = ((results[i] as any)?.current?.snow_depth ?? 0) > 0;
            resortCache.set(resort.id, hasSnow);
            merged.set(resort.id, hasSnow);
          });
          setSnowMap(new Map(merged));
          await new Promise(res => setTimeout(res, 250));
        }
      } catch {}
    })();
    return () => ctrl.abort();
  }, [countryResorts, focusedCountryId]);

  return snowMap;
}
