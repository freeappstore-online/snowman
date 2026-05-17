import { useState, useEffect, useRef } from 'react';
import { geoMercator } from 'd3-geo';

const W = 1000;
const COLS = 10;
const ROWS = 10;

const proj = geoMercator()
  .scale(W / (2 * Math.PI))
  .translate([W / 2, W / 2]);

export interface GridBounds {
  gx0: number; gx1: number;
  gy0: number; gy1: number;
}

export interface GridCell {
  gx: number; gy: number;
  gw: number; gh: number;
  hasSnow: boolean;
}

export function useGridSnow(bounds: GridBounds | null): { cells: GridCell[] } {
  const [cells, setCells] = useState<GridCell[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!bounds) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = window.setTimeout(() => {
      const { gx0, gx1, gy0, gy1 } = bounds;
      const dw = (gx1 - gx0) / COLS;
      const dh = (gy1 - gy0) / ROWS;

      const grid: { gx: number; gy: number; gw: number; gh: number; lat: number; lon: number }[] = [];

      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const gx = gx0 + col * dw;
          const gy = gy0 + row * dh;
          const cx = gx + dw / 2;
          const cy = gy + dh / 2;
          if (cy < 0 || cy > W) continue;

          const normX = ((cx % W) + W) % W;
          const inverted = proj.invert?.([normX, cy]);
          if (!inverted) continue;
          const [lon, lat] = inverted;
          if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 85) continue;

          grid.push({ gx, gy, gw: dw, gh: dh, lat, lon });
        }
      }

      if (!grid.length) return;

      const lats = grid.map(c => c.lat.toFixed(4)).join(',');
      const lons = grid.map(c => c.lon.toFixed(4)).join(',');

      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=snow_depth&forecast_days=1&timezone=auto`
      )
        .then(r => r.ok ? r.json() : Promise.reject())
        .then((data: unknown) => {
          const results: unknown[] = Array.isArray(data) ? data : [data];
          setCells(
            grid.map((cell, i) => ({
              ...cell,
              hasSnow: ((results[i] as { current?: { snow_depth?: number } })?.current?.snow_depth ?? 0) > 0,
            }))
          );
        })
        .catch(() => {});
    }, 600);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [bounds?.gx0, bounds?.gx1, bounds?.gy0, bounds?.gy1]);

  return { cells };
}
