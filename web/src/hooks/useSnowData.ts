import { useState, useEffect } from 'react';


// [countryCode, lat, lon] — ERA5-optimized best snow point per country (find_best_snow_points.py).
// Countries not found by ERA5 use manually selected high-elevation fallback points.
export const SAMPLE_POINTS: [string, number, number][] = [
  ['004',  36.38,  71.46], // Afghanistan
  ['008',  40.63,  20.26], // Albania
  ['010', -90.00,   0.00], // Antarctica
  ['012',  36.37,   6.61], // Algeria — Constantine highlands (manual)
  ['032', -50.06, -72.56], // Argentina
  ['036', -41.75, 145.95], // Australia
  ['040',  47.36,  10.54], // Austria
  ['056',  50.49,   5.56], // Belgium
  ['064',  27.71,  89.76], // Bhutan
  ['068', -16.50, -68.15], // Bolivia — La Paz (manual)
  ['068', -19.57, -65.75], // Bolivia — Potosí (manual)
  ['076', -29.17, -51.18], // Brazil — Rio Grande do Sul (manual)
  ['100',  42.22,  23.36], // Bulgaria
  ['104',  27.33,  97.41], // Myanmar — Putao far north (manual)
  ['120',   5.95,  10.16], // Cameroon — Bamenda highlands (manual)
  ['124',  60.68,-140.04], // Canada
  ['152', -54.93, -70.43], // Chile
  ['156',  31.16,  92.63], // China
  ['170',   6.79, -72.63], // Colombia
  ['180',   0.14,  29.29], // DR Congo — Rwenzori (manual)
  ['191',  45.44,  14.50], // Croatia
  ['203',  49.55,  15.06], // Czechia
  ['208',  55.56,   9.10], // Denmark
  ['231',   9.02,  38.75], // Ethiopia — Addis Ababa highlands (manual)
  ['246',  68.81,  21.63], // Finland
  ['250',  45.63,   3.18], // France
  ['268',  42.05,  45.00], // Georgia
  ['276',  48.27,   8.87], // Germany
  ['300',  39.80,  22.62], // Greece
  ['304',  60.81, -44.06], // Greenland
  ['320',  14.84, -91.52], // Guatemala — Quetzaltenango (manual)
  ['348',  46.74,  21.10], // Hungary
  ['352',  64.38, -17.52], // Iceland
  ['356',  33.73,  77.16], // India
  ['360',  -4.00, 137.00], // Indonesia — Papua highlands (manual)
  ['364',  36.07,  51.04], // Iran
  ['368',  36.19,  44.01], // Iraq — Erbil / Kurdistan (manual)
  ['372',  52.44,  -9.48], // Ireland
  ['376',  32.97,  35.50], // Israel — Safed / Hermon (manual)
  ['380',  46.49,  11.59], // Italy
  ['392',  45.27, 141.96], // Japan
  ['398',  45.60,  81.49], // Kazakhstan
  ['404',  -0.01,  37.07], // Kenya — Mt. Kenya (manual)
  ['408',  40.68, 127.19], // North Korea
  ['410',  38.20, 127.62], // South Korea
  ['417',  40.17,  74.24], // Kyrgyzstan
  ['440',  54.90,  23.92], // Lithuania
  ['484',  27.55,-107.36], // Mexico
  ['496',  50.57,  98.75], // Mongolia
  ['504',  33.53,  -5.11], // Morocco — Ifrane (manual)
  ['524',  27.71,  85.31], // Nepal — Kathmandu (manual)
  ['528',  53.01,   6.55], // Netherlands
  ['554', -45.59, 169.02], // New Zealand
  ['578',  66.57,  13.89], // Norway
  ['586',  36.72,  73.82], // Pakistan
  ['604', -11.34, -76.34], // Peru
  ['608',  16.41, 120.59], // Philippines — Baguio (manual)
  ['616',  50.00,  21.15], // Poland
  ['620',  41.51,  -6.29], // Portugal
  ['642',  46.66,  25.27], // Romania
  ['643',  76.19,  63.00], // Russia
  ['682',  28.38,  36.57], // Saudi Arabia — Tabuk (manual)
  ['704',  22.34, 103.84], // Vietnam — Sa Pa (manual)
  ['710', -33.96,  19.46], // South Africa
  ['724',  42.64,   0.82], // Spain
  ['752',  66.33,  16.13], // Sweden
  ['756',  46.81,   8.94], // Switzerland
  ['760',  35.30,  38.76], // Syria
  ['762',  37.67,  72.37], // Tajikistan
  ['792',  40.81,  40.67], // Turkey
  ['800',   0.67,  30.27], // Uganda — Rwenzori (manual)
  ['804',  48.22,  25.14], // Ukraine
  ['826',  56.94,  -3.61], // United Kingdom
  ['834',  -3.35,  37.33], // Tanzania — Kilimanjaro (manual)
  ['840',  61.93,-144.14], // United States
  ['858', -33.98, -55.44], // Uruguay
  ['860',  42.20,  70.99], // Uzbekistan
  ['862',   8.60, -71.16], // Venezuela — Mérida Andes (manual)
];

interface SnowDataResult {
  snowSet: Set<string>;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export function useSnowData(): SnowDataResult {
  const [snowSet, setSnowSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    // Check 1-minute cache first
    try {
      const cached = localStorage.getItem('world_snow_cache_v1');
      if (cached) {
        const { data, time } = JSON.parse(cached) as { data: string[]; time: number };
        if (Date.now() - time < 60_000) {
          setSnowSet(new Set(data));
          setLastUpdated(new Date(time));
          setLoading(false);
          return;
        }
      }
    } catch {}

    const lats = SAMPLE_POINTS.map(p => p[1]).join(',');
    const lons = SAMPLE_POINTS.map(p => p[2]).join(',');

    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=snow_depth&forecast_days=1&timezone=auto`
    )
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: unknown) => {
        const results: unknown[] = Array.isArray(data) ? data : [data];
        const snowy = new Set<string>();
        results.forEach((result: unknown, i: number) => {
          const r = result as { current?: { snow_depth?: number } };
          const depth = r?.current?.snow_depth ?? 0;
          const code = SAMPLE_POINTS[i]?.[0];
          if (depth > 0 && code) snowy.add(code);
        });
        setSnowSet(snowy);
        setLastUpdated(new Date());
        try {
          localStorage.setItem('world_snow_cache_v1', JSON.stringify({
            data: Array.from(snowy),
            time: Date.now(),
          }));
        } catch {}
      })
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false));
  }, []);

  return { snowSet, loading, error, lastUpdated };
}
