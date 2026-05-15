import { useState, useEffect } from 'react';

// Countries with permanent year-round glaciers or ice — always have snow on the ground somewhere.
// Covers: Himalayas, Karakoram, Patagonian ice fields, Alps, Arctic/subarctic ranges, Tian Shan, Altai.
const PERMANENT_SNOW = new Set([
  '010', // Antarctica        — permanent ice sheet
  '304', // Greenland         — permanent ice sheet
  '004', // Afghanistan       — Hindu Kush glaciers
  '032', // Argentina         — Patagonian ice fields
  '040', // Austria           — Hohe Tauern / Pasterze glacier
  '064', // Bhutan            — Himalayan glaciers
  '068', // Bolivia           — Andean glaciers
  '124', // Canada            — Rockies / Arctic glaciers
  '152', // Chile             — Patagonian ice fields
  '156', // China             — Tibetan plateau glaciers
  '170', // Colombia          — Nevado del Ruiz
  '180', // DR Congo          — Rwenzori Mountains
  '218', // Ecuador           — Cotopaxi / Chimborazo glaciers
  '250', // France            — Mont Blanc / Mer de Glace
  '268', // Georgia           — Caucasus glaciers
  '276', // Germany           — Zugspitze glacier (Bavarian Alps)
  '352', // Iceland           — Vatnajökull ice cap
  '356', // India             — Himalayas / Siachen glacier
  '360', // Indonesia         — Puncak Jaya (Papua) equatorial glacier
  '364', // Iran              — Mt. Damavand glacier
  '380', // Italy             — Marmolada / Alpine glaciers
  '392', // Japan             — Hida Mountains (Northern Alps) glaciers
  '398', // Kazakhstan        — Tian Shan glaciers
  '404', // Kenya             — Mount Kenya glacier
  '417', // Kyrgyzstan        — Tian Shan glaciers
  '484', // Mexico            — Pico de Orizaba / Iztaccíhuatl glaciers
  '496', // Mongolia          — Altai glaciers
  '524', // Nepal             — Himalayas / Everest region
  '554', // New Zealand       — Southern Alps (Franz Josef glacier)
  '578', // Norway            — Jostedalsbreen / Svalbard
  '586', // Pakistan          — Karakoram (largest non-polar glaciers on Earth)
  '604', // Peru              — Andean glaciers (Cordillera Blanca)
  '643', // Russia            — Arctic islands / Caucasus glaciers
  '724', // Spain             — Pyrenees glaciers
  '752', // Sweden            — Sarek National Park glaciers
  '756', // Switzerland       — Aletsch glacier / Alps
  '762', // Tajikistan        — Pamir Mountains glaciers
  '792', // Turkey            — Mount Ararat glacier
  '800', // Uganda            — Rwenzori Mountains
  '834', // Tanzania          — Mount Kilimanjaro glacier
  '840', // United States     — Alaska / Cascades / Rockies glaciers
  '862', // Venezuela         — Pico Bolívar glacier (critically endangered)
]);

// [countryCode, lat, lon] — one point per country, chosen as most likely to have snow.
// Only non-permanent-snow countries are listed here; permanent-snow ones are filtered out anyway.
const SAMPLE_POINTS: [string, number, number][] = [
  ['008', 42.07,  20.47], // Albania      → Shkodër (northern mountains)
  ['012', 36.37,   6.61], // Algeria      → Constantine (high-elevation NE)
  ['024',-12.78,  15.74], // Angola       → Huambo (1700 m plateau)
  ['036',-42.88, 147.33], // Australia    → Hobart (southernmost)
  ['050', 23.72,  90.41], // Bangladesh   → Dhaka (northernmost)
  ['056', 50.85,   4.35], // Belgium      → Brussels
  ['076',-30.03, -51.23], // Brazil       → Porto Alegre (southernmost)
  ['100', 42.70,  23.32], // Bulgaria     → Sofia (550 m, cold winters)
  ['104', 21.97,  96.08], // Myanmar      → Mandalay (northern)
  ['116', 13.36, 103.86], // Cambodia     → Siem Reap (northern)
  ['120',  3.87,  11.52], // Cameroon     → Yaoundé (higher elevation)
  ['144',  7.29,  80.64], // Sri Lanka    → Kandy (higher elevation)
  ['191', 45.81,  15.97], // Croatia      → Zagreb (continental north)
  ['192', 23.13, -82.38], // Cuba         → Havana
  ['203', 50.09,  14.42], // Czechia      → Prague
  ['208', 56.16,  10.21], // Denmark      → Aarhus (slightly northern)
  ['818', 30.06,  31.25], // Egypt        → Cairo
  ['231',  9.02,  38.75], // Ethiopia     → Addis Ababa (2400 m)
  ['246', 66.50,  25.73], // Finland      → Rovaniemi (Arctic Circle)
  ['288',  5.56,  -0.20], // Ghana        → Accra
  ['300', 40.64,  22.94], // Greece       → Thessaloniki (northern)
  ['320', 14.84, -91.52], // Guatemala    → Quetzaltenango (2330 m)
  ['332', 18.54, -72.34], // Haiti        → Port-au-Prince
  ['340', 14.09, -87.21], // Honduras     → Tegucigalpa (1000 m)
  ['348', 47.50,  19.04], // Hungary      → Budapest (continental)
  ['368', 36.19,  44.01], // Iraq         → Erbil (northern Kurdistan)
  ['372', 53.33,  -6.25], // Ireland      → Dublin
  ['376', 31.78,  35.22], // Israel       → Jerusalem (800 m, occasional snow)
  ['408', 42.00, 129.78], // North Korea  → Chongjin (northernmost)
  ['410', 37.57, 126.98], // South Korea  → Seoul (continental winters)
  ['418', 19.89, 102.14], // Laos         → Luang Prabang (northern)
  ['434', 32.90,  13.18], // Libya        → Tripoli
  ['440', 54.69,  25.28], // Lithuania    → Vilnius (continental, cold winters)
  ['504', 34.04,  -5.00], // Morocco      → Fes (near Atlas Mountains)
  ['528', 52.37,   4.90], // Netherlands  → Amsterdam
  ['566',  9.06,   7.49], // Nigeria      → Abuja (higher elevation)
  ['608', 14.60, 120.98], // Philippines  → Manila
  ['616', 50.06,  19.94], // Poland       → Kraków (near Tatra Mountains)
  ['620', 41.16,  -8.62], // Portugal     → Porto (northern)
  ['642', 45.65,  25.61], // Romania      → Brașov (Carpathians, 600 m)
  ['682', 24.69,  46.72], // Saudi Arabia → Riyadh
  ['710',-26.20,  28.04], // South Africa → Johannesburg (highest elevation)
  ['760', 36.20,  37.16], // Syria        → Aleppo (northern)
  ['764', 18.79,  98.98], // Thailand     → Chiang Mai (northern highlands)
  ['804', 49.84,  24.02], // Ukraine      → Lviv (western, continental)
  ['784', 25.20,  55.27], // UAE          → Dubai
  ['826', 55.95,  -3.21], // UK           → Edinburgh (Scotland)
  ['858',-31.38, -57.96], // Uruguay      → Salto (inland, coldest)
  ['860', 41.30,  69.24], // Uzbekistan   → Tashkent (Tian Shan foothills)
  ['704', 21.03, 105.85], // Vietnam      → Hanoi (northern)

];

interface SnowDataResult {
  snowSet: Set<string>;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export function useSnowData(): SnowDataResult {
  // Start with permanent-glacier countries — they always have snow on the ground somewhere
  const [snowSet, setSnowSet] = useState<Set<string>>(new Set(PERMANENT_SNOW));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    // Skip API points for permanent-snow countries — they're always green
    const apiPoints = SAMPLE_POINTS.filter(p => !PERMANENT_SNOW.has(p[0]));
    const lats = apiPoints.map(p => p[1]).join(',');
    const lons = apiPoints.map(p => p[2]).join(',');

    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=snow_depth&forecast_days=1&timezone=auto`
    )
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: unknown) => {
        const results: unknown[] = Array.isArray(data) ? data : [data];
        const snowy = new Set<string>(PERMANENT_SNOW);
        results.forEach((result: unknown, i: number) => {
          const r = result as { current?: { snow_depth?: number } };
          const depth = r?.current?.snow_depth ?? 0;
          const code = apiPoints[i]?.[0];
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
