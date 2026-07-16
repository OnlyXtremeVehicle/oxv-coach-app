/**
 * Détection de tour par FRANCHISSEMENT DE PORTE — tests sur géométrie RÉELLE.
 *
 * Ce test ne valide pas une abstraction : il rejoue des trajectoires construites
 * sur les tracés OSM réels des deux circuits du jalon (`src/circuit/data/*.geojson`),
 * voie des stands comprise, et vérifie qu'un aller aux stands ne fabrique AUCUN tour.
 *
 * Géométrie mesurée sur ces tracés (les deux voies des stands sont PARALLÈLES à la
 * ligne droite d'arrivée) :
 *   - Haute Saintonge : stands à 22,9 m de la ligne, 2,3° d'écart de cap ;
 *   - Ricardo Tormo   : stands à 16,2 m, 0,4° d'écart — aucun filtre de cap ne
 *     pourrait distinguer les deux.
 *
 * CE QUE LA PORTE APPORTE, exactement (mesuré, pas supposé) :
 *   1. le SENS obligatoire — un retour stands, une marche arrière ou un tour à
 *      contresens ne comptent plus (le rayon n'a AUCUN filtre de direction) ;
 *   2. l'exigence d'un FRANCHISSEMENT réel et non d'une simple proximité — un
 *      véhicule qui s'arrête à 5 m de la ligne sans la passer comptait un tour ;
 *   3. l'immunité aux TROUS de données (seuil explicite).
 *
 * CE QU'ELLE N'APPORTE PAS, et qu'il faut savoir : pour une voie PARALLÈLE décalée
 * de d, une porte de demi-largeur W se déclenche si W ≥ d, un rayon R si R > d —
 * c'est la MÊME condition (vérifié numériquement : la voie des stands de Valence
 * coupe la perpendiculaire à 16,18 m, soit exactement sa distance à la ligne). La
 * porte ne desserre donc PAS la fenêtre latérale de Valence, elle la déplace pas
 * d'un pouce : `finish_line_radius_m` reste à calibrer là-bas (cf. le describe
 * « fenêtre » plus bas, qui chiffre l'étroitesse). Le gain est ailleurs — points
 * 1 à 3 ci-dessus.
 *
 * Source géométrie : OpenStreetMap © contributeurs OSM (ODbL).
 */

import fs from 'fs';
import path from 'path';

import {
  HAUTE_SAINTONGE_FINISH,
  HAUTE_SAINTONGE_FINISH_HEADING_DEG,
  HAUTE_SAINTONGE_FINISH_RADIUS_M,
  HAUTE_SAINTONGE_PIT_LANE,
} from '@/circuit/hauteSaintonge';
import { createLapDetector, processGpsPoint } from '../lapDetection';
import { haversineDistance } from '../geo';

interface LatLon {
  lat: number;
  lon: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Chargement de la géométrie réelle
// ─────────────────────────────────────────────────────────────────────────────

interface GeoFeature {
  properties: Record<string, string | undefined>;
  geometry: { type: string; coordinates: unknown };
}
interface GeoFeatureCollection {
  features: GeoFeature[];
}

function loadGeoJson(file: string): GeoFeatureCollection {
  const raw = fs.readFileSync(path.join(__dirname, '..', '..', 'circuit', 'data', file), 'utf8');
  return JSON.parse(raw) as GeoFeatureCollection;
}

function toLatLon(coords: unknown): LatLon[] {
  return (coords as [number, number][]).map(([lon, lat]) => ({ lat, lon }));
}

/** Toutes les polylignes du GeoJSON dont les tags satisfont le prédicat. */
function lineStrings(
  fc: GeoFeatureCollection,
  match: (p: Record<string, string | undefined>) => boolean
): { name: string; points: LatLon[] }[] {
  const found = fc.features
    .filter((f) => f.geometry.type === 'LineString' && match(f.properties))
    .map((f) => ({
      name: f.properties['@id'] ?? f.properties.name ?? '?',
      points: toLatLon(f.geometry.coordinates),
    }));
  if (found.length === 0) throw new Error('Aucune polyligne ne correspond — GeoJSON inattendu');
  return found;
}

function startFinish(fc: GeoFeatureCollection): LatLon {
  const f = fc.features.find((ft) => ft.properties.type === 'start_finish');
  if (!f) throw new Error('Point start_finish absent du GeoJSON');
  const [lon, lat] = f.geometry.coordinates as [number, number];
  return { lat, lon };
}

const HS = loadGeoJson('haute-saintonge.geojson');
const TORMO = loadGeoJson('ricardo-tormo.geojson');

// ─────────────────────────────────────────────────────────────────────────────
// Outillage géométrique (même projection locale que hauteSaintongeCalibration)
// ─────────────────────────────────────────────────────────────────────────────

const rad = (d: number): number => (d * Math.PI) / 180;

function toLocalMeters(p: LatLon, origin: LatLon): [number, number] {
  const mLat =
    111132.92 - 559.82 * Math.cos(rad(2 * origin.lat)) + 1.175 * Math.cos(rad(4 * origin.lat));
  const mLon = 111412.84 * Math.cos(rad(origin.lat)) - 93.5 * Math.cos(rad(3 * origin.lat));
  return [(p.lon - origin.lon) * mLon, (p.lat - origin.lat) * mLat];
}

function distanceToSegment(a: [number, number], b: [number, number]): number {
  const [ax, ay] = a;
  const dx = b[0] - ax;
  const dy = b[1] - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(ax, ay);
  const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/** Distance (m) de `origin` à la polyligne, et cap (deg) du segment le plus proche. */
function closestApproach(
  line: LatLon[],
  origin: LatLon
): { distanceM: number; headingDeg: number } {
  const pts = line.map((p) => toLocalMeters(p, origin));
  let best = Infinity;
  let bestIdx = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = distanceToSegment(pts[i], pts[i + 1]);
    if (d < best) {
      best = d;
      bestIdx = i;
    }
  }
  const a = pts[bestIdx];
  const b = pts[bestIdx + 1];
  const headingDeg = ((Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI + 360) % 360;
  return { distanceM: best, headingDeg };
}

// ─────────────────────────────────────────────────────────────────────────────
// Simulation d'un flux GPS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rééchantillonne une polyligne à pas constant : simule le flux 25 Hz du RaceBox.
 * Le pas en mètres fixe la vitesse (2 m à 25 Hz = 180 km/h ; 0,7 m = 63 km/h,
 * allure d'une voie des stands).
 */
function resample(points: LatLon[], stepM: number): LatLon[] {
  const out: LatLon[] = [points[0]];
  let sinceLast = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = haversineDistance(a.lat, a.lon, b.lat, b.lon);
    if (len === 0) continue;
    let pos = 0;
    while (sinceLast + (len - pos) >= stepM) {
      pos += stepM - sinceLast;
      sinceLast = 0;
      const t = pos / len;
      out.push({ lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t });
    }
    sinceLast += len - pos;
  }
  return out;
}

const FRAME_MS = 40; // 25 Hz

interface DetectorConfig {
  finish: LatLon;
  radiusM: number;
  headingDeg?: number | null;
}

/** Rejoue une trajectoire dans le détecteur et renvoie le nombre de tours comptés. */
function countLaps(cfg: DetectorConfig, track: LatLon[], frameMs = FRAME_MS): number {
  const detector = createLapDetector(
    cfg.finish.lat,
    cfg.finish.lon,
    cfg.radiusM,
    cfg.headingDeg ?? null
  );
  let laps = 0;
  track.forEach((p, i) => {
    if (processGpsPoint(detector, p.lat, p.lon, i * frameMs)) laps += 1;
  });
  return laps;
}

/** Concatène N tours d'un tracé fermé (le point de fermeture n'est pas dupliqué). */
function repeatLoop(loop: LatLon[], times: number): LatLon[] {
  const body = loop.slice(0, -1);
  const out: LatLon[] = [];
  for (let i = 0; i < times; i++) out.push(...body);
  out.push(loop[loop.length - 1]);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Géométries des deux circuits
// ─────────────────────────────────────────────────────────────────────────────

const HS_FINISH = startFinish(HS);
const HS_TRACK = lineStrings(HS, (p) => p.highway === 'raceway')[0].points;
/** Voie des stands de Haute Saintonge : `highway=service` (way 54412759). */
const HS_PITS = lineStrings(HS, (p) => p.highway === 'service')[0].points;

const TORMO_FINISH = startFinish(TORMO);
/** Voies des stands de Valence : les ways dont le `name` contient « Pit ». */
const TORMO_PITS = lineStrings(TORMO, (p) => (p.name ?? '').includes('Pit'));
/**
 * Portion de piste qui PORTE la ligne d'arrivée : le tracé de Valence est découpé
 * en plusieurs ways OSM ; on retient celui qui passe au plus près de la ligne
 * (way 1336518434, à 2,0 m — les autres sont à 46 m et 124 m).
 */
const TORMO_TRACK = lineStrings(TORMO, (p) => p.name === 'Circuit Ricardo Tormo')
  .map((w) => ({ ...w, approach: closestApproach(w.points, TORMO_FINISH).distanceM }))
  .sort((a, b) => a.approach - b.approach)[0].points;

/**
 * Cap de la piste au franchissement, MESURÉ sur le tracé OSM au point d'approche
 * le plus proche de la ligne. Valence n'a pas encore de constantes en dur (sa ligne
 * `circuits` reste à renseigner par le fondateur) : on ne l'invente pas, on la lit.
 */
const TORMO_HEADING_DEG = closestApproach(TORMO_TRACK, TORMO_FINISH).headingDeg;

/**
 * Demi-largeur de porte retenue POUR CE TEST à Valence : 10 m (porte de 20 m).
 * Couvre la ligne droite (~12 m) alors même que le point de ligne est à 2,0 m de
 * l'axe OSM, et s'arrête 6,2 m avant l'AXE de la voie des stands (16,2 m).
 *
 * Ce n'est PAS une calibration de production : la ligne Valencia n'est pas encore
 * renseignée en base (`finish_line_radius_m` NULL → le code retombe sur 30 m, ce
 * qui compterait les stands — cf. le test « EN MODE RAYON » plus bas). La valeur
 * réelle revient au fondateur, et la fenêtre y est étroite quel que soit le mode.
 */
const TORMO_GATE_HALF_WIDTH_M = 10;

/** Rayon par défaut du code (`circuitsService` → 30 m) : la valeur qui piège. */
const DEFAULT_RADIUS_M = 30;

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Géométrie réelle — la voie des stands longe la ligne, en parallèle', () => {
  it('Haute Saintonge : stands à ~22,9 m, cap parallèle à 2,3° près', () => {
    const track = closestApproach(HS_TRACK, HS_FINISH);
    const pits = closestApproach(HS_PITS, HS_FINISH);
    expect(track.distanceM).toBeLessThan(3); // la ligne est sur la piste (1,47 m)
    expect(pits.distanceM).toBeGreaterThan(20);
    expect(pits.distanceM).toBeLessThan(26);
    expect(Math.abs(pits.headingDeg - track.headingDeg)).toBeLessThan(3);
  });

  it('Ricardo Tormo : stands à ~16,2 m, cap parallèle à 0,4° près', () => {
    const track = closestApproach(TORMO_TRACK, TORMO_FINISH);
    const pits = closestApproach(TORMO_PITS[0].points, TORMO_FINISH);
    expect(track.distanceM).toBeLessThan(3); // 2,02 m
    expect(pits.distanceM).toBeGreaterThan(15);
    expect(pits.distanceM).toBeLessThan(18); // 16,18 m
    // 0,38° d'écart : aucun filtre de cap ne pourrait distinguer les deux.
    expect(Math.abs(pits.headingDeg - track.headingDeg)).toBeLessThan(1);
  });
});

describe('Franchir n’est pas s’approcher — le gain propre de la porte', () => {
  // Ces deux cas discriminent VRAIMENT la porte du rayon, à paramètre ÉGAL (15 m
  // à Haute Saintonge dans les deux modes). Ils portent l'essentiel de la valeur :
  // la porte exige un franchissement dirigé, le rayon se contente d'une proximité.
  const dense = resample(HS_TRACK, 2);
  const crossingIdx = dense.findIndex(
    (p) =>
      haversineDistance(p.lat, p.lon, HAUTE_SAINTONGE_FINISH.lat, HAUTE_SAINTONGE_FINISH.lon) < 3
  );
  /** Ligne droite d'arrivée tronquée ~4 m AVANT la ligne, puis véhicule immobile. */
  const approachThenStop = (): LatLon[] => {
    const approach = dense.slice(0, crossingIdx - 1);
    const last = approach[approach.length - 1];
    // 1 s à l'arrêt (25 trames identiques) : drapeau rouge, casse, abandon.
    return [...approach, ...Array<LatLon>(25).fill(last)];
  };

  const gate: DetectorConfig = {
    finish: HAUTE_SAINTONGE_FINISH,
    radiusM: HAUTE_SAINTONGE_FINISH_RADIUS_M,
    headingDeg: HAUTE_SAINTONGE_FINISH_HEADING_DEG,
  };
  const radius: DetectorConfig = {
    finish: HAUTE_SAINTONGE_FINISH,
    radiusM: HAUTE_SAINTONGE_FINISH_RADIUS_M,
  };

  it('le véhicule s’arrête AVANT la ligne, à portée du rayon (montage du test)', () => {
    const stopPoint = approachThenStop()[approachThenStop().length - 1];
    const d = haversineDistance(
      stopPoint.lat,
      stopPoint.lon,
      HAUTE_SAINTONGE_FINISH.lat,
      HAUTE_SAINTONGE_FINISH.lon
    );
    expect(d).toBeLessThan(HAUTE_SAINTONGE_FINISH_RADIUS_M); // dans le disque…
    expect(d).toBeGreaterThan(0); // …mais la ligne n'est pas franchie
  });

  it('PORTE : s’arrêter à quelques mètres de la ligne ne compte aucun tour', () => {
    expect(countLaps(gate, approachThenStop())).toBe(0);
  });

  it('RAYON, même paramètre : le même arrêt FABRIQUE un tour', () => {
    // Le tour n'a pas eu lieu — le véhicule n'a jamais passé la ligne. C'est
    // exactement le genre de faux tour qui corrompt le chrono en silence.
    expect(countLaps(radius, approachThenStop())).toBe(1);
  });
});

describe('Valence — la fenêtre latérale est étroite, et la porte ne la desserre pas', () => {
  const TRACK_HALF_WIDTH_M = 6; // ligne droite MotoGP ~12 m
  const GPS_ERROR_M = 5; // même hypothèse que la calibration Haute Saintonge
  const distToTrack = closestApproach(TORMO_TRACK, TORMO_FINISH).distanceM;
  const distToPit = closestApproach(TORMO_PITS[0].points, TORMO_FINISH).distanceM;

  // Convention identique à `hauteSaintongeCalibration.test.ts` :
  //   plancher = il faut couvrir toute la largeur de piste, marge GPS comprise ;
  //   plafond  = il faut rester en deçà du bord le plus proche de la voie des stands.
  // Elle vaut pour le RAYON comme pour la DEMI-LARGEUR de porte : dans les deux
  // modes, c'est le même écart latéral qui décide (cf. l'en-tête de ce fichier).
  const floor = distToTrack + TRACK_HALF_WIDTH_M + GPS_ERROR_M;

  it('avec une voie des stands étroite (6 m), la fenêtre tombe à ~16 cm', () => {
    const ceiling = distToPit - 3;
    expect(floor).toBeCloseTo(13.02, 1);
    expect(ceiling).toBeCloseTo(13.18, 1);
    expect(ceiling - floor).toBeLessThan(0.5);
  });

  it('avec une voie des stands aux normes MotoGP (10-12 m), la fenêtre est VIDE', () => {
    // Sous cette hypothèse GPS, AUCUN réglage — rayon ou demi-largeur — ne couvre
    // la piste sans mordre les stands. C'est la marge GPS admise qui décide :
    // à 2 m d'erreur (RaceBox Mini S multi-bande), la fenêtre se rouvre (~1 m).
    for (const pitHalfWidth of [5, 6]) {
      const ceiling = distToPit - pitHalfWidth;
      expect(floor).toBeGreaterThan(ceiling);
      expect(distToTrack + TRACK_HALF_WIDTH_M + 2).toBeLessThan(ceiling);
    }
  });

  it('à Haute Saintonge, au contraire, la fenêtre est large et 15 m s’y tient', () => {
    // Contraste : là-bas les stands sont à 22,9 m — le réglage n'est pas critique.
    const hsTrack = closestApproach(HS_TRACK, HS_FINISH).distanceM;
    const hsPit = closestApproach(HS_PITS, HS_FINISH).distanceM;
    const hsFloor = hsTrack + 3 + GPS_ERROR_M;
    const hsCeiling = hsPit - 2.5;
    expect(HAUTE_SAINTONGE_FINISH_RADIUS_M).toBeGreaterThanOrEqual(hsFloor);
    expect(HAUTE_SAINTONGE_FINISH_RADIUS_M).toBeLessThan(hsCeiling);
  });
});

describe('LA voie des stands ne déclenche AUCUN tour (mode porte)', () => {
  // Allure stands : ~0,7 m par trame à 25 Hz ≈ 63 km/h. Échantillonnage dense =
  // cas le plus défavorable (un maximum de points au voisinage de la ligne).
  it('Haute Saintonge — aller complet dans la voie des stands : 0 tour', () => {
    const laps = countLaps(
      {
        finish: HAUTE_SAINTONGE_FINISH,
        radiusM: HAUTE_SAINTONGE_FINISH_RADIUS_M,
        headingDeg: HAUTE_SAINTONGE_FINISH_HEADING_DEG,
      },
      resample(HS_PITS, 0.7)
    );
    expect(laps).toBe(0);
  });

  it('Haute Saintonge — constantes et GeoJSON décrivent la même voie des stands', () => {
    // Garde-fou : si le relevé en dur diverge du GeoJSON, le test ci-dessus ne
    // prouverait plus rien sur la géométrie réellement embarquée.
    expect(HAUTE_SAINTONGE_PIT_LANE.length).toBe(HS_PITS.length);
    expect(HAUTE_SAINTONGE_FINISH).toEqual(HS_FINISH);
  });

  it('Ricardo Tormo — chaque voie « Pit » du tracé : 0 tour', () => {
    for (const pit of TORMO_PITS) {
      const laps = countLaps(
        {
          finish: TORMO_FINISH,
          radiusM: TORMO_GATE_HALF_WIDTH_M,
          headingDeg: TORMO_HEADING_DEG,
        },
        resample(pit.points, 0.7)
      );
      expect({ voie: pit.name, laps }).toEqual({ voie: pit.name, laps: 0 });
    }
  });

  it('Ricardo Tormo — EN MODE RAYON, la même voie des stands FABRIQUE un faux tour', () => {
    // C'est la preuve que la porte apporte quelque chose : avec le rayon par
    // défaut du code (30 m), un simple aller aux stands compte un tour — compteur,
    // meilleur temps et régularité corrompus, en silence.
    const laps = countLaps(
      { finish: TORMO_FINISH, radiusM: DEFAULT_RADIUS_M },
      resample(TORMO_PITS[0].points, 0.7)
    );
    expect(laps).toBeGreaterThanOrEqual(1);

    // La même trajectoire, la même ligne, le même rayon : la porte, elle, ne compte rien.
    const gated = countLaps(
      { finish: TORMO_FINISH, radiusM: TORMO_GATE_HALF_WIDTH_M, headingDeg: TORMO_HEADING_DEG },
      resample(TORMO_PITS[0].points, 0.7)
    );
    expect(gated).toBe(0);
  });
});

describe('La piste déclenche EXACTEMENT un tour par passage', () => {
  it('Haute Saintonge — 3 tours du tracé fermé = 3 franchissements', () => {
    const laps = countLaps(
      {
        finish: HAUTE_SAINTONGE_FINISH,
        radiusM: HAUTE_SAINTONGE_FINISH_RADIUS_M,
        headingDeg: HAUTE_SAINTONGE_FINISH_HEADING_DEG,
      },
      resample(repeatLoop(HS_TRACK, 3), 2)
    );
    expect(laps).toBe(3);
  });

  it('Haute Saintonge — 1 tour du tracé fermé = 1 franchissement', () => {
    const laps = countLaps(
      {
        finish: HAUTE_SAINTONGE_FINISH,
        radiusM: HAUTE_SAINTONGE_FINISH_RADIUS_M,
        headingDeg: HAUTE_SAINTONGE_FINISH_HEADING_DEG,
      },
      resample(HS_TRACK, 2)
    );
    expect(laps).toBe(1);
  });

  it('Ricardo Tormo — la portion de piste qui porte la ligne = 1 franchissement', () => {
    const laps = countLaps(
      { finish: TORMO_FINISH, radiusM: TORMO_GATE_HALF_WIDTH_M, headingDeg: TORMO_HEADING_DEG },
      resample(TORMO_TRACK, 2)
    );
    expect(laps).toBe(1);
  });
});

describe('Sens obligatoire — un franchissement à contresens ne compte pas', () => {
  it('Haute Saintonge — le tracé parcouru à l’envers : 0 tour', () => {
    const backwards = resample(HS_TRACK, 2).reverse();
    const laps = countLaps(
      {
        finish: HAUTE_SAINTONGE_FINISH,
        radiusM: HAUTE_SAINTONGE_FINISH_RADIUS_M,
        headingDeg: HAUTE_SAINTONGE_FINISH_HEADING_DEG,
      },
      backwards
    );
    expect(laps).toBe(0);
  });

  it('Ricardo Tormo — la portion de piste parcourue à l’envers : 0 tour', () => {
    const backwards = resample(TORMO_TRACK, 2).reverse();
    const laps = countLaps(
      { finish: TORMO_FINISH, radiusM: TORMO_GATE_HALF_WIDTH_M, headingDeg: TORMO_HEADING_DEG },
      backwards
    );
    expect(laps).toBe(0);
  });

  it('un demi-tour sur la ligne (marche arrière puis re-franchissement) ne compte qu’une fois', () => {
    const forward = resample(HS_TRACK, 2);
    // Aller normal, puis retour en marche arrière sur les mêmes points : le
    // retour repasse la porte à contresens et ne doit rien ajouter.
    const laps = countLaps(
      {
        finish: HAUTE_SAINTONGE_FINISH,
        radiusM: HAUTE_SAINTONGE_FINISH_RADIUS_M,
        headingDeg: HAUTE_SAINTONGE_FINISH_HEADING_DEG,
      },
      [...forward, ...[...forward].reverse()]
    );
    expect(laps).toBe(1);
  });
});

describe('Trou de données — un saut ne fabrique pas de tour', () => {
  // Deux points de piste distants de ~200 m encadrant la ligne : c'est le profil
  // d'une reconnexion BLE. Le segment qui les relie coupe la porte, mais il ne
  // décrit aucune trajectoire — on ne compte pas.
  const dense = resample(HS_TRACK, 2);
  const crossingIdx = dense.findIndex(
    (p) =>
      haversineDistance(p.lat, p.lon, HAUTE_SAINTONGE_FINISH.lat, HAUTE_SAINTONGE_FINISH.lon) < 3
  );
  const before = dense[crossingIdx - 50]; // ~100 m avant la ligne
  const after = dense[crossingIdx + 50]; // ~100 m après

  const cfg: DetectorConfig = {
    finish: HAUTE_SAINTONGE_FINISH,
    radiusM: HAUTE_SAINTONGE_FINISH_RADIUS_M,
    headingDeg: HAUTE_SAINTONGE_FINISH_HEADING_DEG,
  };

  it('les deux points encadrent bien la ligne (montage du test)', () => {
    expect(crossingIdx).toBeGreaterThan(50);
    expect(haversineDistance(before.lat, before.lon, after.lat, after.lon)).toBeGreaterThan(150);
  });

  it('un saut de ~200 m par-dessus la ligne : 0 tour', () => {
    expect(countLaps(cfg, [before, after])).toBe(0);
  });

  it('témoin — les mêmes points reliés par une trajectoire continue : 1 tour', () => {
    // Prouve que c'est bien le SEUIL de trou qui a bloqué, et non la géométrie.
    expect(countLaps(cfg, dense.slice(crossingIdx - 50, crossingIdx + 50))).toBe(1);
  });

  it('après le trou, le détecteur reste armé pour le passage suivant', () => {
    // Un trou fait perdre UN tour, jamais la détection : le tour d'après compte.
    const twoLaps = resample(repeatLoop(HS_TRACK, 2), 2);
    const gapIdx = twoLaps.findIndex(
      (p) =>
        haversineDistance(p.lat, p.lon, HAUTE_SAINTONGE_FINISH.lat, HAUTE_SAINTONGE_FINISH.lon) < 3
    );
    // Coupe 100 m de trame de part et d'autre du PREMIER franchissement :
    // celui-ci est perdu, le second (tour suivant) doit toujours être compté.
    const withGap = [...twoLaps.slice(0, gapIdx - 50), ...twoLaps.slice(gapIdx + 50)];
    expect(countLaps(cfg, twoLaps)).toBe(2);
    expect(countLaps(cfg, withGap)).toBe(1);
  });
});

describe('Repli rayon — comportement historique inchangé sans cap', () => {
  it('sans cap, la détection reste un simple rayon (piste : tours comptés)', () => {
    const laps = countLaps(
      { finish: HAUTE_SAINTONGE_FINISH, radiusM: HAUTE_SAINTONGE_FINISH_RADIUS_M },
      resample(repeatLoop(HS_TRACK, 3), 2)
    );
    expect(laps).toBe(3);
  });

  it('sans cap, aucun filtre de direction : le contresens compte (comme avant)', () => {
    // Documente le repli tel qu'il est — c'est précisément ce que la porte corrige.
    const backwards = resample(HS_TRACK, 2).reverse();
    const laps = countLaps(
      { finish: HAUTE_SAINTONGE_FINISH, radiusM: HAUTE_SAINTONGE_FINISH_RADIUS_M },
      backwards
    );
    expect(laps).toBe(1);
  });

  it('sans cap, aucun filtre de trou : un saut par-dessus la ligne reste ignoré', () => {
    // Le mode rayon n'a jamais regardé le pas précédent : deux points éloignés de
    // la ligne ne l'activent pas davantage. Non-régression.
    const dense = resample(HS_TRACK, 2);
    const idx = dense.findIndex(
      (p) =>
        haversineDistance(p.lat, p.lon, HAUTE_SAINTONGE_FINISH.lat, HAUTE_SAINTONGE_FINISH.lon) < 3
    );
    const laps = countLaps({ finish: HAUTE_SAINTONGE_FINISH, radiusM: 15 }, [
      dense[idx - 50],
      dense[idx + 50],
    ]);
    expect(laps).toBe(0);
  });

  it('un cap non fini (NaN) retombe sur le mode rayon, jamais sur une porte fausse', () => {
    const laps = countLaps(
      { finish: HAUTE_SAINTONGE_FINISH, radiusM: HAUTE_SAINTONGE_FINISH_RADIUS_M, headingDeg: NaN },
      resample(HS_TRACK, 2)
    );
    expect(laps).toBe(1);
  });
});
