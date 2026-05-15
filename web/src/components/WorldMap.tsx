import React, { forwardRef, useImperativeHandle, useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as topojson from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { FeatureCollection, Feature, Polygon, MultiPolygon } from 'geojson';

const WORLD_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json';
const W = 1000;
const MIN_K = 1;
const MAX_K = 40;

function project(lon: number, lat: number): [number, number] {
  const x = ((lon + 180) / 360) * W;
  const c = Math.max(-85.051, Math.min(85.051, lat));
  const r = (c * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * W;
  return [x, y];
}

function ringToD(ring: number[][]): string {
  let path = '';
  let lonOffset = 0;
  for (let i = 0; i < ring.length; i++) {
    const lon = ring[i]![0] ?? 0;
    const lat = ring[i]![1] ?? 0;
    if (i > 0) {
      const prevLon = ring[i - 1]![0] ?? 0;
      const delta = lon - prevLon;
      if (delta > 180) lonOffset -= 360;
      else if (delta < -180) lonOffset += 360;
    }
    const [x, y] = project(lon + lonOffset, lat);
    path += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }
  if (lonOffset !== 0) {
    const bottomY = project(0, -85.051)[1];
    const endX = project((ring[ring.length - 1]?.[0] ?? 0) + lonOffset, 0)[0];
    const startX = project(ring[0]![0] ?? 0, 0)[0];
    path += `L${endX.toFixed(1)},${bottomY.toFixed(1)}`;
    path += `L${startX.toFixed(1)},${bottomY.toFixed(1)}`;
  }
  return path + 'Z';
}

function featureToD(f: Feature<Polygon | MultiPolygon>): string {
  const g = f.geometry;
  if (g.type === 'Polygon') return g.coordinates.map(r => ringToD(r)).join('');
  return g.coordinates.flatMap(p => p.map(r => ringToD(r))).join('');
}

interface XYK { x: number; y: number; k: number }

function computeClip(cW: number, cH: number) {
  if (cW >= cH) {
    const yVis = W * cH / cW;
    return { yTop: (W - yVis) / 2, yBot: (W + yVis) / 2 };
  }
  return { yTop: 0, yBot: W };
}

interface Props {
  snowSet: Set<string>;
  loading: boolean;
}

export interface WorldMapHandle {
  panTo: (lat: number, lon: number, zoom?: number) => void;
}

export const WorldMap = forwardRef<WorldMapHandle, Props>(function WorldMap({ snowSet, loading }, ref) {
  const [countries, setCountries] = useState<FeatureCollection<Polygon | MultiPolygon> | null>(null);
  const [mapError, setMapError] = useState(false);
  const [transform, setTransform] = useState<XYK>({ x: 0, y: 0, k: 1 });
  const [dragging, setDragging] = useState(false);

  const transformRef = useRef<XYK>({ x: 0, y: 0, k: 1 });
  const clipRef = useRef(computeClip(window.innerWidth, window.innerHeight));
  const dragStart = useRef<{ cx: number; cy: number; tx: number; ty: number } | null>(null);
  const pinchRef = useRef<{ dist: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const velocityRef = useRef({ vx: 0, vy: 0 });
  const lastMoveRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const inertiaRafRef = useRef<number | null>(null);

  useEffect(() => {
    const update = () => { clipRef.current = computeClip(window.innerWidth, window.innerHeight); };
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const applyTransform = useCallback((t: XYK) => {
    const k = Math.max(MIN_K, Math.min(MAX_K, t.k));
    const ww = W * k;
    const x = ((t.x % ww) + ww) % ww;
    const { yTop, yBot } = clipRef.current;
    const y = Math.max(yBot - W * k, Math.min(yTop, t.y));
    const norm: XYK = { x, y, k };
    transformRef.current = norm;
    setTransform(norm);
  }, []);

  const clientToSvg = useCallback((cx: number, cy: number): [number, number] => {
    const svg = svgRef.current;
    if (!svg) return [W / 2, W / 2];
    const ctm = svg.getScreenCTM();
    if (!ctm) return [W / 2, W / 2];
    const pt = new DOMPoint(cx, cy).matrixTransform(ctm.inverse());
    return [pt.x, pt.y];
  }, []);

  const svgScale = useCallback((): number => {
    const ctm = svgRef.current?.getScreenCTM();
    return ctm ? ctm.a : 1;
  }, []);

  useImperativeHandle(ref, () => ({
    panTo(lat, lon, zoom = 5) {
      const [svgX, svgY] = project(lon, lat);
      const k = Math.max(MIN_K, Math.min(MAX_K, zoom));
      applyTransform({ x: W / 2 - svgX * k, y: W / 2 - svgY * k, k });
    },
  }), [applyTransform]);

  const cancelInertia = useCallback(() => {
    if (inertiaRafRef.current !== null) {
      cancelAnimationFrame(inertiaRafRef.current);
      inertiaRafRef.current = null;
    }
  }, []);

  const startInertia = useCallback(() => {
    cancelInertia();
    let lastT = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(t - lastT, 50);
      lastT = t;
      const v = velocityRef.current;
      if (Math.hypot(v.vx, v.vy) < 0.0005) return;
      const cur = transformRef.current;
      applyTransform({ k: cur.k, x: cur.x + v.vx * dt, y: cur.y + v.vy * dt });
      const decay = Math.pow(0.995, dt);
      v.vx *= decay;
      v.vy *= decay;
      inertiaRafRef.current = requestAnimationFrame(tick);
    };
    inertiaRafRef.current = requestAnimationFrame(tick);
  }, [cancelInertia, applyTransform]);

  const zoomAt = useCallback((svgX: number, svgY: number, factor: number) => {
    const prev = transformRef.current;
    const newK = Math.max(MIN_K, Math.min(MAX_K, prev.k * factor));
    const ratio = newK / prev.k;
    applyTransform({ x: svgX - (svgX - prev.x) * ratio, y: svgY - (svgY - prev.y) * ratio, k: newK });
  }, [applyTransform]);

  useEffect(() => {
    fetch(WORLD_URL)
      .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<Topology>; })
      .then(topo => {
        const fc = topojson.feature(
          topo,
          topo.objects['countries'] as GeometryCollection<Record<string, unknown>>
        ) as FeatureCollection<Polygon | MultiPolygon>;
        setCountries(fc);
      })
      .catch(() => setMapError(true));
  }, []);

  // Non-passive wheel zoom
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const [sx, sy] = clientToSvg(e.clientX, e.clientY);
      zoomAt(sx, sy, Math.pow(e.ctrlKey ? 1.02 : 1.001, -e.deltaY));
    };
    svg.addEventListener('wheel', handler, { passive: false });
    return () => svg.removeEventListener('wheel', handler);
  }, [zoomAt, clientToSvg]);

  // Non-passive touch handlers (React attaches touch as passive by default)
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      cancelInertia();
      velocityRef.current = { vx: 0, vy: 0 };
      lastMoveRef.current = null;
      if (e.touches.length === 1) {
        const t = transformRef.current;
        dragStart.current = { cx: e.touches[0]!.clientX, cy: e.touches[0]!.clientY, tx: t.x, ty: t.y };
        pinchRef.current = null;
      } else if (e.touches.length === 2) {
        dragStart.current = null;
        const t0 = e.touches[0]!; const t1 = e.touches[1]!;
        const dx = t0.clientX - t1.clientX; const dy = t0.clientY - t1.clientY;
        pinchRef.current = { dist: Math.sqrt(dx * dx + dy * dy) };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const s = svgScale();
      if (e.touches.length === 1 && dragStart.current) {
        const dx = (e.touches[0]!.clientX - dragStart.current.cx) / s;
        const dy = (e.touches[0]!.clientY - dragStart.current.cy) / s;
        applyTransform({ k: transformRef.current.k, x: dragStart.current.tx + dx, y: dragStart.current.ty + dy });
        const now = performance.now();
        const last = lastMoveRef.current;
        if (last) {
          const dt = Math.max(1, now - last.t);
          const vx = (e.touches[0]!.clientX - last.x) / s / dt;
          const vy = (e.touches[0]!.clientY - last.y) / s / dt;
          velocityRef.current.vx = velocityRef.current.vx * 0.6 + vx * 0.4;
          velocityRef.current.vy = velocityRef.current.vy * 0.6 + vy * 0.4;
        }
        lastMoveRef.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY, t: now };
      } else if (e.touches.length === 2 && pinchRef.current) {
        const t0 = e.touches[0]!; const t1 = e.touches[1]!;
        const dx = t0.clientX - t1.clientX; const dy = t0.clientY - t1.clientY;
        const newDist = Math.sqrt(dx * dx + dy * dy);
        const [sx, sy] = clientToSvg((t0.clientX + t1.clientX) / 2, (t0.clientY + t1.clientY) / 2);
        zoomAt(sx, sy, newDist / pinchRef.current.dist);
        pinchRef.current = { dist: newDist };
      }
    };

    svg.addEventListener('touchstart', onTouchStart, { passive: false });
    svg.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      svg.removeEventListener('touchstart', onTouchStart);
      svg.removeEventListener('touchmove', onTouchMove);
    };
  }, [cancelInertia, applyTransform, zoomAt, clientToSvg, svgScale]);

  function onMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    cancelInertia();
    velocityRef.current = { vx: 0, vy: 0 };
    lastMoveRef.current = null;
    const t = transformRef.current;
    dragStart.current = { cx: e.clientX, cy: e.clientY, tx: t.x, ty: t.y };
    setDragging(true);
  }

  function onMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!dragStart.current) return;
    const s = svgScale();
    const dx = (e.clientX - dragStart.current.cx) / s;
    const dy = (e.clientY - dragStart.current.cy) / s;
    applyTransform({ k: transformRef.current.k, x: dragStart.current.tx + dx, y: dragStart.current.ty + dy });
    const now = performance.now();
    const last = lastMoveRef.current;
    if (last) {
      const dt = Math.max(1, now - last.t);
      const vx = (e.clientX - last.x) / s / dt;
      const vy = (e.clientY - last.y) / s / dt;
      velocityRef.current.vx = velocityRef.current.vx * 0.6 + vx * 0.4;
      velocityRef.current.vy = velocityRef.current.vy * 0.6 + vy * 0.4;
    }
    lastMoveRef.current = { x: e.clientX, y: e.clientY, t: now };
  }

  function onMouseUp() {
    if (dragStart.current) startInertia();
    dragStart.current = null;
    lastMoveRef.current = null;
    setDragging(false);
  }

  function onTouchEnd() {
    if (dragStart.current) startInertia();
    dragStart.current = null;
    pinchRef.current = null;
    lastMoveRef.current = null;
  }

  const paths = useMemo(() => {
    if (!countries) return [];
    return countries.features.map((f, i) => {
      const id = String(f.id ?? '').padStart(3, '0');
      return { key: i, id, d: featureToD(f), hasSnow: snowSet.has(id) };
    });
  }, [countries, snowSet]);

  const strokeW = (0.5 / transform.k).toFixed(3);
  const { x: tx, y: ty, k } = transform;

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${W}`}
        preserveAspectRatio="xMidYMid slice"
        style={{
          width: '100%', height: '100%', display: 'block',
          cursor: dragging ? 'grabbing' : 'grab',
          touchAction: 'none', userSelect: 'none',
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchEnd={onTouchEnd}
        aria-label="World snow map"
      >
        <g transform={`translate(${tx.toFixed(2)},${ty.toFixed(2)}) scale(${k.toFixed(4)})`}>
          {([-1, 0, 1] as const).map(offset => (
            <g key={offset} transform={`translate(${offset * W},0)`}>
              {paths.map(({ key, d, hasSnow }) => (
                <path key={`${offset}-${key}`} d={d} fill={hasSnow ? '#4ade80' : '#3f3f46'} stroke="#111" strokeWidth={strokeW} />
              ))}
            </g>
          ))}
        </g>
      </svg>

      {/* Zoom controls — grouped as one pill */}
      <div style={{
        position: 'absolute', bottom: 80, right: 16,
        display: 'flex', flexDirection: 'column',
        background: 'rgba(15,15,15,0.88)',
        border: '1px solid rgba(255,255,255,0.12)', borderRadius: '0.5rem',
        overflow: 'hidden',
      }}>
        {[{ label: '+', f: 1.5, atLimit: k >= MAX_K }, { label: '−', f: 1 / 1.5, atLimit: k <= MIN_K }].map(({ label, f, atLimit }, i) => (
          <React.Fragment key={label}>
            {i === 1 && <div style={{ height: 1, background: 'rgba(255,255,255,0.1)' }} />}
            <button
              onClick={() => {
                const [sx, sy] = clientToSvg(window.innerWidth / 2, window.innerHeight / 2);
                zoomAt(sx, sy, f);
              }}
              disabled={atLimit}
              style={{
                width: 36, height: 36,
                background: 'none', border: 'none',
                color: '#e4e4e7', fontSize: '1.25rem', lineHeight: 1,
                cursor: atLimit ? 'default' : 'pointer',
                opacity: atLimit ? 0.25 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              aria-label={label === '+' ? 'Zoom in' : 'Zoom out'}
            >
              {label}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Legend */}
      <aside style={{
        position: 'absolute', bottom: 16, left: 16,
        background: 'rgba(15,15,15,0.88)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem',
        padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        {[{ color: '#3f3f46', label: 'No snow' }, { color: '#4ade80', label: 'Snow' }].map(({ color, label }) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#a1a1aa' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
            {label}
          </span>
        ))}
      </aside>

      {(!countries || loading) && !mapError && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.55)', pointerEvents: 'none',
        }}>
          <span style={{ color: '#a1a1aa', fontSize: '0.875rem' }}>
            {!countries ? 'Loading map…' : 'Fetching snow data…'}
          </span>
        </div>
      )}

      {mapError && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#f87171' }}>Failed to load map</span>
        </div>
      )}
    </div>
  );
});
