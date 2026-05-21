import { useState, useEffect } from 'react';
import { geoContains, geoBounds } from 'd3-geo';

export interface Resort { id: string; name: string; lat: number; lon: number; }

type ResortTuple = [string, string, number, number];

let globalResortsCache: Resort[] | null = null;

const fetchPromise: Promise<Resort[]> = fetch('/ski_resorts.json')
  .then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<ResortTuple[]>;
  })
  .then(data => {
    globalResortsCache = data.map(([id, name, lat, lon]) => ({ id, name, lat, lon }));
    return globalResortsCache;
  })
  .catch(err => {
    console.error('Failed to load ski resorts:', err);
    globalResortsCache = [];
    return [];
  });

export function getResorts(): Promise<Resort[]> { return fetchPromise; }

export function useResorts(focusedCountryFeature: any | null) {
  const [countryResorts, setCountryResorts] = useState<Resort[]>([]);

  useEffect(() => {
    if (!focusedCountryFeature) {
      setCountryResorts([]);
      return;
    }

    async function filterResorts() {
      if (!globalResortsCache) await fetchPromise;
      if (!globalResortsCache?.length || !focusedCountryFeature.geometry) return;

      // Compute bounding box — geoBounds returns [[west,south],[east,north]].
      // west > east means the feature crosses the antimeridian (Russia, NZ, Kiribati, US, etc.)
      let west = -180, south = -90, east = 180, north = 90, crossesAntimeridian = false;
      try {
        [[west, south], [east, north]] = geoBounds(focusedCountryFeature);
        crossesAntimeridian = west > east;
      } catch {
        // fallback: no pre-filter, just run geoContains on everything
      }

      const filtered = globalResortsCache.filter(r => {
        // Latitude is always a simple range check
        if (r.lat < south || r.lat > north) return false;
        // Longitude: for antimeridian-crossing features, valid = lon>=west OR lon<=east
        if (crossesAntimeridian) {
          if (r.lon < west && r.lon > east) return false;
        } else {
          if (r.lon < west || r.lon > east) return false;
        }
        try {
          return geoContains(focusedCountryFeature, [r.lon, r.lat]);
        } catch {
          return false;
        }
      });
      setCountryResorts(filtered);
    }
    filterResorts();
  }, [focusedCountryFeature]);

  return countryResorts;
}
