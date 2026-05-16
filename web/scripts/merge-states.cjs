#!/usr/bin/env node
/**
 * merge-states.js
 *
 * Reads a raw Admin-1 GeoJSON, clusters features into a 1.5° geographic grid
 * per country, merges each cluster into a single clean polygon using Turf.js
 * (which handles imperfect shared borders far better than topojson.merge),
 * then writes a compact TopoJSON to public/states.json.
 *
 * Usage:
 *   node scripts/merge-states.js [input.geojson] [output.json]
 *
 * Defaults:
 *   input  → /tmp/states_full.geojson
 *   output → web/public/states.json (relative to this script's parent dir)
 */

const fs = require('fs');
const path = require('path');
const turf = require('@turf/turf');
const topojson = require('topojson-server');

const INPUT  = process.argv[2] ?? '/tmp/states_full.geojson';
const OUTPUT = process.argv[3] ?? path.join(__dirname, '../public/states.json');

// Per-country cluster granularity.
// Dense/small-state countries get a larger degree → fewer merged regions.
// Large-state countries get a small degree → finer resolution preserved.
const CLUSTER_DEG_BY_COUNTRY = {
  // Micro EU — maximally merged (single-digit region count per country)
  NLD: 10, BEL: 10, LUX: 10, MCO: 10, SMR: 10, AND: 10,
  CHE: 8,  AUT: 8,  DNK: 8,  SVN: 8,  CYP: 10,
  // Dense EU — very large clusters
  GBR: 6,  FRA: 6,  DEU: 6,  ITA: 6,  ESP: 5,  POL: 5,
  CZE: 6,  HUN: 6,  ROU: 5,  BGR: 5,  GRC: 5,  HRV: 6,
  SRB: 6,  SVK: 6,  LVA: 6,  LTU: 6,  EST: 6,  BIH: 6,
  MKD: 6,  MNE: 6,  ALB: 6,  MDA: 6,  BLR: 5,
  // Scandinavia & eastern Europe
  NOR: 4,  SWE: 4,  FIN: 4,  UKR: 4,  TUR: 4,
  // Large-state countries — fine resolution preserved
  RUS: 1.5, CAN: 1.5, AUS: 1.5, BRA: 1.5, CHN: 1.5,
  IND: 1.5, USA: 1.5, ARG: 1.5, MEX: 2,
};
const DEFAULT_CLUSTER_DEG = 4; // anything unlisted is probably small → merge hard

// ── Load ──────────────────────────────────────────────────────────────────────
console.log(`Loading ${INPUT}…`);
const raw = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

// Accept both plain GeoJSON and TopoJSON (converts automatically)
let features;
if (raw.type === 'Topology') {
  const tc = require('topojson-client');
  const key = Object.keys(raw.objects)[0];
  features = tc.feature(raw, raw.objects[key]).features;
  console.log(`  Converted from TopoJSON: ${features.length} features`);
} else {
  features = raw.features;
  console.log(`  GeoJSON features: ${features.length}`);
}

// ── Cluster ───────────────────────────────────────────────────────────────────
console.log('Clustering with per-country grid sizes…');
const clusters = new Map(); // key → Feature[]

for (const f of features) {
  const p = f.properties ?? {};
  const adm0 = p.a ?? p.adm0_a3 ?? p.admin ?? 'XX';
  const lat  = p.t  ?? p.latitude  ?? p.label_y ?? 0;
  const lon  = p.g  ?? p.longitude ?? p.label_x ?? 0;
  const deg  = CLUSTER_DEG_BY_COUNTRY[adm0] ?? DEFAULT_CLUSTER_DEG;
  const cx   = Math.round(lon / deg);
  const cy   = Math.round(lat / deg);
  const key  = `${adm0}|${cx},${cy}`;
  if (!clusters.has(key)) clusters.set(key, []);
  clusters.get(key).push(f);
}
console.log(`  ${clusters.size} clusters from ${features.length} regions`);

// ── Merge ─────────────────────────────────────────────────────────────────────
console.log('Merging clusters with turf.union…');
const merged = [];
let done = 0;
let fallbacks = 0;

for (const group of clusters.values()) {
  done++;
  if (done % 200 === 0) process.stdout.write(`  ${done}/${clusters.size}\r`);

  // Dominant = furthest from equator (most likely to have snow)
  const dominant = group.reduce((best, f) => {
    const bLat = best.properties?.t ?? best.properties?.latitude ?? 0;
    const gLat = f.properties?.t    ?? f.properties?.latitude    ?? 0;
    return Math.abs(gLat) > Math.abs(bLat) ? f : best;
  });

  if (group.length === 1) {
    merged.push({ ...group[0], properties: dominant.properties });
    continue;
  }

  // Sequential pairwise union; fall back to dominant geometry on error
  try {
    // Filter to only Polygon/MultiPolygon (turf.union rejects other types)
    const polys = group.filter(f =>
      f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon'
    );
    if (polys.length === 0) {
      merged.push({ ...dominant });
      fallbacks++;
      continue;
    }

    let result = polys[0];
    for (let i = 1; i < polys.length; i++) {
      const u = turf.union(turf.featureCollection([result, polys[i]]));
      if (u) result = u;
    }
    result = { ...result, properties: dominant.properties };
    merged.push(result);
  } catch (_) {
    merged.push({ ...dominant });
    fallbacks++;
  }
}

console.log(`\n  Done. ${merged.length} output features (${fallbacks} fallbacks to dominant geometry)`);

// ── Output ────────────────────────────────────────────────────────────────────
console.log('Building TopoJSON (q=5000)…');
const fc = { type: 'FeatureCollection', features: merged };
const topo = topojson.topology({ states: fc }, 5000);
const out = JSON.stringify(topo);
fs.writeFileSync(OUTPUT, out);

const kb = (out.length / 1024).toFixed(0);
console.log(`Written → ${OUTPUT}`);
console.log(`  Uncompressed: ${kb} KB (gzip will be ~${Math.round(kb * 0.18)} KB)`);
