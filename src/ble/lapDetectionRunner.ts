/**
 * Détection de tours en live sur le stream BLE RaceBox.
 *
 * Démarré à l'ouverture d'une session de roulage (manuel pour V1 depuis
 * l'écran de capture, automatique en sem. 5+ quand le flow paddock sera
 * câblé).
 *
 * Architecture :
 *   bluetoothService.onData (RaceBoxData)
 *     ↓ filter sur gps.fix == Fix3D
 *     ↓ processGpsPoint (V1 utils/lapDetection)
 *     ↓ si tour complet
 *         ↓ useSessionStore.registerLap(durationMs)
 *
 * Le premier passage de ligne après start = outlap, pas compté comme tour
 * valide (`previousLapAt` n'est set qu'après ce premier passage).
 */

import { bluetoothService } from './bluetoothService';
import { useSessionStore } from '@/store/useSessionStore';
import { GpsFix } from '@/types/telemetry';
import { nextMonotonic } from '@/utils/monotonicClock';
import { DEFAULT_FINISH_RADIUS_M } from '@/services/captureFinishLineLogic';
import {
  type LapDetectorState,
  avancerOdometre,
  createLapDetector,
  processGpsPoint,
  resetLapDetector,
} from '@/utils/lapDetection';

let state: LapDetectorState | null = null;
let unsubscribe: (() => void) | null = null;
/** Instant MURAL (Date.now) du dernier passage — sert à l'affichage des dates. */
let previousLapWallMs: number | null = null;
/** Instant MONOTONE du dernier passage — sert à MESURER la durée du tour. */
let previousLapMonoMs: number | null = null;
/** Dernière base monotone retenue (max-monotone sur l'horloge murale). */
let lastMonoMs = 0;
let previousLapLat: number | null = null;
let previousLapLon: number | null = null;
let lapNumber = 0;
/**
 * Détection SUSPENDUE par le pilote (arrêt aux stands).
 *
 * Distinct de `stopLapDetection`, qui DÉTRUIT l'état : ici le détecteur, les
 * tours déjà enregistrés et le numéro de tour survivent intacts. Sans cette
 * distinction, une pause aux stands effacerait le chronométrage de la séance —
 * ou, si l'on ne suspendait rien, un retour en piste par la ligne compterait un
 * tour de plusieurs minutes passées à l'arrêt.
 */
let suspendu = false;

/** Un tour complet détecté, prêt à être persisté dans la table `laps`. */
export interface RecordedLap {
  lapNumber: number;
  startedAtMs: number;
  endedAtMs: number;
  durationMs: number;
  startLat: number | null;
  startLon: number | null;
  endLat: number | null;
  endLon: number | null;
}

let recordedLaps: RecordedLap[] = [];

/** Tours détaillés enregistrés depuis le dernier startLapDetection (snapshot). */
export function getRecordedLaps(): RecordedLap[] {
  return [...recordedLaps];
}

export interface LapDetectionStartOptions {
  finishLineLat: number;
  finishLineLon: number;
  /** Mode rayon : rayon du disque. Mode porte : DEMI-LARGEUR de la porte. */
  finishLineRadiusM?: number;
  /**
   * Cap de la piste au franchissement (degrés, 0 = nord). Fourni → détection par
   * PORTE (segment perpendiculaire), seule capable d'exclure une voie des stands
   * parallèle. Absent → repli sur le mode rayon historique.
   */
  finishLineHeadingDeg?: number | null;
  /**
   * Distance minimale (m) entre deux tours comptés — dérivée de la longueur du
   * circuit par `captureFinishLineFor`. Absente → aucune garde de distance.
   */
  minLapDistanceM?: number | null;
}

export function startLapDetection(opts: LapDetectionStartOptions): void {
  stopLapDetection();
  state = createLapDetector(
    opts.finishLineLat,
    opts.finishLineLon,
    /**
     * MÊME DÉFAUT QUE `captureFinishLineFor`, ET C'EST TOUT L'INTÉRÊT.
     *
     * Cette ligne valait 30 pendant que `captureFinishLineFor` posait 40 :
     * deux valeurs pour une seule notion, aux deux bouts de la même chaîne.
     * L'écart ne se voyait pas — l'appelant nominal fournit toujours un rayon,
     * donc ce repli-ci ne se déclenchait jamais. C'est exactement le genre de
     * chemin où une incohérence dort jusqu'au jour où un troisième appelant
     * l'emprunte.
     *
     * Le nombre est importé plutôt que recopié : deux constantes égales
     * finissent toujours par diverger.
     */
    opts.finishLineRadiusM ?? DEFAULT_FINISH_RADIUS_M,
    opts.finishLineHeadingDeg ?? null,
    opts.minLapDistanceM ?? null
  );
  previousLapWallMs = null;
  previousLapMonoMs = null;
  lastMonoMs = 0;
  previousLapLat = null;
  previousLapLon = null;
  lapNumber = 0;
  recordedLaps = [];
  suspendu = false;

  unsubscribe = bluetoothService.onData((frame) => {
    if (!state) return;
    // Pause du pilote : on n'arbitre plus rien et on n'alimente plus l'odomètre.
    // Le temps passé aux stands n'appartient à aucun tour.
    if (suspendu) return;
    /**
     * FIX INCOMPLET : on n'arbitre PAS le franchissement, mais on avance quand
     * même l'odomètre.
     *
     * Ce `return` écartait la trame en entier. Or un fix 2D porte une position
     * et une vitesse Doppler exploitables : le véhicule roulait, et le compteur
     * de distance restait immobile. Après une zone de mauvaise réception, la
     * garde de distance minimale voyait donc moins de kilomètres que la
     * réalité, et pouvait refuser un tour VRAI.
     */
    if (frame.gps.fix < GpsFix.Fix3D) {
      avancerOdometre(
        state,
        frame.gps.latitude,
        frame.gps.longitude,
        nextMonotonic(lastMonoMs, Date.now()),
        frame.motion.speed
      );
      return;
    }

    // Deux horloges, deux usages distincts (Valencia §4.6) :
    //   - `wallNow` (horloge murale) : instant D'AFFICHAGE, horodate les dates de
    //     début/fin de tour (startedAtMs/endedAtMs → ISO). Le recul éventuel de
    //     cette horloge n'affecte que l'étiquette de date, pas la mesure.
    //   - `monoNow` (base MONOTONE) : instant de MESURE. Non décroissant (max avec
    //     le dernier point), il sert à la fois au cooldown de détection et au
    //     calcul de la durée — jamais faussé par un recul d'horloge (throttling
    //     arrière-plan / resynchro NTP). Même convention que l'`elapsed_ms` des
    //     trames dans captureSessionService.
    const wallNow = Date.now();
    lastMonoMs = nextMonotonic(lastMonoMs, wallNow);
    const monoNow = lastMonoMs;
    // `frame.motion.speed` est en km/h (parser UBX : mm/s × 3,6 / 1000). Elle
    // alimente l'odomètre de la garde de distance minimale — c'est la vitesse
    // Doppler, nulle à l'arrêt, là où la position dérive (cf. `lapDetection`).
    const completedLap = processGpsPoint(
      state,
      frame.gps.latitude,
      frame.gps.longitude,
      monoNow,
      frame.motion.speed
    );

    if (!completedLap) {
      return;
    }

    if (previousLapMonoMs !== null && previousLapWallMs !== null) {
      // Durée = différence de deux instants MONOTONES → toujours ≥ 0.
      const lapDurationMs = monoNow - previousLapMonoMs;
      lapNumber += 1;
      useSessionStore.getState().registerLap(lapDurationMs);
      recordedLaps.push({
        lapNumber,
        // startedAt/endedAt = instants MURAUX (dates affichables).
        startedAtMs: previousLapWallMs,
        endedAtMs: wallNow,
        // durationMs = durée MESURÉE sur la base monotone.
        durationMs: lapDurationMs,
        startLat: previousLapLat,
        startLon: previousLapLon,
        endLat: frame.gps.latitude,
        endLon: frame.gps.longitude,
      });
    }
    // Le premier passage = fin d'outlap : on mémorise le point de départ du
    // premier tour chronométré, sans le compter.
    previousLapWallMs = wallNow;
    previousLapMonoMs = monoNow;
    previousLapLat = frame.gps.latitude;
    previousLapLon = frame.gps.longitude;
  });
}

/**
 * Suspend la détection SANS perdre l'état (arrêt aux stands).
 *
 * Le pilote reste maître : rien ne se suspend tout seul. Une interruption BLE
 * a son propre chemin, qui n'emprunte pas celui-ci.
 */
export function pauseLapDetection(): void {
  suspendu = true;
}

/** Reprend la détection là où elle s'était arrêtée. */
export function resumeLapDetection(): void {
  suspendu = false;
}

export function stopLapDetection(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (state) resetLapDetector(state);
  state = null;
  suspendu = false;
  previousLapWallMs = null;
  previousLapMonoMs = null;
  lastMonoMs = 0;
}

/**
 * Numéro du tour CHRONOMÉTRÉ en cours, ou 0 tant que la ligne n'a pas été
 * franchie une première fois (outlap : aucun tour commencé).
 *
 * LECTURE SEULE — ce runner reste seul propriétaire des frontières de tour. Ce
 * getter existe pour que la capture (captureSessionService) puisse RATTACHER
 * chaque trame au tour qu'elle mesure, sans dupliquer la détection : les deux
 * sont abonnés au MÊME flux BLE, et ce runner s'abonne le PREMIER — quand la
 * capture lit ce numéro pour une trame, le franchissement porté par cette trame
 * est donc déjà pris en compte ici. Un changement de valeur entre deux trames
 * signifie exactement « le tour précédent vient de se clore ».
 *
 * `lapNumber` compte les tours CLOS ; le tour en cours est donc le suivant. Le 0
 * de l'outlap n'est pas un numéro de tour : il dit « rien à mesurer encore », et
 * distingue les trames d'approche (freinages, appuis) des mesures du tour 1 —
 * les leur attribuer fabriquerait un maximum que le tour 1 n'a pas produit.
 */
export function getCurrentLapNumber(): number {
  return previousLapMonoMs === null ? 0 : lapNumber + 1;
}

export interface LapDetectorStatus {
  active: boolean;
  rawCrossings: number;
}

export function getLapDetectorStatus(): LapDetectorStatus {
  return {
    active: state !== null,
    rawCrossings: state?.lapEndTimestamps.length ?? 0,
  };
}

/**
 * Distance TOTALE parcourue depuis le début de la détection, en mètres.
 *
 * Elle alimente `telemetry_sessions.distance_km`, qui n'a jamais reçu de valeur
 * jusqu'au 13/08/2026 : la colonne existait, le bilan et la Saison la lisaient,
 * et elle valait `null` sur toutes les séances. La mesure était pourtant là.
 *
 * `null` quand aucune détection n'est active : l'absence, pas un zéro.
 */
export function getDistanceTotaleM(): number | null {
  return state?.distanceTotaleM ?? null;
}
