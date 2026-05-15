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

const CLUSTER_DEG = 1.5;

export function useStateSnow(visibleStates: StateMeta[], focusedCountryId: string | null) {
  const [snowMap, setSnowMap] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(false);

  // Clear in-memory cache whenever the focused country changes so every search queries fresh
  useEffect(() => {
    resultCache.clear();
    setSnowMap(new Map());
  }, [focusedCountryId]);

  useEffect(() => {
    if (visibleStates.length === 0) return;

    // Cluster visible states into CLUSTER_DEG° grid cells
    const clusters = new Map<string, StateMeta[]>();
    for (const s of visibleStates) {
      const key = `${Math.round(s.lon / CLUSTER_DEG)},${Math.round(s.lat / CLUSTER_DEG)}`;
      if (!clusters.has(key)) clusters.set(key, []);
      clusters.get(key)!.push(s);
    }

    const toFetch: StateMeta[] = [];
    const repToGroup = new Map<string, string[]>();
    const merged = new Map<string, boolean>();

    for (const group of clusters.values()) {
      const rep = group.reduce((best, s) =>
        Math.abs(s.lat) > Math.abs(best.lat) ? s : best
      );
      repToGroup.set(rep.id, group.map(s => s.id));

      let allCached = true;
      for (const s of group) {
        if (resultCache.has(s.id)) {
          merged.set(s.id, resultCache.get(s.id)!);
        } else {
          allCached = false;
        }
      }

      if (!allCached && !resultCache.has(rep.id)) {
        toFetch.push(rep);
      }
    }

    const batch = toFetch.slice(0, 30);

    if (batch.length === 0) {
      setSnowMap(merged);
      return;
    }

    setLoading(true);
    setSnowMap(new Map(merged));

    const ctrl = new AbortController();
    const lats = batch.map(s => s.lat.toFixed(4)).join(',');
    const lons = batch.map(s => s.lon.toFixed(4)).join(',');

    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=snow_depth&forecast_days=1&timezone=auto`,
      { signal: ctrl.signal }
    )
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then((data: unknown) => {
        const results = Array.isArray(data) ? data : [data];
        const updated = new Map<string, boolean>(merged);
        const newEntries: Array<[string, boolean]> = [];
        batch.forEach((rep, i) => {
          const hasSnow = ((results[i] as { current?: { snow_depth?: number } })?.current?.snow_depth ?? 0) > 0;
          for (const id of repToGroup.get(rep.id) ?? []) {
            resultCache.set(id, hasSnow);
            updated.set(id, hasSnow);
            newEntries.push([id, hasSnow]);
          }
        });
        persistEntries(newEntries);
        setSnowMap(updated);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => { ctrl.abort(); setLoading(false); };
  }, [visibleStates]);

  return { snowMap, loading };
}
