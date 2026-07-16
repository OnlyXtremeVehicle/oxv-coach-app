/**
 * Algorithme de détection des tours OXV
 *
 * Deux modes, selon ce que le circuit renseigne :
 *
 * ── MODE PORTE (dès qu'un cap de franchissement est fourni) ───────────────────
 * La porte est un SEGMENT perpendiculaire à la piste, centré sur la ligne
 * d'arrivée, de demi-longueur `finishLineRadius`. Un tour est compté quand le
 * segment [point précédent → point courant] COUPE ce segment, dans le sens du cap.
 * C'est le fonctionnement des vraies boucles de chronométrage.
 *
 * Pourquoi : les VOIES DES STANDS longent les lignes droites d'arrivée et leur
 * sont PARALLÈLES. Mesuré sur la géométrie réelle (relevés fondateur) :
 *   - Haute Saintonge : stands à 22,9 m de la ligne, cap 300,8° contre 298,5° → 2,3° d'écart ;
 *   - Ricardo Tormo (Valence) : stands à 16,2 m, cap 55,6° contre 55,2° → 0,4° d'écart.
 * En mode rayon, la fenêtre admissible à Valence est [13,0 ; 13,2] m — 20 cm, et
 * vide dès que la voie des stands fait sa largeur standard (10-12 m) : AUCUN rayon
 * ne peut à la fois couvrir la piste et exclure les stands. Un filtre de cap n'y
 * changerait rien (0,4° d'écart). Une voie parallèle décalée latéralement ne coupe
 * JAMAIS une porte qui ne s'étend pas jusqu'à elle : c'est structurel, pas un seuil.
 *
 * ── MODE RAYON (repli, quand aucun cap n'est renseigné) ───────────────────────
 * Comportement historique, conservé à l'identique : entrée dans un disque de
 * `finishLineRadius` autour de la ligne → tour. Sert aux circuits dont le cap
 * n'est pas relevé (« La charade » a `finish_line_heading` NULL) et au repli
 * `BELTOISE_FINISH`. Aucune vérification de direction dans ce mode.
 *
 * Communs aux deux modes :
 *   - cooldown de 10 s minimum entre deux tours (anti-double-comptage) ;
 *   - premier passage de ligne = outlap (arbitré par `lapDetectionRunner`).
 */

import { haversineDistance } from './geo';

/**
 * Géométrie de la porte, précalculée à la création du détecteur.
 * Repère local en mètres, origine = la ligne d'arrivée, x vers l'est, y vers le nord.
 */
interface GateGeometry {
  /** Mètres par degré de latitude, à la latitude de la ligne. */
  metersPerDegLat: number;
  /** Mètres par degré de longitude, à la latitude de la ligne. */
  metersPerDegLon: number;
  /** Extrémité A de la porte (côté cap − 90°), en mètres locaux. */
  ax: number;
  ay: number;
  /** Extrémité B de la porte (côté cap + 90°), en mètres locaux. */
  bx: number;
  by: number;
  /** Vecteur unitaire du cap — donne le SENS obligatoire de franchissement. */
  headingX: number;
  headingY: number;
}

export interface LapDetectorState {
  // Configuration
  finishLineLat: number;
  finishLineLon: number;
  /** Mode rayon : rayon du disque. Mode porte : DEMI-LARGEUR de la porte. Mètres. */
  finishLineRadius: number;
  /** Cap de la piste au franchissement (degrés, 0 = nord). null → mode rayon. */
  finishLineHeadingDeg: number | null;
  /** Porte précalculée. null → mode rayon (repli). */
  gate: GateGeometry | null;

  // État interne — mode rayon uniquement (inutilisés en mode porte)
  isInsideZone: boolean; // actuellement dans la zone d'arrivée
  enteredZoneAt: number | null; // timestamp ms d'entrée dans la zone

  // État interne — mode porte uniquement
  /** Dernier point reçu, en mètres locaux. null tant qu'aucun point n'est arrivé. */
  previousPointM: [number, number] | null;

  // Commun
  lastLapEndAt: number | null; // timestamp ms de fin du dernier tour

  // Tours détectés (timestamps de fin de tour)
  lapEndTimestamps: number[];
}

const COOLDOWN_MS = 10000; // 10 sec minimum entre 2 tours

/**
 * Écart maximal admis entre deux points consécutifs pour évaluer un franchissement.
 *
 * À 25 Hz, un pas de temps vaut ~2,2 m à 200 km/h : le segment [précédent → courant]
 * est court et l'intersection est fiable. Après un TROU de données (reconnexion BLE,
 * perte de fix), les deux points encadrent plusieurs centaines de mètres et le segment
 * qui les relie n'est pas une trajectoire : il pourrait couper la porte sans que le
 * véhicule y soit passé. Au-delà de ce seuil on n'évalue donc PAS le franchissement.
 * Un tour manqué se voit ; un faux tour corrompt le bilan en silence.
 */
const MAX_STEP_M = 50;

const DEG_TO_RAD = Math.PI / 180;

/**
 * Projection locale équirectangulaire autour de la ligne d'arrivée : exacte à
 * cette échelle (quelques centaines de mètres). Même convention que
 * `src/circuit/__tests__/hauteSaintongeCalibration.test.ts`.
 */
function metersPerDegree(latDeg: number): { metersPerDegLat: number; metersPerDegLon: number } {
  const phi = latDeg * DEG_TO_RAD;
  return {
    metersPerDegLat: 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi),
    metersPerDegLon: 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi),
  };
}

function buildGate(lat: number, lon: number, halfWidthM: number, headingDeg: number): GateGeometry {
  const { metersPerDegLat, metersPerDegLon } = metersPerDegree(lat);
  const h = headingDeg * DEG_TO_RAD;
  // Cap 0° = nord, sens horaire → vecteur (sin, cos) dans le repère (est, nord).
  const headingX = Math.sin(h);
  const headingY = Math.cos(h);
  // La porte est perpendiculaire au cap (cap + 90°) : sin(h+90) = cos h, cos(h+90) = −sin h.
  const perpX = headingY;
  const perpY = -headingX;
  return {
    metersPerDegLat,
    metersPerDegLon,
    ax: -halfWidthM * perpX,
    ay: -halfWidthM * perpY,
    bx: halfWidthM * perpX,
    by: halfWidthM * perpY,
    headingX,
    headingY,
  };
}

export function createLapDetector(
  finishLineLat: number,
  finishLineLon: number,
  finishLineRadius: number = 30,
  /**
   * Cap de la piste au franchissement (degrés). Fourni → mode PORTE.
   * Absent/null/non fini → mode RAYON (repli rétrocompatible).
   */
  finishLineHeadingDeg: number | null = null
): LapDetectorState {
  const headingDeg =
    typeof finishLineHeadingDeg === 'number' && Number.isFinite(finishLineHeadingDeg)
      ? finishLineHeadingDeg
      : null;

  return {
    finishLineLat,
    finishLineLon,
    finishLineRadius,
    finishLineHeadingDeg: headingDeg,
    gate:
      headingDeg === null
        ? null
        : buildGate(finishLineLat, finishLineLon, finishLineRadius, headingDeg),
    isInsideZone: false,
    enteredZoneAt: null,
    previousPointM: null,
    lastLapEndAt: null,
    lapEndTimestamps: [],
  };
}

/** Produit vectoriel 2D (composante z). */
function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

/**
 * Le pas [prev → curr] coupe-t-il le segment de porte ?
 *
 * Paramétrage : prev + t·(curr−prev) = A + u·(B−A), franchissement si
 * t ∈ ]0,1] et u ∈ [0,1]. La borne t = 0 est exclue pour qu'un point posé
 * exactement SUR la porte ne soit pas recompté au pas suivant.
 */
function crossesGate(prev: [number, number], curr: [number, number], gate: GateGeometry): boolean {
  const rx = curr[0] - prev[0];
  const ry = curr[1] - prev[1];
  const sx = gate.bx - gate.ax;
  const sy = gate.by - gate.ay;

  const denom = cross(rx, ry, sx, sy);
  // Trajectoire parallèle à la porte (ou pas immobile) : pas de franchissement franc.
  // Dans le doute, on ne compte pas.
  if (denom === 0) return false;

  const qpx = gate.ax - prev[0];
  const qpy = gate.ay - prev[1];
  const t = cross(qpx, qpy, sx, sy) / denom;
  const u = cross(qpx, qpy, rx, ry) / denom;

  return t > 0 && t <= 1 && u >= 0 && u <= 1;
}

/** Mode PORTE — franchissement du segment, dans le sens du cap. */
function processGateCrossing(
  state: LapDetectorState,
  gate: GateGeometry,
  lat: number,
  lon: number,
  timestamp: number
): boolean {
  const curr: [number, number] = [
    (lon - state.finishLineLon) * gate.metersPerDegLon,
    (lat - state.finishLineLat) * gate.metersPerDegLat,
  ];
  const prev = state.previousPointM;
  // Le point courant devient la référence du pas suivant, quoi qu'il advienne
  // ci-dessous : un pas écarté ne doit pas allonger indéfiniment le suivant.
  state.previousPointM = curr;

  if (prev === null) return false; // premier point : aucun pas à évaluer

  const dx = curr[0] - prev[0];
  const dy = curr[1] - prev[1];

  // Trou de données : le segment ne représente pas une trajectoire (cf. MAX_STEP_M).
  if (dx * dx + dy * dy > MAX_STEP_M * MAX_STEP_M) return false;

  // SENS OBLIGATOIRE : seul un franchissement dans le sens du cap compte. Une
  // voiture qui recule, ou qui franchit la porte à contresens (retour stands,
  // manœuvre), ne boucle pas un tour.
  if (dx * gate.headingX + dy * gate.headingY <= 0) return false;

  if (!crossesGate(prev, curr, gate)) return false;

  // Cooldown : anti-double-comptage (même règle qu'en mode rayon).
  if (state.lastLapEndAt !== null && timestamp - state.lastLapEndAt < COOLDOWN_MS) {
    return false;
  }

  state.lastLapEndAt = timestamp;
  state.lapEndTimestamps.push(timestamp);
  return true;
}

/** Mode RAYON — comportement historique, inchangé (repli sans cap). */
function processRadiusZone(
  state: LapDetectorState,
  lat: number,
  lon: number,
  timestamp: number
): boolean {
  // Distance à la ligne d'arrivée
  const distance = haversineDistance(lat, lon, state.finishLineLat, state.finishLineLon);

  const isCurrentlyInside = distance < state.finishLineRadius;

  // Transition : entrée dans la zone
  if (isCurrentlyInside && !state.isInsideZone) {
    state.isInsideZone = true;
    state.enteredZoneAt = timestamp;

    // Vérifier le cooldown
    if (state.lastLapEndAt !== null) {
      const sinceLastLap = timestamp - state.lastLapEndAt;
      if (sinceLastLap < COOLDOWN_MS) {
        // Trop tôt, on ignore
        return false;
      }
    }

    // C'est un nouveau passage → fin du tour précédent (si tour en cours)
    state.lastLapEndAt = timestamp;
    state.lapEndTimestamps.push(timestamp);
    return true;
  }

  // Transition : sortie de la zone
  if (!isCurrentlyInside && state.isInsideZone) {
    state.isInsideZone = false;
    state.enteredZoneAt = null;
  }

  return false;
}

/**
 * Traite une nouvelle position GPS
 * @returns true si un tour vient d'être complété
 */
export function processGpsPoint(
  state: LapDetectorState,
  lat: number,
  lon: number,
  timestamp: number
): boolean {
  if (!lat || !lon) return false;

  if (state.gate !== null) {
    return processGateCrossing(state, state.gate, lat, lon, timestamp);
  }
  return processRadiusZone(state, lat, lon, timestamp);
}

/**
 * Réinitialise le détecteur (à la fin d'une session)
 */
export function resetLapDetector(state: LapDetectorState): void {
  state.isInsideZone = false;
  state.enteredZoneAt = null;
  state.previousPointM = null;
  state.lastLapEndAt = null;
  state.lapEndTimestamps = [];
}

/**
 * Format un temps au tour en mm:ss.SSS
 */
export function formatLapTime(seconds: number): string {
  const totalMs = Math.round(seconds * 1000);
  const min = Math.floor(totalMs / 60000);
  const sec = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;

  return `${min}:${String(sec).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

/**
 * Format un delta de temps : +5.234s ou -1.123s
 */
export function formatLapDelta(seconds: number): string {
  const abs = Math.abs(seconds);
  const sign = seconds >= 0 ? '+' : '-';
  return `${sign}${abs.toFixed(3)}s`;
}
