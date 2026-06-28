/**
 * Data Confidence Score (T-2, V4 §8) — niveau de confiance DE LECTURE d'une
 * session, dérivé de la qualité des trames. PUR (sans réseau), testable.
 *
 * Doctrine d'honnêteté : l'app dit FACTUELLEMENT à quel point sa lecture est
 * solide (complète / partielle / limitée) et POURQUOI, plutôt que de présenter
 * toute analyse au même niveau. Descriptif, jamais un jugement du pilote.
 */

export type ConfidenceLevel = 'complete' | 'partial' | 'limited';

export interface DataConfidence {
  level: ConfidenceLevel;
  /** Libellé humain (« Lecture complète » …). */
  label: string;
  /** Raisons factuelles d'une lecture < complète (vide si complète). */
  reasons: string[];
}

export interface DataQualityInput {
  /** % de trames GPS valides (0–100). */
  pctValid: number;
  /** Nombre de trames exploitées. */
  framesUsed: number;
  /** Virages segmentés. */
  cornersDetected: number;
  /** Tours valides détectés. */
  lapsValid: number;
}

const LABELS: Record<ConfidenceLevel, string> = {
  complete: 'Lecture complète',
  partial: 'Lecture partielle',
  limited: 'Lecture limitée',
};

/**
 * Dérive le niveau de confiance. Renvoie `null` quand il n'y a aucune trame
 * (avant la première vraie capture) : l'écran montre alors son état d'attente
 * honnête plutôt qu'un score trompeur.
 */
export function computeDataConfidence(
  dq: DataQualityInput | null | undefined
): DataConfidence | null {
  if (!dq || dq.framesUsed <= 0) return null;

  const reasons: string[] = [];
  const pct = Math.round(dq.pctValid);
  if (pct < 90) reasons.push(`${pct}% des trames GPS exploitables`);
  if (dq.lapsValid <= 0) reasons.push('aucun tour complet détecté');
  if (dq.cornersDetected <= 0) reasons.push('virages non segmentés');

  let level: ConfidenceLevel;
  if (pct >= 90 && dq.lapsValid > 0 && dq.cornersDetected > 0) {
    level = 'complete';
  } else if (pct >= 60 && (dq.lapsValid > 0 || dq.cornersDetected > 0)) {
    level = 'partial';
  } else {
    level = 'limited';
  }

  return { level, label: LABELS[level], reasons: level === 'complete' ? [] : reasons };
}
