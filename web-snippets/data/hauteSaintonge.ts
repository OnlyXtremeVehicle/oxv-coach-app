/**
 * Données réelles du circuit Haute Saintonge (tracé Beltoise) — pack web.
 *
 * COPIE EXACTE de src/trackviz/hauteSaintonge.ts du repo app mobile.
 * Source : OpenStreetMap way 54412766 (highway=raceway). 76 points GPS
 * extraits directement du tracé officiel, sans interpolation.
 *
 * SYNCHRONISATION : si vous modifiez ce fichier, mettez à jour aussi
 * src/trackviz/hauteSaintonge.ts dans le repo app pour conserver la
 * cohérence visuelle entre app mobile et site web.
 */

import { BELTOISE_CORNERS } from './circuitTopology';

export interface TrackPoint {
  lat: number;
  lon: number;
}

export const HAUTE_SAINTONGE_TRACK: TrackPoint[] = [
  { lat: 45.2390749, lon: -0.0908906 },
  { lat: 45.2391293, lon: -0.0912516 },
  { lat: 45.2393437, lon: -0.092159 },
  { lat: 45.2394476, lon: -0.0925844 },
  { lat: 45.2395153, lon: -0.092798 },
  { lat: 45.239577, lon: -0.092932 },
  { lat: 45.239856, lon: -0.0934017 },
  { lat: 45.2400284, lon: -0.093669 },
  { lat: 45.240145, lon: -0.0939316 },
  { lat: 45.2402083, lon: -0.0940822 },
  { lat: 45.2405154, lon: -0.0948129 },
  { lat: 45.2406122, lon: -0.0950511 },
  { lat: 45.2406761, lon: -0.0952084 },
  { lat: 45.2408144, lon: -0.095594 },
  { lat: 45.2409609, lon: -0.0959996 },
  { lat: 45.2411163, lon: -0.0963118 },
  { lat: 45.2412871, lon: -0.0965422 },
  { lat: 45.2414841, lon: -0.0966891 },
  { lat: 45.2416352, lon: -0.0967584 },
  { lat: 45.2418259, lon: -0.0967968 },
  { lat: 45.2419573, lon: -0.0968077 },
  { lat: 45.2421921, lon: -0.0967996 },
  { lat: 45.2424763, lon: -0.0967393 }, // apex virage 1
  { lat: 45.2426869, lon: -0.0965477 },
  { lat: 45.2428089, lon: -0.0963115 },
  { lat: 45.2428654, lon: -0.0960924 },
  { lat: 45.2428731, lon: -0.0958743 },
  { lat: 45.2428442, lon: -0.0955631 },
  { lat: 45.2426515, lon: -0.0941293 },
  { lat: 45.242074, lon: -0.0895603 },
  { lat: 45.2419553, lon: -0.0886945 },
  { lat: 45.2418981, lon: -0.0882683 },
  { lat: 45.2418691, lon: -0.0881955 },
  { lat: 45.2418313, lon: -0.0881423 }, // apex virage 2
  { lat: 45.2417749, lon: -0.0881122 },
  { lat: 45.2417019, lon: -0.0881083 },
  { lat: 45.2416307, lon: -0.0881483 }, // apex virage 3 (épingle Est)
  { lat: 45.2415802, lon: -0.0882331 },
  { lat: 45.2415538, lon: -0.0883407 },
  { lat: 45.2415523, lon: -0.0887451 },
  { lat: 45.2416112, lon: -0.0900869 },
  { lat: 45.2416275, lon: -0.0905141 },
  { lat: 45.2416234, lon: -0.0906659 },
  { lat: 45.2415943, lon: -0.0907899 }, // apex virage 4
  { lat: 45.2415453, lon: -0.0908748 },
  { lat: 45.2414674, lon: -0.0909465 },
  { lat: 45.2411299, lon: -0.0911627 },
  { lat: 45.2405671, lon: -0.0915498 },
  { lat: 45.2404245, lon: -0.0916411 },
  { lat: 45.2403405, lon: -0.0916795 },
  { lat: 45.2402726, lon: -0.0916873 },
  { lat: 45.2401704, lon: -0.0916685 },
  { lat: 45.2400719, lon: -0.0916003 },
  { lat: 45.2399848, lon: -0.0914963 }, // apex virage 5
  { lat: 45.2398547, lon: -0.0911735 },
  { lat: 45.2396985, lon: -0.0907832 },
  { lat: 45.2396566, lon: -0.0906487 },
  { lat: 45.239662, lon: -0.0904954 }, // apex virage 6 (épingle Sud)
  { lat: 45.2397425, lon: -0.0903263 },
  { lat: 45.2398744, lon: -0.0899898 },
  { lat: 45.2399065, lon: -0.0897982 },
  { lat: 45.2399029, lon: -0.0895865 },
  { lat: 45.2398511, lon: -0.089349 },
  { lat: 45.2397661, lon: -0.0891708 },
  { lat: 45.2396453, lon: -0.0890188 },
  { lat: 45.2395497, lon: -0.0889292 },
  { lat: 45.2394321, lon: -0.0888765 },
  { lat: 45.2393108, lon: -0.0888715 },
  { lat: 45.2392012, lon: -0.0889068 },
  { lat: 45.2390839, lon: -0.0889951 }, // apex virage 7 (la ramenée)
  { lat: 45.2389909, lon: -0.0891372 },
  { lat: 45.2389297, lon: -0.089298 },
  { lat: 45.2388985, lon: -0.0895002 },
  { lat: 45.2389076, lon: -0.0896707 },
  { lat: 45.2389931, lon: -0.090321 },
  { lat: 45.2390749, lon: -0.0908906 }, // bouclage sur le premier point
];

/**
 * Longueur totale du tracé en mètres (haversine sur la polyline).
 */
function computeTotalLengthM(): number {
  const R = 6371000;
  let total = 0;
  for (let i = 1; i < HAUTE_SAINTONGE_TRACK.length; i++) {
    const a = HAUTE_SAINTONGE_TRACK[i - 1];
    const b = HAUTE_SAINTONGE_TRACK[i];
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLon = ((b.lon - a.lon) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    total += R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }
  return Math.round(total);
}

export const HAUTE_SAINTONGE_CIRCUIT = {
  id: 'beltoise',
  name: 'Circuit de Haute Saintonge',
  totalLengthM: computeTotalLengthM(),
  cornerCount: BELTOISE_CORNERS.length,
};
