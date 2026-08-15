/**
 * Garde-fou de RENDU du débrief (T-1, défense en profondeur).
 *
 * La génération est déjà filtrée (PR-01, `generateSafeDebrief`), mais le rendu
 * ne fait jamais aveuglément confiance à `debrief_text` : ce texte peut arriver
 * par un chemin non maîtrisé (edge OpenAI, écriture manuelle, ancienne donnée).
 * Avant affichage, on blanchit tout acte contenant une tournure prescriptive —
 * l'écran retombe alors sur son texte d'attente neutre plutôt que d'exposer une
 * formulation non conforme à la doctrine.
 *
 * Pur (pas de React Native) → testable sans monter le composant. Voir
 * `aiSafetyFilter` (source du lexique).
 *
 * ===========================================================================
 * ⚠ DORMANT — ET NE PAS L'ARMER. MESURÉ LE 15/08/2026.
 * ===========================================================================
 *
 * Ce module n'a qu'un appelant, `DebriefMirror`, et ce composant n'est monté
 * NULLE PART. Il est donc inatteignable depuis un écran (garde orphelins,
 * mesure transitive du 15/08).
 *
 * La tentation évidente est de le brancher au bilan. **Ce serait une
 * régression.** Le bilan tient déjà sa propre ceinture, et elle est PLUS
 * STRICTE :
 *
 *     ici           — chaque acte est jugé séparément ; un acte non conforme
 *                     est blanchi, les deux autres sont affichés ;
 *     bilanLogic:569 — `isDoctrineSafe(raw)` sur le texte ENTIER ; un seul
 *                     passage non conforme fait tomber tout le récit généré
 *                     au repli local.
 *
 * Le tout-ou-rien du bilan est le bon comportement : un débrief dont un tiers
 * a été blanchi se lit comme un texte amputé sans que le pilote sache pourquoi.
 *
 * Un orphelin ne se branche pas parce qu'il est orphelin. Celui-ci est à
 * SUPPRIMER ou à laisser dormir en connaissance de cause — pas à armer.
 */

import { isDoctrineSafe } from './aiSafetyFilter';

export interface DebriefActs {
  act1: string;
  act2: string;
  act3: string;
}

/**
 * Renvoie les actes du débrief avec tout acte non conforme blanchi (chaîne
 * vide). Préserve les autres champs (ex. `sign`, constant et neutre).
 */
export function guardDebriefActs<T extends DebriefActs>(acts: T): T {
  return {
    ...acts,
    act1: isDoctrineSafe(acts.act1) ? acts.act1 : '',
    act2: isDoctrineSafe(acts.act2) ? acts.act2 : '',
    act3: isDoctrineSafe(acts.act3) ? acts.act3 : '',
  };
}
