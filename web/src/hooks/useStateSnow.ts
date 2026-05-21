import { useState, useEffect } from 'react';

export interface StateMeta {
  id: string;
  lat: number;
  lon: number;
}

const STORAGE_KEY = 'snowman_cache_v1';
const TTL_MS = 60 * 1000; // 1 minute

type CacheEntry = { v: boolean; t: number };

const resultCache = new Map<string, boolean>();

// Load valid (non-expired) entries from localStorage on module init
function loadStoredCache(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const store = JSON.parse(raw) as Record<string, CacheEntry>;
    const now = Date.now();
    for (const [id, { v, t }] of Object.entries(store)) {
      if (now - t < TTL_MS) resultCache.set(id, v);
    }
  } catch {}
}

// Persist new entries to localStorage and prune expired ones
function persistEntries(newEntries: Array<[string, boolean]>): void {
  try {
    const now = Date.now();
    const raw = localStorage.getItem(STORAGE_KEY);
    const store: Record<string, CacheEntry> = raw ? JSON.parse(raw) as Record<string, CacheEntry> : {};
    for (const [id, v] of newEntries) {
      store[id] = { v, t: now };
    }
    // Prune expired entries so localStorage doesn't grow unbounded
    for (const id of Object.keys(store)) {
      if (now - store[id]!.t >= TTL_MS) delete store[id];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

loadStoredCache();

export function useStateSnow(visibleStates: StateMeta[], focusedCountryId: string | null) {
  const [snowMap, setSnowMap] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Clear in-memory cache whenever the focused country changes so every search queries fresh
  useEffect(() => {
    resultCache.clear();
    setSnowMap(new Map());
    setError(false);
  }, [focusedCountryId]);

  useEffect(() => {
    if (visibleStates.length === 0) return;

    const toFetch: StateMeta[] = [];
    const merged = new Map<string, boolean>();

    for (const s of visibleStates) {
      if (resultCache.has(s.id)) {
        merged.set(s.id, resultCache.get(s.id)!);
      } else {
        toFetch.push(s);
      }
    }

    if (toFetch.length === 0) {
      setSnowMap(merged);
      return;
    }

    setLoading(true);
    setSnowMap(new Map(merged));

    const ctrl = new AbortController();

    const chunkSize = 100; // open-meteo supports up to 100 locations per request
    const chunks: StateMeta[][] = [];
    for (let i = 0; i < toFetch.length; i += chunkSize) {
      chunks.push(toFetch.slice(i, i + chunkSize));
    }

    (async () => {
      const resultsArray: Array<{ batch: StateMeta[]; data: unknown }> = [];
      try {
        for (const batch of chunks) {
          if (ctrl.signal.aborted) return;

          const lats = batch.map(s => s.lat.toFixed(4)).join(',');
          const lons = batch.map(s => s.lon.toFixed(4)).join(',');

          const r = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=snow_depth&forecast_days=1&timezone=auto`,
            { signal: ctrl.signal }
          );

          if (!r.ok) throw new Error(`${r.status}`);
          const data = await r.json();
          resultsArray.push({ batch, data });

          // 250 ms delay between chunks to prevent Open-Meteo 429 errors
          await new Promise(resolve => setTimeout(resolve, 250));
        }

        if (ctrl.signal.aborted) return;

        const updated = new Map<string, boolean>(merged);
        const newEntries: Array<[string, boolean]> = [];
        resultsArray.forEach(({ batch, data }) => {
          const results = Array.isArray(data) ? data : [data];
          batch.forEach((s, i) => {
            const hasSnow = ((results[i] as { current?: { snow_depth?: number } })?.current?.snow_depth ?? 0) > 0;
            resultCache.set(s.id, hasSnow);
            updated.set(s.id, hasSnow);
            newEntries.push([s.id, hasSnow]);
          });
        });
        persistEntries(newEntries);
        setSnowMap(updated);
      } catch (e) {
        if (!ctrl.signal.aborted) setError(true);
        void e;
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();

    return () => { ctrl.abort(); setLoading(false); };
  }, [visibleStates]);

  return { snowMap, loading, error };
}
