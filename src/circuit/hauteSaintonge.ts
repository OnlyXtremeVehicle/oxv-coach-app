import type { LatLon } from './circuitGenerator';

/**
 * Circuit de Haute Saintonge (La Genétouze) — OSM way 54412766 « Piste vitesse ».
 * Points bruts (lat/lon) servant à générer la géométrie via generateCircuit().
 * Tracé fermé (73 points). Détection : 7 virages par courbure (specs v4 §05).
 *
 * Source : OpenStreetMap. © contributeurs OpenStreetMap (ODbL).
 */
export const HAUTE_SAINTONGE_OSM_WAY_ID = 54412766;

export const HAUTE_SAINTONGE_CLOSED = true;

export const HAUTE_SAINTONGE_POINTS: LatLon[] = [
  { lat: 45.2428731, lon: -0.0958743 },
  { lat: 45.2428442, lon: -0.0955631 },
  { lat: 45.2426515, lon: -0.0941293 },
  { lat: 45.242074, lon: -0.0895603 },
  { lat: 45.2419553, lon: -0.0886945 },
  { lat: 45.2418981, lon: -0.0882683 },
  { lat: 45.2418691, lon: -0.0881955 },
  { lat: 45.2418313, lon: -0.0881423 },
  { lat: 45.2417749, lon: -0.0881122 },
  { lat: 45.2417019, lon: -0.0881083 },
  { lat: 45.2416307, lon: -0.0881483 },
  { lat: 45.2415802, lon: -0.0882331 },
  { lat: 45.2415538, lon: -0.0883407 },
  { lat: 45.2415523, lon: -0.0887451 },
  { lat: 45.2416112, lon: -0.0900869 },
  { lat: 45.2416275, lon: -0.0905141 },
  { lat: 45.2416234, lon: -0.0906659 },
  { lat: 45.2415943, lon: -0.0907899 },
  { lat: 45.2415453, lon: -0.0908748 },
  { lat: 45.2414674, lon: -0.0909465 },
  { lat: 45.2411299, lon: -0.0911627 },
  { lat: 45.2405671, lon: -0.0915498 },
  { lat: 45.2404245, lon: -0.0916411 },
  { lat: 45.2403405, lon: -0.0916795 },
  { lat: 45.2402726, lon: -0.0916873 },
  { lat: 45.2401704, lon: -0.0916685 },
  { lat: 45.2400719, lon: -0.0916003 },
  { lat: 45.2399848, lon: -0.0914963 },
  { lat: 45.2398547, lon: -0.0911735 },
  { lat: 45.2396985, lon: -0.0907832 },
  { lat: 45.2396566, lon: -0.0906487 },
  { lat: 45.239662, lon: -0.0904954 },
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
  { lat: 45.2390839, lon: -0.0889951 },
  { lat: 45.2389909, lon: -0.0891372 },
  { lat: 45.2389297, lon: -0.089298 },
  { lat: 45.2388985, lon: -0.0895002 },
  { lat: 45.2389076, lon: -0.0896707 },
  { lat: 45.2389931, lon: -0.090321 },
  { lat: 45.2390749, lon: -0.0908906 },
  { lat: 45.2391492, lon: -0.0910597 },
  { lat: 45.2393919, lon: -0.0914741 },
  { lat: 45.2395374, lon: -0.0917249 },
  { lat: 45.2396432, lon: -0.0920074 },
  { lat: 45.2397981, lon: -0.0924186 },
  { lat: 45.2400325, lon: -0.0930043 },
  { lat: 45.2403074, lon: -0.0937242 },
  { lat: 45.2405294, lon: -0.0943033 },
  { lat: 45.2409338, lon: -0.0953603 },
  { lat: 45.2410466, lon: -0.0955437 },
  { lat: 45.2411914, lon: -0.0956705 },
  { lat: 45.241302, lon: -0.0957909 },
  { lat: 45.2413841, lon: -0.0959345 },
  { lat: 45.2415133, lon: -0.09621 },
  { lat: 45.2416288, lon: -0.0964173 },
  { lat: 45.2418437, lon: -0.096663 },
  { lat: 45.242001, lon: -0.0967561 },
  { lat: 45.2421921, lon: -0.0967996 },
  { lat: 45.2424763, lon: -0.0967393 },
  { lat: 45.2426869, lon: -0.0965477 },
  { lat: 45.2428089, lon: -0.0963115 },
  { lat: 45.2428654, lon: -0.0960924 },
  { lat: 45.2428731, lon: -0.0958743 },
];

// ─────────────────────────────────────────────────────────────────────────────
// CALIBRATION OXV (relevé terrain 2026-07-16, GeoJSON source :
// `src/circuit/data/haute-saintonge.geojson`)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ligne de départ/arrivée OFFICIELLE OXV — point de déclenchement du chrono.
 *
 * Relevé fondateur, vérifié géométriquement contre le tracé OSM :
 *   - à **1,47 m** de l'axe de la piste → elle est bien SUR la piste ;
 *   - à **22,9 m** de l'axe de la VOIE DES STANDS, qui longe la ligne droite.
 *
 * Cette deuxième distance est la contrainte qui commande le rayon (cf.
 * {@link HAUTE_SAINTONGE_FINISH_RADIUS_M}).
 */
export const HAUTE_SAINTONGE_FINISH: LatLon = { lat: 45.240578, lon: -0.094391 };

/**
 * Cap de la piste au franchissement de la ligne (degrés, 0 = nord).
 * Informatif : la détection de tour ne filtre PAS sur le cap — et ne le pourrait
 * pas ici, la voie des stands étant parallèle (300,8° contre 298,5°, soit 2,3°
 * d'écart). Le rayon est le SEUL levier de discrimination.
 */
export const HAUTE_SAINTONGE_FINISH_HEADING_DEG = 298.5;

/**
 * RAYON DE DÉTECTION DE LA LIGNE — 15 m. **Ne pas élargir sans relire ceci.**
 *
 * La voie des stands passe à 22,9 m de la ligne et lui est PARALLÈLE : avec les
 * défauts du code (30 m dans `circuitsService`, 40 m dans `BELTOISE_FINISH`),
 * chaque passage aux stands déclencherait un faux tour — compteur, meilleur
 * temps et régularité corrompus.
 *
 * Fenêtre admissible calculée sur la géométrie réelle (test de garde
 * `hauteSaintongeCalibration.test.ts`) :
 *   - plancher ≈ 9,5 m  = 1,5 (axe) + 3 (demi-largeur piste, tag width=6) + 5 (GPS) ;
 *   - plafond  ≈ 20,4 m = 22,9 (stands) − 2,5 (demi-largeur voie des stands).
 * 15 m se tient au milieu : couvre toute la largeur de piste avec la marge GPS,
 * et laisse ~5 m de garde avant le bord des stands.
 */
export const HAUTE_SAINTONGE_FINISH_RADIUS_M = 15;

/**
 * Axe de la VOIE DES STANDS (OSM way 54412759, `highway=service`).
 * Conservée pour VÉRIFIER la calibration : c'est elle qui borne le rayon de la
 * ligne d'arrivée. Sert de garde-fou dans les tests, pas au rendu.
 */
export const HAUTE_SAINTONGE_PIT_LANE: LatLon[] = [
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
];
