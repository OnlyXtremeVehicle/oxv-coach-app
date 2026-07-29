/**
 * Les virages, posés sur la courbe de delta — jalon 4, phase 4septies.
 * Logique PURE.
 *
 * *« Virages nommés sur la courbe de delta »* — plan de montage, 4septies.
 *
 * ---
 *
 * LA CONVERSION, ET CE QU'ELLE SUPPOSE
 *
 * L'analyse de segments situe chaque virage par un `startProgress` entre zéro
 * et un. Ce n'est pas une durée : il vient d'une projection du point GPS sur
 * l'axe du circuit (`mapMatchPoint`), donc d'une fraction de la LONGUEUR du
 * tracé. La convertir en mètres est légitime.
 *
 * Mais l'axe de la courbe de delta n'est pas l'axe du circuit : c'est `∫ v dt`,
 * la distance que le VÉHICULE a parcourue. Elle dépasse toujours un peu la
 * longueur de l'axe — un véhicule ne roule pas sur la ligne médiane.
 *
 * **On suppose donc que l'écart se répartit uniformément le long du tour.** Sur
 * un tour entier c'est vrai à un pour cent près ; localement, un repère peut
 * glisser de quelques mètres. Pour poser une étiquette au-dessus d'une courbe,
 * c'est sans conséquence — pour mesurer, ce serait à refaire.
 *
 * L'approximation est nommée ici plutôt que cachée dans un composant.
 *
 * ---
 *
 * SEULS LES VIRAGES SONT NOMMÉS
 *
 * Les lignes droites portent un nom dans la définition du circuit, mais poser
 * « ligne droite » sur une courbe de delta n'apprend rien et mange la place des
 * repères qui comptent. On garde les virages et les chicanes.
 */

import type { Repere } from '@/telemetry/courbeDelta';

/** Le strict nécessaire d'une ligne d'analyse de segment. */
export interface SegmentSituable {
  segmentIndex: number;
  segmentName: string | null;
  kind: string | null;
  /** Début du segment sur le tracé, entre 0 et 1. */
  startProgress: number | null;
}

/** Ce qui mérite un repère sur la courbe. */
const NOMMABLES = new Set(['turn', 'chicane']);

/** « V3 » quand le circuit n'a pas donné de nom à son virage. */
function nomDe(s: SegmentSituable): string {
  const brut = s.segmentName?.trim();
  if (brut) return brut;
  return `V${s.segmentIndex + 1}`;
}

/**
 * Les repères à poser sur une courbe de delta.
 *
 * `longueurTourM` est la longueur MESURÉE du tour affiché — celle que porte le
 * dernier point de la grille de la courbe. La passer plutôt que de la déduire
 * évite que deux écrans placent le même virage à deux endroits.
 *
 * Rend une liste vide dès que la longueur n'est pas exploitable : mieux vaut
 * une courbe sans repères qu'une courbe dont les repères mentent.
 */
export function reperesDepuisSegments(
  segments: readonly SegmentSituable[],
  longueurTourM: number
): Repere[] {
  if (!Number.isFinite(longueurTourM) || longueurTourM <= 0) return [];

  const out: Repere[] = [];
  for (const s of segments) {
    if (s.kind === null || !NOMMABLES.has(s.kind)) continue;
    const p = s.startProgress;
    if (p === null || !Number.isFinite(p) || p < 0 || p > 1) continue;
    out.push({ distanceM: p * longueurTourM, nom: nomDe(s) });
  }
  return out.sort((a, b) => a.distanceM - b.distanceM);
}
