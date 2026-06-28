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
