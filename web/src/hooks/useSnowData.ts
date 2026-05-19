import { useState, useEffect } from 'react';


// [countryCode, lat, lon] — ERA5 seasonal snow coordinates (find_seasonal_snow.py).
// Criteria: winter snowfall > 0 mm AND summer snowfall = 0 mm (eliminates glacier bias).
// Points marked "original" kept their seed — the grid search drifted outside the country.
export const SAMPLE_POINTS: [string, number, number][] = [
  ['004',  34.52,  73.18], // Afghanistan
  ['008',  40.63,  20.26], // Albania
  ['010', -78.52, -85.61], // Antarctica — Vinson Massif
  ['012',  36.37,   6.61], // Algeria
  ['032', -38.42, -71.12], // Argentina — Goldilocks peak 50.05
  ['036', -36.45, 148.26], // Australia — Mount Kosciuszko (manual)
  ['040',  47.52,  14.55], // Austria — Goldilocks peak 41.30
  ['056',  50.49,   5.56], // Belgium
  ['064',  27.47,  89.64], // Bhutan
  ['068', -16.50, -68.15], // Bolivia — La Paz
  ['100',  42.73,  21.74], // Bulgaria — Goldilocks peak 25.62
  ['104',  27.33,  97.41], // Myanmar
  ['124',  68.87, -90.80], // Canada — Nunavut Goldilocks peak 10.92
  ['152', -39.43, -71.54], // Chile — Goldilocks peak 39.55
  ['156',  28.36, 100.45], // China — Yunnan Goldilocks peak 12.60
  ['191',  45.10,  15.20], // Croatia — Goldilocks peak 34.44
  ['203',  49.55,  15.06], // Czechia
  ['208',  55.56,   9.10], // Denmark
  ['246',  68.81,  21.63], // Finland
  ['250',  45.63,   3.18], // France
  ['268',  42.32,  43.36], // Georgia — Goldilocks peak 33.74
  ['276',  47.42,  10.45], // Germany — Goldilocks peak 43.61
  ['300',  39.07,  21.82], // Greece — Goldilocks peak 28.00
  ['304',  72.00, -40.00], // Greenland — Summit Camp (permanent ice)
  ['348',  46.74,  21.10], // Hungary
  ['352',  64.14, -17.90], // Iceland
  ['356',  28.61,  77.20], // India
  ['364',  32.43,  49.94], // Iran — Goldilocks peak 30.31
  ['368',  36.97,  43.68], // Iraq — Goldilocks peak 31.92
  ['372',  52.44,  -9.48], // Ireland
  ['376',  32.97,  35.50], // Israel
  ['380',  46.49,  11.59], // Italy
  ['392',  36.20, 138.25], // Japan — Goldilocks peak 18.76
  ['398',  51.18,  83.45], // Kazakhstan
  ['408',  40.68, 127.19], // North Korea
  ['410',  38.20, 127.62], // South Korea
  ['417',  42.87,  74.59], // Kyrgyzstan — Bishkek
  ['440',  54.90,  23.92], // Lithuania
  ['484',  31.13,-110.05], // Mexico — Goldilocks peak 4.27
  ['496',  50.61, 111.35], // Mongolia — Goldilocks peak 12.25
  ['504',  33.53,  -5.11], // Morocco — Ifrane
  ['524',  27.71,  85.31], // Nepal
  ['528',  53.01,   6.55], // Netherlands
  ['554', -44.65, 168.93], // New Zealand — Goldilocks peak 23.66
  ['578',  64.22,  12.22], // Norway — Goldilocks peak 17.15
  ['586',  33.90,  73.39], // Pakistan — Murree
  ['604', -12.94, -75.02], // Peru — Goldilocks peak 14.21
  ['616',  50.00,  21.15], // Poland
  ['620',  41.51,  -6.29], // Portugal
  ['642',  46.66,  25.27], // Romania
  ['643',  54.02,  97.82], // Russia — Krasnoyarsk Goldilocks peak 13.30
  ['643',  62.03, 129.73], // Russia — Yakutsk (shoulder season Sep–May)
  ['682',  28.38,  36.57], // Saudi Arabia
  ['704',  22.34, 103.84], // Vietnam — Sa Pa
  ['710', -26.81,  30.44], // South Africa — Goldilocks peak 2.17
  ['724',  40.46,   0.00], // Spain — Goldilocks peak 6.58
  ['752',  60.13,  14.89], // Sweden — Goldilocks peak 20.51
  ['756',  46.82,   8.23], // Switzerland — Goldilocks peak 31.08
  ['760',  35.30,  38.76], // Syria
  ['762',  38.55,  68.77], // Tajikistan — Dushanbe
  ['792',  42.71,  42.74], // Turkey — Goldilocks peak 47.88
  ['804',  48.38,  38.67], // Ukraine — Goldilocks peak 26.04
  ['826',  56.94,  -3.61], // United Kingdom — Scottish Highlands
  ['840',  40.84, -99.46], // USA — Nebraska Goldilocks peak 21.00
  ['858', -33.98, -55.44], // Uruguay
  ['860',  42.20,  70.99], // Uzbekistan
  // Additional snow-capable countries (total kept under 95)
  ['020',  42.55,   1.60], // Andorra — Pyrenees
  ['031',  41.38,  48.48], // Azerbaijan — Greater Caucasus
  ['051',  40.37,  44.50], // Armenia — Aragats foothills
  ['070',  43.73,  17.62], // Bosnia and Herzegovina — Bjelašnica (Olympic)
  ['112',  53.71,  27.95], // Belarus
  ['233',  59.44,  24.75], // Estonia
  ['383',  42.20,  20.96], // Kosovo — Šar Mountains
  ['422',  34.17,  36.08], // Lebanon — Cedars ski area
  ['426', -29.61,  28.23], // Lesotho — Sani Pass
  ['428',  57.19,  24.42], // Latvia
  ['438',  47.14,   9.55], // Liechtenstein
  ['442',  49.82,   6.13], // Luxembourg — Ardennes
  ['498',  47.41,  28.37], // Moldova
  ['499',  42.46,  18.77], // Montenegro — Durmitor
  ['688',  43.31,  20.81], // Serbia — Kopaonik
  ['703',  49.21,  20.21], // Slovakia — High Tatras
  ['705',  46.36,  13.84], // Slovenia — Julian Alps
  ['795',  37.88,  58.37], // Turkmenistan — Kopet Dag
  ['807',  41.61,  21.75], // North Macedonia — Šar Mountains
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
      })
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false));
  }, []);

  return { snowSet, loading, error, lastUpdated };
}
