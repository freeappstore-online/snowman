import { useState, useEffect } from 'react';

// ISO 3166-1 numeric code (zero-padded string) → [lat, lon]
const CENTROIDS: Record<string, [number, number]> = {
  '004': [33.93, 67.71],   // Afghanistan
  '008': [41.15, 20.17],   // Albania
  '012': [28.03, 1.66],    // Algeria
  '024': [-11.20, 17.87],  // Angola
  '032': [-38.42, -63.62], // Argentina
  '036': [-25.27, 133.78], // Australia
  '040': [47.52, 14.55],   // Austria
  '050': [23.68, 90.36],   // Bangladesh
  '056': [50.50, 4.47],    // Belgium
  '064': [27.51, 90.43],   // Bhutan
  '068': [-16.29, -63.59], // Bolivia
  '076': [-14.24, -51.93], // Brazil
  '100': [42.73, 25.49],   // Bulgaria
  '104': [21.92, 95.96],   // Myanmar
  '116': [12.57, 104.99],  // Cambodia
  '120': [7.37, 12.35],    // Cameroon
  '124': [56.13, -106.35], // Canada
  '144': [7.87, 80.77],    // Sri Lanka
  '152': [-35.68, -71.54], // Chile
  '156': [35.86, 104.20],  // China
  '170': [4.57, -74.30],   // Colombia
  '191': [45.10, 15.20],   // Croatia
  '192': [21.52, -77.78],  // Cuba
  '203': [49.82, 15.47],   // Czechia
  '208': [56.26, 9.50],    // Denmark
  '218': [-1.83, -78.18],  // Ecuador
  '818': [26.82, 30.80],   // Egypt
  '231': [9.15, 40.49],    // Ethiopia
  '246': [61.92, 25.75],   // Finland
  '250': [46.23, 2.21],    // France
  '276': [51.17, 10.45],   // Germany
  '288': [7.95, -1.02],    // Ghana
  '300': [39.07, 21.82],   // Greece
  '320': [15.78, -90.23],  // Guatemala
  '332': [18.97, -72.29],  // Haiti
  '340': [15.20, -86.24],  // Honduras
  '348': [47.16, 19.50],   // Hungary
  '356': [20.59, 78.96],   // India
  '360': [-0.79, 113.92],  // Indonesia
  '364': [32.43, 53.69],   // Iran
  '368': [33.22, 43.68],   // Iraq
  '372': [53.41, -8.24],   // Ireland
  '376': [31.05, 34.85],   // Israel
  '380': [41.87, 12.57],   // Italy
  '392': [36.20, 138.25],  // Japan
  '398': [48.02, 66.92],   // Kazakhstan
  '404': [-0.02, 37.91],   // Kenya
  '408': [40.34, 127.51],  // North Korea
  '410': [35.91, 127.77],  // South Korea
  '418': [19.86, 102.50],  // Laos
  '434': [26.34, 17.23],   // Libya
  '440': [55.17, 23.88],   // Lithuania
  '484': [23.63, -102.55], // Mexico
  '496': [46.86, 103.85],  // Mongolia
  '504': [31.79, -7.09],   // Morocco
  '524': [28.39, 84.12],   // Nepal
  '528': [52.13, 5.29],    // Netherlands
  '554': [-40.90, 174.89], // New Zealand
  '566': [9.08, 8.68],     // Nigeria
  '578': [60.47, 8.47],    // Norway
  '586': [30.38, 69.35],   // Pakistan
  '604': [-9.19, -75.02],  // Peru
  '608': [12.88, 121.77],  // Philippines
  '616': [51.92, 19.15],   // Poland
  '620': [39.40, -8.22],   // Portugal
  '642': [45.94, 24.97],   // Romania
  '643': [61.52, 105.32],  // Russia
  '682': [23.89, 45.08],   // Saudi Arabia
  '710': [-30.56, 22.94],  // South Africa
  '724': [40.46, -3.75],   // Spain
  '752': [60.13, 18.64],   // Sweden
  '756': [46.82, 8.23],    // Switzerland
  '760': [34.80, 38.99],   // Syria
  '764': [15.87, 100.99],  // Thailand
  '792': [38.96, 35.24],   // Turkey
  '804': [48.38, 31.17],   // Ukraine
  '784': [23.42, 53.85],   // UAE
  '826': [55.38, -3.44],   // United Kingdom
  '840': [37.09, -95.71],  // United States
  '858': [-32.52, -55.77], // Uruguay
  '860': [41.38, 64.59],   // Uzbekistan
  '862': [6.42, -66.59],   // Venezuela
  '704': [14.06, 108.28],  // Vietnam
};

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
    const codes = Object.keys(CENTROIDS);
    const lats = codes.map(c => CENTROIDS[c]![0]).join(',');
    const lons = codes.map(c => CENTROIDS[c]![1]).join(',');

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
          const code = codes[i];
          if (depth > 0 && code) {
            snowy.add(code);
          }
        });
        setSnowSet(snowy);
        setLastUpdated(new Date());
      })
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false));
  }, []);

  return { snowSet, loading, error, lastUpdated };
}
