import React, { forwardRef, useImperativeHandle, useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as topojson from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { FeatureCollection, Feature, Polygon, MultiPolygon } from 'geojson';
import { geoMercator, geoPath } from 'd3-geo';
import { useStateSnow } from '../hooks/useStateSnow';
import { SAMPLE_POINTS } from '../hooks/useSnowData';
import { useResorts } from '../hooks/useResorts';
import { COUNTRY_BY_ID, COUNTRY_EXTENT_POINTS } from '../lib/countries';

const SNOW_SAMPLE: Record<string, { lat: number; lon: number }> = Object.fromEntries(
  SAMPLE_POINTS.map(([id, lat, lon]) => [id, { lat, lon }])
);

const WORLD_URL  = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json';
const STATES_URL = '/states.json';
const W = 1000;
const MIN_K = 1;
const MAX_K = 150;
const MIN_FETCH_K = 2.0; // pre-load states.json before any threshold is hit


// Maps adm0_a3 (3-letter Natural Earth code) → numeric ISO used in snowSet / COUNTRIES
const ADM0_TO_NUMERIC: Record<string, string> = {
  ABW: '533', AFG: '004', AGO: '024', AIA: '660', ALA: '248', ALB: '008',
  AND: '020', ARE: '784', ARG: '032', ARM: '051', ASM: '016', ATA: '010',
  ATF: '260', ATG: '028', AUS: '036', AUT: '040', AZE: '031', BDI: '108',
  BEL: '056', BEN: '204', BES: '535', BFA: '854', BGD: '050', BGR: '100',
  BHR: '048', BHS: '044', BIH: '070', BLM: '652', BLR: '112', BLZ: '084',
  BMU: '060', BOL: '068', BRA: '076', BRB: '052', BRN: '096', BTN: '064',
  BVT: '074', BWA: '072', CAF: '140', CAN: '124', CCK: '166', CHE: '756',
  CHL: '152', CHN: '156', CIV: '384', CMR: '120', COD: '180', COG: '178',
  COK: '184', COL: '170', COM: '174', CPV: '132', CRI: '188', CUB: '192',
  CUW: '531', CXR: '162', CYM: '136', CYP: '196', CZE: '203', DEU: '276',
  DJI: '262', DMA: '212', DNK: '208', DOM: '214', DZA: '012', ECU: '218',
  EGY: '818', ERI: '232', ESH: '732', ESP: '724', EST: '233', ETH: '231',
  FIN: '246', FJI: '242', FLK: '238', FRA: '250', FRO: '234', FSM: '583',
  GAB: '266', GBR: '826', GEO: '268', GGY: '831', GHA: '288', GIB: '292',
  GIN: '324', GLP: '312', GMB: '270', GNB: '624', GNQ: '226', GRC: '300',
  GRD: '308', GRL: '304', GTM: '320', GUF: '254', GUM: '316', GUY: '328',
  HKG: '344', HMD: '334', HND: '340', HRV: '191', HTI: '332', HUN: '348',
  IDN: '360', IMN: '833', IND: '356', IOT: '086', IRL: '372', IRN: '364',
  IRQ: '368', ISL: '352', ISR: '376', ITA: '380', JAM: '388', JEY: '832',
  JOR: '400', JPN: '392', KAZ: '398', KEN: '404', KGZ: '417', KHM: '116',
  KIR: '296', KNA: '659', KOR: '410', KWT: '414', LAO: '418', LBN: '422',
  LBR: '430', LBY: '434', LCA: '662', LIE: '438', LKA: '144', LSO: '426',
  LTU: '440', LUX: '442', LVA: '428', MAC: '446', MAF: '663', MAR: '504',
  MCO: '492', MDA: '498', MDG: '450', MDV: '462', MEX: '484', MHL: '584',
  MKD: '807', MLI: '466', MLT: '470', MMR: '104', MNE: '499', MNG: '496',
  MNP: '580', MOZ: '508', MRT: '478', MSR: '500', MTQ: '474', MUS: '480',
  MWI: '454', MYS: '458', MYT: '175', NAM: '516', NCL: '540', NER: '562',
  NFK: '574', NGA: '566', NIC: '558', NIU: '570', NLD: '528', NOR: '578',
  NPL: '524', NRU: '520', NZL: '554', OMN: '512', PAK: '586', PAN: '591',
  PCN: '612', PER: '604', PHL: '608', PLW: '585', PNG: '598', POL: '616',
  PRI: '630', PRK: '408', PRT: '620', PRY: '600', PSE: '275', PYF: '258',
  QAT: '634', REU: '638', ROU: '642', RUS: '643', RWA: '646', SAU: '682',
  SDN: '729', SEN: '686', SGP: '702', SGS: '239', SHN: '654', SJM: '744',
  SLB: '090', SLE: '694', SLV: '222', SMR: '674', SOM: '706', SPM: '666',
  SRB: '688', SSD: '728', STP: '678', SUR: '740', SVK: '703', SVN: '705',
  SWE: '752', SWZ: '748', SXM: '534', SYC: '690', SYR: '760', TCA: '796',
  TCD: '148', TGO: '768', THA: '764', TJK: '762', TKL: '772', TKM: '795',
  TLS: '626', TON: '776', TTO: '780', TUN: '788', TUR: '792', TUV: '798',
  TWN: '158', TZA: '834', UGA: '800', UKR: '804', UMI: '581', URY: '858',
  USA: '840', UZB: '860', VAT: '336', VCT: '670', VEN: '862', VGB: '092',
  VIR: '850', VNM: '704', VUT: '548', WLF: '876', WSM: '882', XKX: '383',
  YEM: '887', ZAF: '710', ZMB: '894', ZWE: '716',
};

// ─── Memoized fill layer — skipped entirely during pan/zoom ───────────────
interface FillLayerProps {
  paths: Array<{ key: number; id: string; d: string }>;
  borders: string;
  stage: number;
  snowSet: Set<string>;
  queryingCountries: Set<string>;
  fadingCountries: Set<string>;
  onCountryClick?: (id: string) => void;
  mouseDownOnMap: React.MutableRefObject<boolean>;
  didDragRef: React.MutableRefObject<boolean>;
}

const FillLayer = React.memo(function FillLayer({
  paths, borders, stage, snowSet, queryingCountries, fadingCountries, onCountryClick, mouseDownOnMap, didDragRef,
}: FillLayerProps) {
  return (
    <>
      {([-1, 0, 1] as const).map(offset => (
        <g key={offset} transform={`translate(${offset * W},0)`}>
          {paths.map(({ key, d, id }) => {
            const querying = stage === 1 && queryingCountries.has(id);
            const fading  = stage === 1 && !querying && fadingCountries.has(id);
            return (
              <path
                key={`${offset}-${key}`}
                d={d}
                fill={stage === 1 && snowSet.has(id) ? '#4ade80' : '#3f3f46'}
                fillOpacity={stage === 1 ? 1 : 0.22}
                stroke="none"
                vectorEffect="non-scaling-stroke"
                className={`cursor-pointer country-path${querying ? ' country-scanning' : fading ? ' country-fading' : ''}`}
                onMouseUp={() => { if (mouseDownOnMap.current && !didDragRef.current && onCountryClick) onCountryClick(id); }}
                onTouchEnd={(e) => { if (!didDragRef.current && onCountryClick) { e.preventDefault(); onCountryClick(id); } }}
              />
            );
          })}
          {stage === 1 && borders && (
            <path d={borders} fill="none" stroke="#111" strokeWidth={0.5} vectorEffect="non-scaling-stroke" className="pointer-events-none" />
          )}
        </g>
      ))}
    </>
  );
});

// ─── Projection helpers ────────────────────────────────────────────────────
const projection = geoMercator()
  .scale(W / (2 * Math.PI))
  .translate([W / 2, W / 2]);

const pathGenerator = geoPath().projection(projection);

function featureToD(f: Feature<Polygon | MultiPolygon>): string {
  return pathGenerator(f as Parameters<typeof pathGenerator>[0]) || '';
}

function project(lon: number, lat: number): [number, number] {
  const pt = projection([lon, lat]);
  return pt ?? [W / 2, W / 2];
}

// ─── Types ────────────────────────────────────────────────────────────────
interface XYK { x: number; y: number; k: number }

interface StateProperties { a: string; n: string; t: number; g: number }
type StateFeature = Feature<Polygon | MultiPolygon, StateProperties>;

function computeClip(cW: number, cH: number) {
  if (cW >= cH) {
    const yVis = W * cH / cW;
    return { yTop: (W - yVis) / 2, yBot: (W + yVis) / 2 };
  }
  return { yTop: 0, yBot: W };
}

interface FocusedCountry { id: string; name: string; lat: number; lon: number }

const CLUSTER_RADIUS = 20; // screen pixels at which resorts merge into a cluster

interface ClusteredPoint {
  id: string; x: number; y: number;
  count: number; name: string;
  spanX: number; spanY: number; // bounding box of member resorts — used to compute break-apart zoom
}

interface Props {
  snowSet: Set<string>;
  queryingCountries: Set<string>;
  fadingCountries: Set<string>;
  focusedCountry: FocusedCountry | null;
  focusedState: { stateId: string; name: string } | null;
  onCountryClick?: (id: string) => void;
  onStateClick?: (stateId: string, name: string) => void;
  onOceanClick?: () => void;
  onSnowError?: () => void;
  onSnowLoad?: () => void;
}

export interface WorldMapHandle {
  panTo: (lat: number, lon: number, zoom?: number) => void;
  fitToCountry: (id: string) => void;
}

export const WorldMap = forwardRef<WorldMapHandle, Props>(function WorldMap({ snowSet, queryingCountries, fadingCountries, focusedCountry, focusedState, onCountryClick, onStateClick, onOceanClick, onSnowError, onSnowLoad }, ref) {
  const focusedCountryId = focusedCountry?.id ?? null;
  const [countries,  setCountries]  = useState<FeatureCollection<Polygon | MultiPolygon> | null>(null);
  const [borders,    setBorders]    = useState<string>('');
  const [statesData, setStatesData] = useState<FeatureCollection<Polygon | MultiPolygon, StateProperties> | null>(null);
  const [mapError,   setMapError]   = useState(false);
  const [transform,  setTransform]  = useState<XYK>({ x: 0, y: 0, k: 1 });
  const [dragging,   setDragging]   = useState(false);
  const [wide,       setWide]       = useState(() => window.innerWidth >= 560);
  const [wider370,   setWider370]   = useState(() => window.innerWidth >= 370);

  const transformRef = useRef<XYK>({ x: 0, y: 0, k: 1 });
  const clipRef      = useRef(computeClip(window.innerWidth, window.innerHeight));
  const dragStart       = useRef<{ cx: number; cy: number; tx: number; ty: number } | null>(null);
  const mouseDownOnMap  = useRef(false);
  const pinchRef     = useRef<{ dist: number } | null>(null);
  const svgRef       = useRef<SVGSVGElement>(null);
  const velocityRef  = useRef({ vx: 0, vy: 0 });
  const lastMoveRef  = useRef<{ x: number; y: number; t: number } | null>(null);
  const inertiaRafRef   = useRef<number | null>(null);
const didDragRef      = useRef(false);
  const statesLoadedRef = useRef(false);
  const mapGroupRef     = useRef<SVGGElement>(null);
  const resortsLayerRef = useRef<SVGGElement>(null);
  const rafSyncRef      = useRef<number | null>(null);

  // ── Resize ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const update = () => {
      clipRef.current = computeClip(window.innerWidth, window.innerHeight);
      setWide(window.innerWidth >= 560);
      setWider370(window.innerWidth >= 370);
    };
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // ── Load country data ────────────────────────────────────────────────────
  useEffect(() => {
    fetch(WORLD_URL)
      .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<Topology>; })
      .then(topo => {
        const fc = topojson.feature(
          topo,
          topo.objects['countries'] as GeometryCollection<Record<string, unknown>>
        ) as FeatureCollection<Polygon | MultiPolygon>;
        setCountries(fc);
        const mesh = topojson.mesh(
          topo,
          topo.objects['countries'] as GeometryCollection<Record<string, unknown>>,
          (a, b) => a !== b
        );
        setBorders(pathGenerator(mesh as Parameters<typeof pathGenerator>[0]) || '');
      })
      .catch(() => setMapError(true));
  }, []);

  // ── Lazy-load state/province data ────────────────────────────────────────
  useEffect(() => {
    if (transform.k < MIN_FETCH_K || statesLoadedRef.current) return;
    statesLoadedRef.current = true;
    fetch(STATES_URL)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((topo: Topology) => {
        const key = (Object.keys(topo.objects) as string[])[0] ?? 'states';
        const fc = topojson.feature(
          topo,
          topo.objects[key] as GeometryCollection<Record<string, unknown>>
        ) as unknown as FeatureCollection<Polygon | MultiPolygon, StateProperties>;
        setStatesData(fc);
      })
      .catch(err => console.error('[states] failed to load:', err));
  }, [transform.k]);

  // ── Pan/zoom helpers ─────────────────────────────────────────────────────
  const applyTransform = useCallback((t: XYK) => {
    const k = Math.max(MIN_K, Math.min(MAX_K, t.k));
    const ww = W * k;

    // Center the modulo wrap so the teleport happens before exposing blank edges
    const half = ww / 2;
    const x = ((((t.x + half) % ww) + ww) % ww) - half;

    const { yTop, yBot } = clipRef.current;
    const y = Math.max(yBot - W * k, Math.min(yTop, t.y));
    const norm: XYK = { x, y, k };
    const prevK = transformRef.current.k;
    transformRef.current = norm;

    if (mapGroupRef.current) {
      // translate3d forces GPU compositing; transformOrigin 0 0 prevents bounding-box drift
      mapGroupRef.current.removeAttribute('transform');
      mapGroupRef.current.style.transformOrigin = '0 0';
      mapGroupRef.current.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${k.toFixed(4)})`;
    }

    if (resortsLayerRef.current) {
      resortsLayerRef.current.querySelectorAll('circle').forEach(c => {
        const base = parseFloat(c.getAttribute('data-base-r') ?? '5');
        c.setAttribute('r', (base / k).toFixed(3));
      });
    }

    // Immediately sync state when hitting zoom limits (keeps +/− buttons accurate)
    const atMin = k <= MIN_K;
    const atMax = k >= MAX_K;
    const wasMin = prevK <= MIN_K;
    const wasMax = prevK >= MAX_K;
    if (atMin !== wasMin || atMax !== wasMax) {
      if (rafSyncRef.current) { cancelAnimationFrame(rafSyncRef.current); rafSyncRef.current = null; }
      setTransform(norm);
      return;
    }

    // Throttle transform state (pan/cull) to one RAF per frame — keeps viewport culling live
    if (!rafSyncRef.current) {
      rafSyncRef.current = requestAnimationFrame(() => {
        rafSyncRef.current = null;
        setTransform({ ...transformRef.current });
      });
    }

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
    fitToCountry(id: string) {
      const c = COUNTRY_BY_ID.get(id);
      if (!c) return;

      const [cx, cy] = project(c.lon, c.lat);
      let k = 5;

      const extents = COUNTRY_EXTENT_POINTS.get(id);
      if (extents && extents.length > 0) {
        // Large/antimeridian countries: measure spread from extent points, bypassing D3's wrap bug
        let maxDx = 0, maxDy = 0;
        for (const [elat, elon] of extents) {
          const [px, py] = project(elon, elat);
          let distX = Math.abs(px - cx);
          if (distX > W / 2) distX = W - distX;
          if (distX > maxDx) maxDx = distX;
          if (Math.abs(py - cy) > maxDy) maxDy = Math.abs(py - cy);
        }
        const dx = Math.max(maxDx * 2, 1);
        const dy = Math.max(maxDy * 2, 1);
        const sw = window.innerWidth, sh = window.innerHeight;
        const visW = sw >= sh ? W * (sw / sh) : W;
        const visH = sw >= sh ? W : W * (sh / sw);
        k = Math.min(visW / dx, visH / dy) * 0.70;
      } else if (countries) {
        // Standard country: safe to use D3 bounds
        const feature = countries.features.find(f => String(f.id ?? '').padStart(3, '0') === id);
        if (feature) {
          const [[x0, y0], [x1, y1]] = pathGenerator.bounds(feature as Parameters<typeof pathGenerator>[0]);
          const dx = x1 - x0, dy = y1 - y0;
          const sw = window.innerWidth, sh = window.innerHeight;
          const visW = sw >= sh ? W * (sw / sh) : W;
          const visH = sw >= sh ? W : W * (sh / sw);
          k = Math.min(visW / Math.max(dx, 1), visH / Math.max(dy, 1)) * 0.70;
        }
      }

      // Cap auto-zoom so tiny countries don't pixelate
      k = Math.min(12, k);
      k = Math.max(MIN_K, Math.min(MAX_K, k));
      applyTransform({ x: W / 2 - cx * k, y: W / 2 - cy * k, k });
    },
  }), [applyTransform, countries]);

  // ── Re-apply transform on resize to recompute y clamp ────────────────────
  useEffect(() => {
    const onResize = () => applyTransform(transformRef.current);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [applyTransform]);

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


  // ── Non-passive wheel ────────────────────────────────────────────────────
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

  // ── Non-passive touch ────────────────────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      cancelInertia();
      didDragRef.current = false;
      velocityRef.current = { vx: 0, vy: 0 };
      lastMoveRef.current = null;
      if (e.touches.length === 1) {
        const t = transformRef.current;
        dragStart.current = { cx: e.touches[0]!.clientX, cy: e.touches[0]!.clientY, tx: t.x, ty: t.y };
        pinchRef.current = null;
      } else if (e.touches.length === 2) {
        dragStart.current = null;
        didDragRef.current = true;
        const t0 = e.touches[0]!; const t1 = e.touches[1]!;
        const dx = t0.clientX - t1.clientX; const dy = t0.clientY - t1.clientY;
        pinchRef.current = { dist: Math.sqrt(dx * dx + dy * dy) };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const s = svgScale();
      if (e.touches.length === 1 && dragStart.current) {
        const cdx = e.touches[0]!.clientX - dragStart.current.cx;
        const cdy = e.touches[0]!.clientY - dragStart.current.cy;
        if (Math.hypot(cdx, cdy) > 4) didDragRef.current = true;
        const dx = cdx / s;
        const dy = cdy / s;
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
    svg.addEventListener('touchmove',  onTouchMove,  { passive: false });
    return () => {
      svg.removeEventListener('touchstart', onTouchStart);
      svg.removeEventListener('touchmove',  onTouchMove);
    };
  }, [cancelInertia, applyTransform, zoomAt, clientToSvg, svgScale]);

  // ── Mouse handlers ────────────────────────────────────────────────────────
  function onMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    cancelInertia();
    didDragRef.current = false;
    mouseDownOnMap.current = true;
    velocityRef.current = { vx: 0, vy: 0 };
    lastMoveRef.current = null;
    const t = transformRef.current;
    dragStart.current = { cx: e.clientX, cy: e.clientY, tx: t.x, ty: t.y };
    setDragging(true);
  }

  function onMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!dragStart.current) return;
    const cdx = e.clientX - dragStart.current.cx;
    const cdy = e.clientY - dragStart.current.cy;
    if (Math.hypot(cdx, cdy) > 4) didDragRef.current = true;
    const s = svgScale();
    applyTransform({ k: transformRef.current.k, x: dragStart.current.tx + cdx / s, y: dragStart.current.ty + cdy / s });
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

  function onMouseUp(e: React.MouseEvent<SVGSVGElement>) {
    if (!mouseDownOnMap.current) return;
    const tag = (e.target as SVGElement).tagName;
    const isOcean = !didDragRef.current && tag !== 'path' && tag !== 'circle';
    if (dragStart.current) startInertia();
    dragStart.current = null;
    lastMoveRef.current = null;
    mouseDownOnMap.current = false;
    setDragging(false);
    if (isOcean) onOceanClick?.();
  }

  function onMouseLeave() {
    if (dragStart.current) startInertia();
    dragStart.current = null;
    lastMoveRef.current = null;
    mouseDownOnMap.current = false;
    setDragging(false);
  }

  function onTouchEnd(e: React.TouchEvent<SVGSVGElement>) {
    const tag = (e.target as SVGElement).tagName;
    const isOcean = !didDragRef.current && tag !== 'path' && tag !== 'circle';
    if (dragStart.current) startInertia();
    dragStart.current = null;
    pinchRef.current = null;
    lastMoveRef.current = null;
    if (isOcean) onOceanClick?.();
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  const paths = useMemo(() => {
    if (!countries) return [];
    return countries.features.map((f, i) => {
      const id = String(f.id ?? '').padStart(3, '0');
      return { key: i, id, d: featureToD(f) };
    });
  }, [countries]);

  const statePaths = useMemo(() => {
    if (!statesData) return [];
    return statesData.features.filter(f => f.geometry != null).map((f: StateFeature, i: number) => ({
      key: i,
      d: featureToD(f as Feature<Polygon | MultiPolygon>),
      stateId: `${f.properties.a}|${f.properties.n}`,
      name: f.properties.n as string,
      adm0: f.properties.a,
      lat: f.properties.t,
      lon: f.properties.g,
    }));
  }, [statesData]);

  const visibleStatePaths = useMemo(() => {
    if (statePaths.length === 0 || !focusedCountryId) return [];
    return statePaths.filter(s => ADM0_TO_NUMERIC[s.adm0] === focusedCountryId);
  }, [statePaths, focusedCountryId]);

  const visibleStates = useMemo(() => {
    const states = visibleStatePaths.map(s => ({ id: s.stateId, lat: s.lat, lon: s.lon }));
    // Always append the ERA5 snow-optimized point so countries with missing/sparse
    // state data (e.g. Switzerland only has Schaffhausen) still query the snowy area.
    if (focusedCountryId) {
      const sample = SNOW_SAMPLE[focusedCountryId];
      if (sample) states.push({ id: `${focusedCountryId}|sample`, lat: sample.lat, lon: sample.lon });
      else if (states.length === 0)
        states.push({ id: `${focusedCountryId}|whole`, lat: focusedCountry?.lat ?? 0, lon: focusedCountry?.lon ?? 0 });
    }
    return states;
  }, [visibleStatePaths, focusedCountry, focusedCountryId]);

  const { snowMap: stateSnowMap, loading: stateLoading, error: stateSnowError } = useStateSnow(visibleStates, focusedCountryId);

  useEffect(() => {
    if (stateSnowError) onSnowError?.();
  }, [stateSnowError, onSnowError]);

  useEffect(() => {
    if (!stateLoading && !stateSnowError && stateSnowMap.size > 0) onSnowLoad?.();
  }, [stateLoading, stateSnowError, stateSnowMap, onSnowLoad]);

  const stage = focusedCountryId ? 2 : 1;

  const focusedCountryFeature = useMemo(() => {
    if (!focusedCountryId || !countries) return null;
    return countries.features.find(f => String(f.id ?? '').padStart(3, '0') === focusedCountryId) ?? null;
  }, [focusedCountryId, countries]);

  const focusedStateFeature = useMemo(() => {
    if (!focusedState?.stateId || !statesData) return null;
    return statesData.features.find(
      f => `${(f as StateFeature).properties.a}|${(f as StateFeature).properties.n}` === focusedState.stateId
    ) ?? null;
  }, [focusedState?.stateId, statesData]);

  // Only fall back to country-level resorts when statesData is loaded AND has no states
  // for this country — never while statesData is still null (would flash all country dots)
  const hasStates = visibleStatePaths.length > 0;
  const resortFeature = focusedStateFeature ?? (statesData && !hasStates ? focusedCountryFeature : null);

  const countryResorts = useResorts(resortFeature as any);

  const projectedResorts = useMemo(() => {
    return countryResorts.map(r => {
      const [x, y] = project(r.lon, r.lat);
      return { ...r, x, y };
    });
  }, [countryResorts]);

  const { k } = transform;
  // Snap k to powers-of-2 so clusters only reorganize at clean thresholds (1,2,4,8,16…)
  // rather than every RAF frame — responsive but no fighting
  const quantizedK = Math.pow(2, Math.round(Math.log2(k)));

  const clusteredResorts = useMemo((): ClusteredPoint[] => {
    if (!projectedResorts.length) return [];
    const cellSize = CLUSTER_RADIUS / quantizedK;
    const cells = new Map<string, typeof projectedResorts>();
    for (const resort of projectedResorts) {
      const key = `${Math.floor(resort.x / cellSize)},${Math.floor(resort.y / cellSize)}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key)!.push(resort);
    }
    return Array.from(cells.entries()).map(([key, resorts]) => {
      const cx = resorts.reduce((s, r) => s + r.x, 0) / resorts.length;
      const cy = resorts.reduce((s, r) => s + r.y, 0) / resorts.length;
      const single = resorts.length === 1;
      const minX = single ? cx : Math.min(...resorts.map(r => r.x));
      const maxX = single ? cx : Math.max(...resorts.map(r => r.x));
      const minY = single ? cy : Math.min(...resorts.map(r => r.y));
      const maxY = single ? cy : Math.max(...resorts.map(r => r.y));
      return {
        id: single ? resorts[0]!.id : `cluster-${key}`,
        x: cx, y: cy,
        count: resorts.length,
        name: single ? resorts[0]!.name : `${resorts.length} resorts`,
        spanX: maxX - minX,
        spanY: maxY - minY,
      };
    });
  }, [projectedResorts, quantizedK]);

  const visibleClusters = useMemo(() => {
    if (!clusteredResorts.length) return clusteredResorts;
    const { x, y, k: tk } = transform;
    const sw = window.innerWidth, sh = window.innerHeight;
    // Outer SVG user unit range visible on screen (preserveAspectRatio=xMidYMid slice)
    const xLeft  = sw >= sh ? 0 : W * (1 - sw / sh) / 2;
    const xRight = sw >= sh ? W : W * (1 + sw / sh) / 2;
    const { yTop, yBot } = clipRef.current;
    const buf = 50 / tk;
    const minX = (xLeft  - x) / tk - buf;
    const maxX = (xRight - x) / tk + buf;
    const minY = (yTop - y) / tk - buf;
    const maxY = (yBot  - y) / tk + buf;
    return clusteredResorts.filter(c =>
      c.y >= minY && c.y <= maxY &&
      ([-1, 0, 1] as const).some(offset => {
        const cx = c.x + offset * W;
        return cx >= minX && cx <= maxX;
      })
    );
  }, [clusteredResorts, transform, wide]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="absolute inset-0 bg-black">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${W}`}
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full block touch-none select-none"
        style={{ cursor: dragging ? 'grabbing' : 'grab' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onTouchEnd={onTouchEnd}
        aria-label="World snow map"
      >
        <g ref={mapGroupRef} style={{ willChange: 'transform' }}>

          {/* ── Layer 1: Country fills (memoized — skipped during pan/zoom) ─ */}
          <FillLayer
            paths={paths}
            borders={borders}
            stage={stage}
            snowSet={snowSet}
            queryingCountries={queryingCountries}
            fadingCountries={fadingCountries}
            onCountryClick={onCountryClick}
            mouseDownOnMap={mouseDownOnMap}
            didDragRef={didDragRef}
          />

          {/* ── Layer 2: State/province fills (stage 2+) ─────────────────── */}
          {stage > 1 && ([-1, 0, 1] as const).map(offset => (
            <g key={`st-${offset}`} transform={`translate(${offset * W},0)`}>
              {hasStates ? (
                visibleStatePaths.map(s => {
                  const numericCode = ADM0_TO_NUMERIC[s.adm0] ?? '';
                  const sampleSnow = stateSnowMap.get(`${numericCode}|sample`);

                  let hasSnow = stateSnowMap.get(s.stateId);

                  if (hasSnow === false && sampleSnow) {
                    const sp = SNOW_SAMPLE[numericCode];
                    if (sp && Math.hypot(s.lon - sp.lon, s.lat - sp.lat) < 2.5) {
                      hasSnow = true;
                    }
                  }

                  if (hasSnow === undefined) {
                    hasSnow = sampleSnow ?? false;
                  }

                  const isFocusedState = focusedState?.stateId === s.stateId;
                  return (
                    <path
                      key={s.key}
                      d={s.d}
                      fill={isFocusedState ? '#1c3347' : ((!focusedState && hasSnow) ? '#4ade80' : '#2a2a2e')}
                      fillOpacity={1}
                      stroke={isFocusedState ? '#38bdf8' : 'rgba(255,255,255,0.45)'}
                      strokeWidth={isFocusedState ? 2 : 0.6}
                      vectorEffect="non-scaling-stroke"
                      className="cursor-pointer"
                      onMouseUp={() => { if (mouseDownOnMap.current && !didDragRef.current) onStateClick?.(s.stateId, s.name); }}
                      onTouchEnd={e => { if (!didDragRef.current) { e.preventDefault(); onStateClick?.(s.stateId, s.name); } }}
                    />
                  );
                })
              ) : (
                focusedCountryFeature && (
                  <path
                    d={featureToD(focusedCountryFeature as Feature<Polygon | MultiPolygon>)}
                    fill={(stateSnowMap.get(`${focusedCountryId}|sample`) || stateSnowMap.get(`${focusedCountryId}|whole`)) ? '#4ade80' : '#2a2a2e'}
                    fillOpacity={1}
                    stroke="rgba(255,255,255,0.45)"
                    strokeWidth={0.6}
                    vectorEffect="non-scaling-stroke"
                  />
                )
              )}
            </g>
          ))}

          {/* ── Layer 3: Country outlines on top of state fills ───────────── */}
          {stage > 1 && ([-1, 0, 1] as const).map(offset => (
            <g key={`ol-${offset}`} transform={`translate(${offset * W},0)`}>
              {paths.map(({ key, d, id }) => {
                const isFocused = id === focusedCountryId;
                return (
                  <path
                    key={`outline-${offset}-${key}`}
                    d={d}
                    fill="none"
                    stroke={id === '010' ? 'none' : (isFocused ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.15)')}
                    strokeWidth={isFocused ? 2 : 0.8}
                    vectorEffect="non-scaling-stroke"
                    className="pointer-events-none"
                  />
                );
              })}
            </g>
          ))}

          {/* ── Layer 4: Ski resort dots — only when a state is selected (or statesData confirms no states) */}
          <g ref={resortsLayerRef}>
            {stage > 1 && (focusedState || (statesData !== null && !hasStates)) && ([-1, 0, 1] as const).map(offset => (
              <g key={`resorts-${offset}`} transform={`translate(${offset * W},0)`}>
                {visibleClusters.map(point => {
                  const isCluster = point.count > 1;
                  return (
                    <g key={point.id}>
                      {/* visible dot */}
                      <circle
                        cx={point.x}
                        cy={point.y}
                        data-base-r={window.innerWidth < 560 ? '11' : '5'}
                        r={(window.innerWidth < 560 ? 11 : 5) / transformRef.current.k}
                        fill="#38bdf8"
                        stroke="#ffffff"
                        strokeWidth={3}
                        vectorEffect="non-scaling-stroke"
                        className="pointer-events-none"
                      />
                      {/* invisible tap target */}
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={22 / transformRef.current.k}
                        fill="transparent"
                        className={`pointer-events-auto ${isCluster ? 'cursor-zoom-in' : 'cursor-default'}`}
                        onMouseUp={() => {
                          if (!mouseDownOnMap.current || didDragRef.current || !isCluster) return;
                          const span = Math.max(point.spanX, point.spanY);
                          if (span < 1e-4) return;
                          const rawK = (CLUSTER_RADIUS * 2) / span;
                          const newK = Math.min(MAX_K, Math.pow(2, Math.ceil(Math.log2(rawK))));
                          applyTransform({ x: W / 2 - point.x * newK, y: W / 2 - point.y * newK, k: newK });
                        }}
                        onTouchEnd={e => {
                          if (didDragRef.current || !isCluster) return;
                          e.preventDefault();
                          const span = Math.max(point.spanX, point.spanY);
                          if (span < 1e-4) return;
                          const rawK = (CLUSTER_RADIUS * 2) / span;
                          const newK = Math.min(MAX_K, Math.pow(2, Math.ceil(Math.log2(rawK))));
                          applyTransform({ x: W / 2 - point.x * newK, y: W / 2 - point.y * newK, k: newK });
                        }}
                      >
                        <title>{point.name}</title>
                      </circle>
                    </g>
                  );
                })}
              </g>
            ))}
          </g>

        </g>
      </svg>

      {/* Zoom controls */}
      <div
        className="absolute right-4 flex flex-col bg-[rgba(15,15,15,0.88)] border border-white/[0.12] rounded-lg overflow-hidden"
        style={{ bottom: wider370 || focusedCountry ? 16 : 48 }}
      >
        {[{ label: '+', f: 1.5, atLimit: k >= MAX_K }, { label: '−', f: 1 / 1.5, atLimit: k <= MIN_K }].map(({ label, f, atLimit }, i) => (
          <React.Fragment key={label}>
            {i === 1 && <div className="h-px bg-white/10" />}
            <button
              onClick={() => {
                const [sx, sy] = clientToSvg(window.innerWidth / 2, window.innerHeight / 2);
                zoomAt(sx, sy, f);
              }}
              disabled={atLimit}
              className="w-9 h-9 bg-transparent border-0 text-[#e4e4e7] text-[1.25rem] leading-none flex items-center justify-center"
              style={{ cursor: atLimit ? 'default' : 'pointer', opacity: atLimit ? 0.25 : 1 }}
              aria-label={label === '+' ? 'Zoom in' : 'Zoom out'}
            >
              {label}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Legend — only shown when viewing a country */}
      {focusedCountry && <aside
        className="absolute left-4 flex flex-col gap-1.5 bg-[rgba(15,15,15,0.88)] border border-white/10 rounded-xl py-2 px-3"
        style={{ bottom: 16 }}
      >
        {focusedState ? (
          <>
            <span className="flex items-center gap-2 text-xs text-[#a1a1aa]">
              <span className="w-[14px] flex items-center justify-center shrink-0">
                <span className="w-[10px] h-[10px] rounded-[2px]" style={{ background: '#1c3347', border: '1px solid #38bdf8' }} />
              </span>
              Selected
            </span>
            <span className="flex items-center gap-2 text-xs text-[#a1a1aa]">
              <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0">
                <circle cx="7" cy="7" r="5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.5" />
              </svg>
              Snow resort
            </span>
          </>
        ) : (
          [{ color: '#2a2a2e', label: 'No snow' }, { color: '#4ade80', label: 'Snow' }].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-2 text-xs text-[#a1a1aa]">
              <span className="w-[10px] h-[10px] rounded-[2px] shrink-0" style={{ background: color }} />
              {label}
            </span>
          ))
        )}
      </aside>}

      {(!countries || stateLoading) && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[rgba(0,0,0,0.55)] pointer-events-none">
          <span className="text-[#a1a1aa] text-sm text-pulsing">
            {!countries ? 'Loading map…' : 'Fetching snow data…'}
          </span>
        </div>
      )}

      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[#f87171]">Failed to load map</span>
        </div>
      )}
    </div>
  );
});
