import React, { forwardRef, useImperativeHandle, useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as topojson from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { FeatureCollection, Feature, Polygon, MultiPolygon } from 'geojson';
import { geoMercator, geoPath } from 'd3-geo';
import { useStateSnow } from '../hooks/useStateSnow';
import { SAMPLE_POINTS } from '../hooks/useSnowData';

const SNOW_SAMPLE: Record<string, { lat: number; lon: number }> = Object.fromEntries(
  SAMPLE_POINTS.map(([id, lat, lon]) => [id, { lat, lon }])
);

const WORLD_URL  = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json';
const STATES_URL = '/states.json';
const W = 1000;
const MIN_K = 1;
const MAX_K = 40;
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
  onCountryClick?: (id: string) => void;
  mouseDownOnMap: React.MutableRefObject<boolean>;
  didDragRef: React.MutableRefObject<boolean>;
}

const FillLayer = React.memo(function FillLayer({
  paths, borders, stage, snowSet, onCountryClick, mouseDownOnMap, didDragRef,
}: FillLayerProps) {
  return (
    <>
      {([-1, 0, 1] as const).map(offset => (
        <g key={offset} transform={`translate(${offset * W},0)`}>
          {paths.map(({ key, d, id }) => (
            <path
              key={`${offset}-${key}`}
              d={d}
              fill={stage === 1 && snowSet.has(id) ? '#4ade80' : '#3f3f46'}
              fillOpacity={stage === 1 ? 1 : 0.22}
              stroke="none"
              strokeWidth={0.5}
              vectorEffect="non-scaling-stroke"
              className="cursor-pointer"
              onMouseUp={() => { if (mouseDownOnMap.current && !didDragRef.current && onCountryClick) onCountryClick(id); }}
              onTouchEnd={(e) => { if (!didDragRef.current && onCountryClick) { e.preventDefault(); onCountryClick(id); } }}
            />
          ))}
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

interface Props {
  snowSet: Set<string>;
  focusedCountry: FocusedCountry | null;
  onCountryClick?: (id: string) => void;
  onOceanClick?: () => void;
}

export interface WorldMapHandle {
  panTo: (lat: number, lon: number, zoom?: number) => void;
}

export const WorldMap = forwardRef<WorldMapHandle, Props>(function WorldMap({ snowSet, focusedCountry, onCountryClick, onOceanClick }, ref) {
  const focusedCountryId = focusedCountry?.id ?? null;
  const [countries,  setCountries]  = useState<FeatureCollection<Polygon | MultiPolygon> | null>(null);
  const [borders,    setBorders]    = useState<string>('');
  const [statesData, setStatesData] = useState<FeatureCollection<Polygon | MultiPolygon, StateProperties> | null>(null);
  const [mapError,   setMapError]   = useState(false);
  const [transform,  setTransform]  = useState<XYK>({ x: 0, y: 0, k: 1 });
  const [dragging,   setDragging]   = useState(false);
  const [wide,       setWide]       = useState(() => window.innerWidth >= 560);

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
  const syncTimerRef    = useRef<number | null>(null);

  // ── Resize ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const update = () => {
      clipRef.current = computeClip(window.innerWidth, window.innerHeight);
      setWide(window.innerWidth >= 560);
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

    // Only trigger React re-render when crossing a zoom limit boundary, not on every frame
    const atMin = k <= MIN_K;
    const atMax = k >= MAX_K;
    const wasMin = prevK <= MIN_K;
    const wasMax = prevK >= MAX_K;
    if (atMin !== wasMin || atMax !== wasMax) {
      setTransform(norm);
    }

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(() => {
      setTransform({ ...transformRef.current });
    }, 400);
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
    const isOcean = !didDragRef.current && (e.target as SVGElement).tagName !== 'path';
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
    const isOcean = !didDragRef.current && (e.target as SVGElement).tagName !== 'path';
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

  const { snowMap: stateSnowMap, loading: stateLoading } = useStateSnow(visibleStates, focusedCountryId);

  const stage = focusedCountryId ? 2 : 1;

  const { k } = transform;

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
            onCountryClick={onCountryClick}
            mouseDownOnMap={mouseDownOnMap}
            didDragRef={didDragRef}
          />

          {/* ── Layer 2: State/province fills (stage 2+) ─────────────────── */}
          {stage > 1 && ([-1, 0, 1] as const).map(offset => (
            <g key={`st-${offset}`} transform={`translate(${offset * W},0)`}>
              {visibleStatePaths.map(s => {
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

                return (
                  <path
                    key={s.key}
                    d={s.d}
                    fill={hasSnow ? '#4ade80' : '#2a2a2e'}
                    fillOpacity={0.93}
                    stroke="rgba(255,255,255,0.45)"
                    strokeWidth={0.6}
                    vectorEffect="non-scaling-stroke"
                    className="pointer-events-none"
                  />
                );
              })}
            </g>
          ))}

          {/* ── Layer 3: Country outlines on top of state fills ───────────── */}
          {stage > 1 && ([-1, 0, 1] as const).map(offset => (
            <g key={offset} transform={`translate(${offset * W},0)`}>
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

        </g>
      </svg>

      {/* Zoom controls */}
      <div
        className="absolute right-4 flex flex-col bg-[rgba(15,15,15,0.88)] border border-white/[0.12] rounded-lg overflow-hidden"
        style={{ bottom: wide || focusedCountry ? 16 : 48 }}
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

      {/* Legend */}
      <aside
        className="absolute left-4 flex flex-col gap-1.5 bg-[rgba(15,15,15,0.88)] border border-white/10 rounded-xl py-2 px-3"
        style={{ bottom: wide || focusedCountry ? 16 : 48 }}
      >
        {[{ color: '#2a2a2e', label: 'No snow' }, { color: '#4ade80', label: 'Snow' }].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-2 text-xs text-[#a1a1aa]">
            <span className="w-[10px] h-[10px] rounded-[2px] shrink-0" style={{ background: color }} />
            {label}
          </span>
        ))}
      </aside>

      {(!countries || stateLoading) && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[rgba(0,0,0,0.55)] pointer-events-none">
          <span className="text-[#a1a1aa] text-sm">
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
