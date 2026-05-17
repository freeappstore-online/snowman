#!/usr/bin/env python3
"""
find_snow.py  —  Goldilocks seasonal snow coordinate finder.

For each country, scans a 5×5 grid across the country and finds the
coordinate with the HIGHEST winter snow_depth that STILL hits 0cm in summer.

Goldilocks rule:
  min(snow_depth over full year) == 0   → not a glacier / permanent ice
  max(snow_depth over full year) → pick the highest (most reliably snowy)

Uses ERA5 historical archive (2023 full year), batch queries for speed.
No geopandas required — pure requests.

Usage:
    pip install requests
    python find_snow.py
"""

import time
import requests

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
PAUSE_S     = 1.2   # seconds between batches
BATCH_SIZE  = 25    # coordinates per API request
GRID_N      = 5     # grid is GRID_N × GRID_N = 25 points
SPREAD_DEG  = 15    # ± SPREAD_DEG/2 around country center
OUTPUT_FILE = "goldilocks_sample_points.txt"

# Country geographic centers: (numeric_iso, lat, lon, name)
# Using true geographic centroids so the grid covers the whole country.
COUNTRIES = [
    ('004',  33.84,  66.03, 'Afghanistan'),
    ('008',  41.15,  20.17, 'Albania'),
    ('010', -75.00,   0.00, 'Antarctica'),        # fixed — no grid needed
    ('012',  28.03,   1.66, 'Algeria'),
    ('032', -38.42, -63.62, 'Argentina'),
    ('036', -25.27, 133.78, 'Australia'),
    ('040',  47.52,  14.55, 'Austria'),
    ('056',  50.50,   4.47, 'Belgium'),
    ('064',  27.51,  90.43, 'Bhutan'),
    ('068', -16.70, -64.58, 'Bolivia'),
    ('076', -14.24, -51.93, 'Brazil'),
    ('100',  42.73,  25.49, 'Bulgaria'),
    ('104',  16.87,  96.19, 'Myanmar'),
    ('120',   5.70,  12.35, 'Cameroon'),
    ('124',  61.37, -98.30, 'Canada'),
    ('152', -35.68, -71.54, 'Chile'),
    ('156',  35.86, 104.20, 'China'),
    ('170',   4.57, -74.30, 'Colombia'),
    ('180',  -2.88,  23.66, 'DR Congo'),
    ('191',  45.10,  15.20, 'Croatia'),
    ('203',  49.82,  15.47, 'Czechia'),
    ('208',  56.26,   9.50, 'Denmark'),
    ('231',   9.15,  40.49, 'Ethiopia'),
    ('246',  61.92,  25.75, 'Finland'),
    ('250',  46.23,   2.21, 'France'),
    ('268',  42.32,  43.36, 'Georgia'),
    ('276',  51.17,  10.45, 'Germany'),
    ('300',  39.07,  21.82, 'Greece'),
    ('304',  71.71, -42.60, 'Greenland'),
    ('320',  15.78, -90.23, 'Guatemala'),
    ('348',  47.16,  19.50, 'Hungary'),
    ('352',  64.96, -19.02, 'Iceland'),
    ('356',  20.59,  78.96, 'India'),
    ('360',  -0.79, 113.92, 'Indonesia'),
    ('364',  32.43,  53.69, 'Iran'),
    ('368',  33.22,  43.68, 'Iraq'),
    ('372',  53.41,  -8.24, 'Ireland'),
    ('376',  31.05,  34.85, 'Israel'),
    ('380',  41.87,  12.57, 'Italy'),
    ('392',  36.20, 138.25, 'Japan'),
    ('398',  48.02,  66.92, 'Kazakhstan'),
    ('404',   0.02,  37.91, 'Kenya'),
    ('408',  40.34, 127.51, 'North Korea'),
    ('410',  35.91, 127.77, 'South Korea'),
    ('417',  41.20,  74.76, 'Kyrgyzstan'),
    ('440',  55.17,  23.88, 'Lithuania'),
    ('484',  23.63, -102.55, 'Mexico'),
    ('496',  46.86, 103.85, 'Mongolia'),
    ('504',  31.79,  -7.09, 'Morocco'),
    ('524',  28.39,  84.12, 'Nepal'),
    ('528',  52.13,   5.29, 'Netherlands'),
    ('554', -40.90, 172.68, 'New Zealand'),
    ('578',  60.47,   8.47, 'Norway'),
    ('586',  30.38,  69.35, 'Pakistan'),
    ('604',  -9.19, -75.02, 'Peru'),
    ('608',  12.88, 121.77, 'Philippines'),
    ('616',  51.92,  19.15, 'Poland'),
    ('620',  39.40,  -8.22, 'Portugal'),
    ('642',  45.94,  24.97, 'Romania'),
    ('643',  61.52, 105.32, 'Russia'),
    ('682',  23.89,  45.08, 'Saudi Arabia'),
    ('704',  14.06, 108.28, 'Vietnam'),
    ('710', -30.56,  22.94, 'South Africa'),
    ('724',  40.46,  -3.75, 'Spain'),
    ('752',  60.13,  18.64, 'Sweden'),
    ('756',  46.82,   8.23, 'Switzerland'),
    ('760',  34.80,  38.99, 'Syria'),
    ('762',  38.86,  71.28, 'Tajikistan'),
    ('792',  38.96,  35.24, 'Turkey'),
    ('800',   1.37,  32.29, 'Uganda'),
    ('804',  48.38,  31.17, 'Ukraine'),
    ('826',  55.38,  -3.44, 'United Kingdom'),
    ('834',  -6.37,  34.89, 'Tanzania'),
    ('840',  37.09, -95.71, 'United States'),
    ('858', -32.52, -55.77, 'Uruguay'),
    ('860',  41.38,  64.59, 'Uzbekistan'),
    ('862',   6.42, -66.59, 'Venezuela'),
]


def make_grid(center_lat: float, center_lon: float) -> list[tuple[float, float]]:
    """Generate GRID_N×GRID_N points centred on (center_lat, center_lon)."""
    half = SPREAD_DEG / 2
    lats = [center_lat - half + i * SPREAD_DEG / (GRID_N - 1) for i in range(GRID_N)]
    lons = [center_lon - half + j * SPREAD_DEG / (GRID_N - 1) for j in range(GRID_N)]
    return [
        (round(max(-84, min(84, lat)), 4), round(((lon + 180) % 360) - 180, 4))
        for lat in lats for lon in lons
    ]


def query_snow_depth(coords: list[tuple[float, float]]) -> list[dict | None]:
    """
    Query ERA5 daily snow_depth for 2023 for each coordinate.
    Returns list of {"max": float, "min": float} or None per coord.
    """
    lats = ",".join(str(c[0]) for c in coords)
    lons = ",".join(str(c[1]) for c in coords)
    params = {
        "latitude":   lats,
        "longitude":  lons,
        "start_date": "2023-01-01",
        "end_date":   "2023-12-31",
        "daily":      "snow_depth",
        "timezone":   "UTC",
    }
    try:
        r = requests.get(ARCHIVE_URL, params=params, timeout=60)
        if r.status_code == 429:
            print("    [rate-limited] sleeping 60 s…", flush=True)
            time.sleep(60)
            return query_snow_depth(coords)
        if not r.ok:
            # snow_depth not available as daily — fall back to snowfall_sum
            params["daily"] = "snowfall_sum"
            r = requests.get(ARCHIVE_URL, params=params, timeout=60)
            if not r.ok:
                return [None] * len(coords)
            key = "snowfall_sum"
        else:
            key = "snow_depth"

        data = r.json()
        items = data if isinstance(data, list) else [data]
        results = []
        for item in items:
            vals = [v for v in (item.get("daily", {}).get(key) or []) if v is not None]
            if vals:
                results.append({"max": max(vals), "min": min(vals)})
            else:
                results.append(None)
        return results
    except Exception as exc:
        print(f"    [error] {exc}", flush=True)
        return [None] * len(coords)


def find_goldilocks(coords: list[tuple[float, float]]) -> tuple[float, float, float] | None:
    """
    Returns (best_lat, best_lon, max_snow) using the Goldilocks rule:
      min == 0  (completely melts — not a glacier)
      max is maximized (most reliably snowy in winter)
    """
    all_stats: list[dict | None] = []
    for i in range(0, len(coords), BATCH_SIZE):
        batch = coords[i: i + BATCH_SIZE]
        all_stats.extend(query_snow_depth(batch))
        time.sleep(PAUSE_S)

    best_lat = best_lon = best_max = None

    for (lat, lon), stats in zip(coords, all_stats):
        if stats is None:
            continue
        if stats["min"] == 0.0 and stats["max"] > (best_max or 0):
            best_max, best_lat, best_lon = stats["max"], lat, lon

    if best_lat is not None:
        return best_lat, best_lon, best_max
    return None


def main() -> None:
    print("=" * 60)
    print("find_snow.py  —  Goldilocks Seasonal Snow Finder")
    print("=" * 60)

    ts_lines: list[str] = []

    for code, clat, clon, name in COUNTRIES:
        # Antarctica: hardcoded, never melt check needed
        if code == '010':
            print(f"\n[{code}] {name} → fixed (-75.00, 0.00)")
            ts_lines.append(f"  ['{code}',   -75.00,     0.00], // {name}")
            continue

        grid = make_grid(clat, clon)
        print(f"\n[{code}] {name} — testing {len(grid)} grid points around ({clat}, {clon})…", flush=True)

        result = find_goldilocks(grid)

        if result:
            lat, lon, peak = result
            print(f"  → ({lat}, {lon})  peak_snow={peak:.3f}", flush=True)
            ts_lines.append(f"  ['{code}', {lat:8.2f}, {lon:8.2f}], // {name} — peak {peak:.2f}")
        else:
            print(f"  → no seasonal snow found (tropical/desert)", flush=True)
            ts_lines.append(f"  // '{code}' {name} — no seasonal snow")

        time.sleep(0.5)

    snippet = "\n".join(ts_lines)
    with open(OUTPUT_FILE, "w") as f:
        f.write("// Generated by find_snow.py (Goldilocks seasonal snow)\n")
        f.write("export const SAMPLE_POINTS: [string, number, number][] = [\n")
        f.write(snippet + "\n")
        f.write("];\n")

    print("\n" + "=" * 60)
    print(f"Saved → {OUTPUT_FILE}")
    print("=" * 60)
    print("\n" + snippet)


if __name__ == "__main__":
    main()
