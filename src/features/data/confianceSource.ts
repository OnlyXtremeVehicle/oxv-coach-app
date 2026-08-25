/**
 * Trames de qualité → entrées du module de confiance par zone. Logique PURE.
 *
 * Le module `confianceLogic` (M03+) exige des trames portant leur POSITION
 * CURVILIGNE dans le tour ; `telemetry_frames` ne la stocke pas. Elle est donc
 * DÉRIVÉE ici par `∫ v dt` — la même convention que `kinematics.distance`
 * (trapèzes sur la vitesse, canal le plus fiable du boîtier ; la position GPS
 * porte un bruit qui s'accumulerait à chaque pas).
 *
 * Deux règles d'honnêteté, héritées du module aval :
 *
 * 1. **Une trame sans vitesse n'a pas de position.** Son `distanceM` vaut
 *    `null` — elle sera comptée « non située » par `evaluerConfianceTour`,
 *    jamais posée à un endroit inventé. L'intégration enjambe la trame : la
 *    distance des suivantes reste juste.
 *
 * 2. **Le tri se fait sur `elapsed_ms`.** `created_at` est un ordre
 *    d'INSERTION (piège documenté du dépôt) ; la file hors ligne peut livrer
 *    dans le désordre, et un pas de temps négatif retrancherait de la distance.
 */

import type { TrameQualite } from '@/features/data/confianceLogic';

/**
 * Ligne brute des canaux de qualité, telle que `loadTramesQualiteTour` la lit.
 * Définie ICI (module pur) pour que le service importe le type, pas l'inverse.
 */
export interface LigneQualite {
  elapsed_ms: number | string;
  speed_kmh: number | null;
  gps_accuracy_m: number | null;
  pdop: number | null;
  satellites: number | null;
  fix_valid: boolean | null;
}

function nombreOuNull(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Mappe les lignes brutes vers `TrameQualite[]`, position curviligne dérivée.
 *
 * La distance démarre à zéro sur la PREMIÈRE trame à vitesse mesurée du tour ;
 * les vitesses négatives (bruit — un capteur ne rend pas de marche arrière)
 * sont traitées comme absentes, même convention que `adaptation.versSamples`.
 */
export function versTramesQualite(lignes: readonly LigneQualite[]): TrameQualite[] {
  const triees = lignes
    .map((l) => ({ ...l, elapsedMs: Number(l.elapsed_ms) }))
    .filter((l) => Number.isFinite(l.elapsedMs))
    .sort((a, b) => a.elapsedMs - b.elapsedMs);

  // Intégration ∫ v dt (trapèzes) entre trames à vitesse MESURÉE consécutives.
  let cumulM = 0;
  let precedent: { elapsedMs: number; vitesseMs: number } | null = null;

  return triees.map((l) => {
    const vitesseKmh = nombreOuNull(l.speed_kmh);
    const vitesseMs = vitesseKmh !== null && vitesseKmh >= 0 ? vitesseKmh / 3.6 : null;

    let distanceM: number | null = null;
    if (vitesseMs !== null) {
      if (precedent !== null) {
        const dt = (l.elapsedMs - precedent.elapsedMs) / 1000;
        if (dt > 0) cumulM += ((vitesseMs + precedent.vitesseMs) / 2) * dt;
      }
      distanceM = cumulM;
      precedent = { elapsedMs: l.elapsedMs, vitesseMs };
    }

    return {
      elapsedMs: l.elapsedMs,
      distanceM,
      gpsAccuracyM: nombreOuNull(l.gps_accuracy_m),
      pdop: nombreOuNull(l.pdop),
      satellites: nombreOuNull(l.satellites),
      fixValid: typeof l.fix_valid === 'boolean' ? l.fix_valid : null,
    };
  });
}

/**
 * Longueur exploitable du tour, en mètres, depuis les trames situées — c'est
 * elle qui alimente `decouperZones`. `null` quand rien n'est situé : un
 * découpage de rien n'existe pas, et l'écran dira l'absence plutôt qu'une note.
 */
export function longueurDerivee(trames: readonly TrameQualite[]): number | null {
  let max = 0;
  for (const t of trames) {
    if (t.distanceM !== null && t.distanceM > max) max = t.distanceM;
  }
  return max > 0 ? max : null;
}
