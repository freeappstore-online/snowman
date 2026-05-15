#!/usr/bin/env python3
"""
build_counties.py
Downloads Natural Earth ne_10m_admin_2_counties shapefile,
strips it to {a, n, t, g} properties, writes /tmp/counties_raw.geojson.
Then pipe through geo2topo + toposimplify to get public/counties.json.
"""

import requests, zipfile, io, os
import geopandas as gpd

URL = "https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_2_counties_lakes.zip"
EXTRACT_DIR = '/tmp/ne_admin2'
OUT_GEOJSON = '/tmp/counties_raw.geojson'

print("Downloading ne_10m_admin_2_counties_lakes …", flush=True)
r = requests.get(URL, timeout=120)
r.raise_for_status()

print(f"  Downloaded {len(r.content) // 1024} KB, extracting …", flush=True)
with zipfile.ZipFile(io.BytesIO(r.content)) as z:
    z.extractall(EXTRACT_DIR)

shp = None
for f in os.listdir(EXTRACT_DIR):
    if f.endswith('.shp'):
        shp = os.path.join(EXTRACT_DIR, f)
        break
if not shp:
    raise FileNotFoundError(f"No .shp in {EXTRACT_DIR}")

print(f"  Reading {shp} …", flush=True)
gdf = gpd.read_file(shp)
print(f"  {len(gdf)} features, columns: {list(gdf.columns)}", flush=True)

# Print sample to confirm field names
print("  Sample row:", gdf.iloc[0][['adm0_a3', 'name']].to_dict(), flush=True)

# Keep only polygon geometries
gdf = gdf[gdf.geometry.geom_type.isin(['Polygon', 'MultiPolygon'])].copy()

# Compute centroids
cents = gdf.geometry.centroid
gdf['t'] = cents.y.round(3)
gdf['g'] = cents.x.round(3)

# Rename to compact property names matching states.json
out = gdf[['adm0_a3', 'name', 't', 'g', 'geometry']].rename(
    columns={'adm0_a3': 'a', 'name': 'n'}
).to_crs('EPSG:4326')

out.to_file(OUT_GEOJSON, driver='GeoJSON')
print(f"\nWrote {OUT_GEOJSON} ({os.path.getsize(OUT_GEOJSON) // 1024} KB)", flush=True)
print("\nNext steps:")
print(f"  cd /Users/huangdarwin/Desktop/Programming/webdev/free-app-store/snowman/web")
print(f"  node_modules/.bin/geo2topo counties={OUT_GEOJSON} | node_modules/.bin/toposimplify -p 0.05 -f > public/counties.json")
print(f"  ls -lh public/counties.json")
