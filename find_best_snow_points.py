#!/usr/bin/env python3
"""
find_best_snow_points.py

Reads the merged states TopoJSON (converted to GeoJSON at /tmp/states_for_snow.geojson),
groups features by country (adm0_a3 = property 'a'), then for each country samples a
2° grid of points inside its combined geometry and queries Open-Meteo's historical API
(ERA5, 2024-2025) to find the point with the most snow days.
"""

import json, time
import requests
import numpy as np
import geopandas as gpd
from shapely.ops import unary_union
from shapely.geometry import Point
from shapely.validation import make_valid

GEOJSON_PATH   = '/tmp/states_for_snow.geojson'
OUTPUT_JSON    = 'optimized_snow_points.json'
OUTPUT_SNIPPET = 'sample_points_snippet.txt'
GRID_SPACING   = 2.0   # degrees (~200 km); lower = more accurate but more API calls
BATCH_SIZE     = 30    # Open-Meteo batch limit
PAUSE_S        = 1.2   # seconds between batches

# Numeric ISO code for each adm0_a3 (must match COUNTRIES list in SnowmanNav.tsx)
ADM0_TO_NUMERIC = {
    'AFG':'004','ALB':'008','DZA':'012','AGO':'024','ARG':'032',
    'AUS':'036','AUT':'040','BGD':'050','BEL':'056','BTN':'064',
    'BOL':'068','BRA':'076','BGR':'100','MMR':'104','KHM':'116',
    'CMR':'120','CAN':'124','LKA':'144','CHL':'152','CHN':'156',
    'COL':'170','COD':'180','HRV':'191','CUB':'192','CZE':'203',
    'DNK':'208','ECU':'218','EGY':'818','ETH':'231','FIN':'246',
    'FRA':'250','GEO':'268','DEU':'276','GHA':'288','GRC':'300',
    'GTM':'320','HTI':'332','HND':'340','HUN':'348','ISL':'352',
    'IND':'356','IDN':'360','IRN':'364','IRQ':'368','IRL':'372',
    'ISR':'376','ITA':'380','JPN':'392','KAZ':'398','KEN':'404',
    'KGZ':'417','PRK':'408','KOR':'410','LAO':'418','LBY':'434',
    'LTU':'440','MEX':'484','MNG':'496','MAR':'504','NPL':'524',
    'NLD':'528','NZL':'554','NGA':'566','NOR':'578','PAK':'586',
    'PER':'604','PHL':'608','POL':'616','PRT':'620','ROU':'642',
    'RUS':'643','SAU':'682','ZAF':'710','ESP':'724','TJK':'762',
    'TZA':'834','SWE':'752','CHE':'756','SYR':'760','THA':'764',
    'TUR':'792','UKR':'804','UGA':'800','ARE':'784','GBR':'826',
    'USA':'840','URY':'858','UZB':'860','VEN':'862','VNM':'704',
    'ATA':'010','GRL':'304','SDN':'729','SSD':'728',
}

COUNTRY_NAMES = {
    '004':'Afghanistan','008':'Albania','012':'Algeria','024':'Angola','032':'Argentina',
    '036':'Australia','040':'Austria','050':'Bangladesh','056':'Belgium','064':'Bhutan',
    '068':'Bolivia','076':'Brazil','100':'Bulgaria','104':'Myanmar','116':'Cambodia',
    '120':'Cameroon','124':'Canada','144':'Sri Lanka','152':'Chile','156':'China',
    '170':'Colombia','180':'DR Congo','191':'Croatia','192':'Cuba','203':'Czechia',
    '208':'Denmark','218':'Ecuador','818':'Egypt','231':'Ethiopia','246':'Finland',
    '250':'France','268':'Georgia','276':'Germany','288':'Ghana','300':'Greece',
    '320':'Guatemala','332':'Haiti','340':'Honduras','348':'Hungary','352':'Iceland',
    '356':'India','360':'Indonesia','364':'Iran','368':'Iraq','372':'Ireland',
    '376':'Israel','380':'Italy','392':'Japan','398':'Kazakhstan','404':'Kenya',
    '417':'Kyrgyzstan','408':'North Korea','410':'South Korea','418':'Laos','434':'Libya',
    '440':'Lithuania','484':'Mexico','496':'Mongolia','504':'Morocco','524':'Nepal',
    '528':'Netherlands','554':'New Zealand','566':'Nigeria','578':'Norway','586':'Pakistan',
    '604':'Peru','608':'Philippines','616':'Poland','620':'Portugal','642':'Romania',
    '643':'Russia','682':'Saudi Arabia','710':'South Africa','724':'Spain','762':'Tajikistan',
    '834':'Tanzania','752':'Sweden','756':'Switzerland','760':'Syria','764':'Thailand',
    '792':'Turkey','804':'Ukraine','800':'Uganda','784':'UAE','826':'United Kingdom',
    '840':'United States','858':'Uruguay','860':'Uzbekistan','862':'Venezuela','704':'Vietnam',
    '010':'Antarctica','304':'Greenland',
}


def query_snow_days(lats, lons):
    """Batch-query ERA5 historical for total snow days 2024-2025."""
    
    # Wrap longitudes to strictly be within -180 to 180
    safe_lats = [max(-90.0, min(90.0, v)) for v in lats]
    safe_lons = [((v + 180) % 360) - 180 for v in lons]

    url = (
        "https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={','.join(f'{v:.4f}' for v in safe_lats)}"
        f"&longitude={','.join(f'{v:.4f}' for v in safe_lons)}"
        "&start_date=2024-01-01&end_date=2025-05-01"
        "&daily=snowfall_sum"  
        "&timezone=GMT"
    )
    try:
        r = requests.get(url, timeout=30)
        if r.status_code == 429:
            print("  429 rate limit — sleeping 60 s …", flush=True)
            time.sleep(60)
            return query_snow_days(lats, lons)
            
        r.raise_for_status()
        data = r.json()
        items = data if isinstance(data, list) else [data]
        return [
            sum(1 for d in (item.get('daily', {}).get('snowfall_sum') or []) if d and d > 0)
            for item in items
        ]
    except Exception as e:
        error_msg = r.text if 'r' in locals() else "No response"
        print(f"  API error: {e} | Detail: {error_msg}", flush=True)
        return [0] * len(lats)


def best_point_for_polygon(geom):
    """Return (lat, lon, snow_days) for the grid point inside geom with most snow."""
    minx, miny, maxx, maxy = geom.bounds
    candidates = []
    for lon in np.arange(minx + GRID_SPACING / 2, maxx, GRID_SPACING):
        for lat in np.arange(miny + GRID_SPACING / 2, maxy, GRID_SPACING):
            if geom.contains(Point(lon, lat)):
                candidates.append((lat, lon))
    if not candidates:
        # Fall back to centroid
        c = geom.centroid
        candidates = [(c.y, c.x)]

    best_score, best_lat, best_lon = -1, candidates[0][0], candidates[0][1]
    for i in range(0, len(candidates), BATCH_SIZE):
        batch = candidates[i:i + BATCH_SIZE]
        scores = query_snow_days([p[0] for p in batch], [p[1] for p in batch])
        for (lat, lon), score in zip(batch, scores):
            if score > best_score:
                best_score, best_lat, best_lon = score, lat, lon
        time.sleep(PAUSE_S)

    return round(best_lat, 4), round(best_lon, 4), best_score


def main():
    print(f"Loading {GEOJSON_PATH} …", flush=True)
    gdf = gpd.read_file(GEOJSON_PATH)
    gdf = gdf[gdf['a'].notna()]

    # Group features by country (adm0_a3 = 'a')
    countries = {}
    for _, row in gdf.iterrows():
        adm0 = row['a']
        if adm0 not in countries:
            countries[adm0] = []
        if row.geometry is not None:
            countries[adm0].append(row.geometry)

    print(f"  {len(countries)} countries found in dataset.\n", flush=True)

    results = {}
    total = len(countries)

    for idx, (adm0, geoms) in enumerate(sorted(countries.items()), 1):
        numeric = ADM0_TO_NUMERIC.get(adm0)
        if not numeric:
            print(f"[{idx}/{total}] {adm0} — no numeric code, skipping.", flush=True)
            continue

        name = COUNTRY_NAMES.get(numeric, adm0)
        
        # Shortcut for Antarctica
        if adm0 == 'ATA':
            print(f"[{idx}/{total}] {name} ({adm0}) — Skipping grid search, using South Pole.", flush=True)
            results[adm0] = {'numeric': '010', 'name': 'Antarctica', 'lat': -90.0, 'lon': 0.0, 'snow_days': 365}
            continue

        print(f"[{idx}/{total}] {name} ({adm0}) …", flush=True)

        poly_geoms = []
        for g in geoms:
            try:
                vg = make_valid(g)
            except Exception:
                try:
                    vg = g.buffer(0)
                except Exception:
                    print("    Warning: Found hopelessly broken geometry part. Skipping.", flush=True)
                    continue

            if vg.geom_type in ('Polygon', 'MultiPolygon'):
                poly_geoms.append(vg)
            elif vg.geom_type == 'GeometryCollection':
                for part in vg.geoms:
                    if part.geom_type in ('Polygon', 'MultiPolygon'):
                        poly_geoms.append(part)
                        
        if not poly_geoms:
            print(f"  No valid polygon geometry found, skipping.", flush=True)
            continue
            
        combined = unary_union(poly_geoms)
        lat, lon, days = best_point_for_polygon(combined)
        print(f"  → best ({lat}, {lon})  snow_days={days}", flush=True)

        results[adm0] = {'numeric': numeric, 'name': name, 'lat': lat, 'lon': lon, 'snow_days': days}

    # Save full JSON
    with open(OUTPUT_JSON, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"\nSaved → {OUTPUT_JSON}", flush=True)

    # Generate TypeScript snippet sorted by numeric code
    lines = []
    for entry in sorted(results.values(), key=lambda e: e['numeric']):
        if entry['snow_days'] == 0:
            continue   # point never had snow — omit (country truly snow-free)
        lat  = f"{entry['lat']:>8.2f}"
        lon  = f"{entry['lon']:>8.2f}"
        lines.append(
            f"  ['{entry['numeric']}', {lat}, {lon}], // {entry['name']} ({entry['snow_days']} historical snow days)"
        )

    snippet = '\n'.join(lines)
    with open(OUTPUT_SNIPPET, 'w') as f:
        f.write(snippet + '\n')
    print(f"Saved → {OUTPUT_SNIPPET}\n", flush=True)
    print("--- Paste into SAMPLE_POINTS in useSnowData.ts ---")
    print(snippet)


if __name__ == '__main__':
    main()