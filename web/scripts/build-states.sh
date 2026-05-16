#!/usr/bin/env bash
# build-states.sh
# Builds public/states.json (TopoJSON) from Natural Earth 10m admin-1 shapefile.
# FRA/GBR/ITA/ESP dissolved by `region` field; all others raw 10m data.
# Simplification: -simplify dp 30% keep-shapes
# Properties: {a: adm0_a3, n: name/region, t: centroidY, g: centroidX}

set -euo pipefail

SHP="/Users/huangdarwin/Desktop/Programming/webdev/free-app-store/snowman/web/map_tmp/ne_10m_admin_1_states_provinces.shp"
OUT="/Users/huangdarwin/Desktop/Programming/webdev/free-app-store/snowman/web/public/states.json"
TMP="/tmp/states_build"

mkdir -p "$TMP"

echo "==> Step 1: Extract and dissolve special countries"

# Process each special country: dissolve by region, compute centroid properties
for CC in FRA GBR ITA ESP; do
  echo "    Processing $CC..."
  mapshaper "$SHP" \
    -filter "adm0_a3 === '${CC}'" \
    -dissolve region copy-fields=adm0_a3 \
    -each "this.properties = { a: adm0_a3, n: region, t: this.centroidY, g: this.centroidX }" \
    -o format=geojson "$TMP/${CC}.geojson" 2>&1 | grep -v "^\[" || true
done

echo "==> Step 2: Extract remaining countries (raw)"
mapshaper "$SHP" \
  -filter "adm0_a3 !== 'FRA' && adm0_a3 !== 'GBR' && adm0_a3 !== 'ITA' && adm0_a3 !== 'ESP'" \
  -each "this.properties = { a: adm0_a3, n: name, t: this.centroidY, g: this.centroidX }" \
  -o format=geojson "$TMP/others.geojson" 2>&1 | grep -v "^\[" || true

echo "==> Step 3: Merge all layers, simplify 30%, output TopoJSON"
mapshaper \
  "$TMP/FRA.geojson" \
  "$TMP/GBR.geojson" \
  "$TMP/ITA.geojson" \
  "$TMP/ESP.geojson" \
  "$TMP/others.geojson" \
  combine-files \
  -merge-layers \
  -simplify dp 30% keep-shapes \
  -o format=topojson "$OUT" 2>&1

echo "==> Done!"
echo "    Output: $OUT"
SIZE=$(wc -c < "$OUT")
KB=$(echo "scale=1; $SIZE / 1024" | bc)
echo "    Size: ${KB} KB"

echo "==> Feature counts:"
node -e "
const fs = require('fs');
const topo = JSON.parse(fs.readFileSync('$OUT', 'utf8'));
const key = Object.keys(topo.objects)[0];
const arcs = topo.objects[key].geometries;
const total = arcs.length;
const count = (cc) => arcs.filter(g => g.properties && g.properties.a === cc).length;
console.log('  Total features:', total);
console.log('  FRA:', count('FRA'));
console.log('  GBR:', count('GBR'));
console.log('  DEU:', count('DEU'));
console.log('  ITA:', count('ITA'));
console.log('  ESP:', count('ESP'));
"
