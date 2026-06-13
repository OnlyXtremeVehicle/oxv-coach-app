/**
 * Heuristique de sélection du virage "à creuser" pour l'écran #16.
 *
 * Doctrine : UNE seule zone à explorer. Pas plus. Le pilote a besoin
 * d'un focus net, pas d'une liste à hiérarchiser. La sélection privilégie
 * le rouge (terrain serré, signal le plus fort), puis le jaune le plus
 * faible (zone à explorer), puis rien (tout est vert, on ne propose rien).
 *
 * V1 utilise les marges mock par virage (cf. mockCornerMargins). Sem 8+
 * remplacera par la vraie data depuis margin_breakdown.
 */

import { BELTOISE_CORNERS, type CornerTopology, getCorner } from '@/lib/circuitTopology';
import type { MarginZone } from '@/types/domain';

export interface FocusCornerSelection {
  corner: CornerTopology;
  zone: MarginZone;
  /** Marge estimée du virage, 0..100. Utilisée pour la phrase contextuelle. */
  estimatedMargin: number;
  /** Phrase manifeste contextualisée selon la zone et le profil. */
  phrase: string;
  /** Sous-titre observationnel, non-directif. */
  observation: string;
}

/**
 * Choisit UN virage à creuser parmi les marges par virage fournies.
 *
 * Priorité :
 *   1. Tout virage rouge (le plus faible si plusieurs)
 *   2. Sinon, le jaune le plus faible
 *   3. Sinon, null — tout est vert, pas de focus à proposer
 *
 * Pour V1, `marginByCornerIndex` provient de mockCornerMargins. Quand on
 * passera à la vraie data, on enrichira avec un score numérique par virage
 * pour départager finement.
 */
export function selectFocusCorner(
  marginByCornerIndex: Record<number, MarginZone>,
  /** Marges numériques 0..100 par virage si dispo. V1 utilise un mapping zone→%. */
  numericMarginByCornerIndex?: Record<number, number>
): FocusCornerSelection | null {
  const candidates = BELTOISE_CORNERS.map((corner) => ({
    corner,
    zone: marginByCornerIndex[corner.index] ?? ('green' as MarginZone),
    margin:
      numericMarginByCornerIndex?.[corner.index] ??
      estimateMarginFromZone(marginByCornerIndex[corner.index] ?? 'green'),
  }));

  const reds = candidates.filter((c) => c.zone === 'red');
  if (reds.length > 0) {
    const winner = reds.reduce((min, c) => (c.margin < min.margin ? c : min));
    return buildSelection(winner.corner, winner.zone, winner.margin);
  }

  const yellows = candidates.filter((c) => c.zone === 'yellow');
  if (yellows.length > 0) {
    const winner = yellows.reduce((min, c) => (c.margin < min.margin ? c : min));
    return buildSelection(winner.corner, winner.zone, winner.margin);
  }

  return null;
}

/**
 * Comme `selectFocusCorner` mais part d'un index forcé (le pilote sélectionne
 * lui-même un virage à creuser depuis la carte). Utile pour les V1.1+.
 */
export function selectExplicitFocusCorner(
  cornerIndex: number,
  zone: MarginZone,
  numericMargin?: number
): FocusCornerSelection | null {
  const corner = getCorner(cornerIndex);
  if (!corner) return null;
  return buildSelection(corner, zone, numericMargin ?? estimateMarginFromZone(zone));
}

function buildSelection(
  corner: CornerTopology,
  zone: MarginZone,
  estimatedMargin: number
): FocusCornerSelection {
  return {
    corner,
    zone,
    estimatedMargin,
    phrase: buildPhrase(corner, zone),
    observation: buildObservation(zone, estimatedMargin),
  };
}

function buildPhrase(corner: CornerTopology, zone: MarginZone): string {
  const name = corner.name;
  switch (zone) {
    case 'red':
      return `${name} a été serré.`;
    case 'yellow':
      return `${name} vous tend les bras.`;
    case 'green':
      // En théorie on n'arrive jamais ici (selectFocusCorner skip les verts).
      return `${name}.`;
  }
}

/**
 * Sous-titre observationnel. Doctrine (frontière fait/cause, Pattern 4) :
 * côté pilote on s'arrête AU FAIT (la marge estimée) et on ouvre une
 * question. On ne désigne JAMAIS une cause à corriger ni un geste à faire
 * (« un repère de freinage plus tôt », « plus de patience à la corde ») —
 * même formulé en question : reformuler un conseil ne le rend pas conforme
 * si le contenu reste actionnable. La causalité orientée appartient au
 * CoachBand (un coach agréé, attribué), jamais au miroir du pilote.
 */
function buildObservation(zone: MarginZone, margin: number): string {
  const pct = Math.round(margin);
  switch (zone) {
    case 'red':
      return `Marge estimée ${pct}%. Qu'avez-vous ressenti à cet endroit ?`;
    case 'yellow':
      return `Marge estimée ${pct}%. Qu'aimeriez-vous explorer ici la prochaine fois ?`;
    case 'green':
      return `Marge confortable.`;
  }
}

/**
 * Estimation grossière d'une marge numérique depuis la zone (V1).
 * Utilisée quand on n'a que le mock par zone, pas de chiffre précis.
 */
function estimateMarginFromZone(zone: MarginZone): number {
  switch (zone) {
    case 'red':
      return 10;
    case 'yellow':
      return 22;
    case 'green':
      return 50;
  }
}
