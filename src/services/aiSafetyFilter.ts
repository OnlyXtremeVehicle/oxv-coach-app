/**
 * Filtre de sécurité doctrinale (T-1) — garde-fou des sorties générées.
 *
 * Doctrine OXV : « l'app est un miroir, pas un coach ». Aucune sortie — débrief
 * J+1, futur assistant coach (C-1), focus corner — ne doit contenir d'INSTRUCTION
 * DE PILOTAGE ni de tournure prescriptive. Ce module est la **source unique** du
 * lexique proscrit : toute fonctionnalité IA passe par lui AVANT d'afficher quoi
 * que ce soit. C'est un garde-fou de dernier recours, complémentaire de la
 * validation humaine côté coach — jamais un substitut.
 *
 * Périmètre VOLONTAIREMENT restreint aux **prescriptions** (verbes directifs,
 * obligations, interdictions, conseils déguisés en groupe nominal). Il ne juge
 * NI le style, NI la préférence « marge » plutôt que « limite » (ça, c'est de la
 * relecture éditoriale, pas une violation prescriptive). Mieux vaut bloquer une
 * tournure ambiguë que laisser passer un ordre : en cas de doute, on bloque.
 *
 * Pur, sans dépendance, testé dans `__tests__/aiSafetyFilter.test.ts`.
 */

export type ProscriptionCategory =
  | 'imperatif_pilotage' // ordre de conduite ("freinez", "accélérez")
  | 'obligation' // "il faut", "vous devez", "vous devriez"
  | 'interdiction' // "évitez", "abstenez-vous"
  | 'conseil_deguise'; // groupe nominal directif ("repère de freinage")

export interface ProscribedMatch {
  /** Terme normalisé (minuscule, sans accent) effectivement trouvé. */
  term: string;
  category: ProscriptionCategory;
  /** Index de début dans le texte normalisé (indicatif, pour le debug). */
  index: number;
}

/**
 * Lexique proscrit — formes NORMALISÉES (minuscule, sans accent, apostrophe
 * droite). Le matching se fait sur des mots entiers (`\b`), donc « accélération »
 * (nom, descriptif) ne déclenche pas « accélère », et « terrain plus serré »
 * (autorisé) ne déclenche pas « serrez ».
 *
 * Ordre par longueur décroissante construit à la compilation : les expressions
 * multi-mots priment.
 */
const PROSCRIBED: readonly (readonly [string, ProscriptionCategory])[] = [
  // — Impératifs de pilotage (interdits absolus : aucune consigne de conduite) —
  ['freinez', 'imperatif_pilotage'],
  ['freine', 'imperatif_pilotage'],
  ['accelerez', 'imperatif_pilotage'],
  ['accelere', 'imperatif_pilotage'],
  ['ralentissez', 'imperatif_pilotage'],
  ['ralentis', 'imperatif_pilotage'],
  ['tournez', 'imperatif_pilotage'],
  ['braquez', 'imperatif_pilotage'],
  ['contre-braquez', 'imperatif_pilotage'],
  ['visez', 'imperatif_pilotage'],
  ['tracez', 'imperatif_pilotage'],
  ['redressez', 'imperatif_pilotage'],
  ['positionnez', 'imperatif_pilotage'],
  ['appuyez', 'imperatif_pilotage'],
  ['relachez', 'imperatif_pilotage'],
  ['lachez', 'imperatif_pilotage'],
  ['poussez', 'imperatif_pilotage'],
  ['pousse', 'imperatif_pilotage'],
  ['prenez', 'imperatif_pilotage'],
  ['gardez', 'imperatif_pilotage'],
  ['serrez', 'imperatif_pilotage'],
  ['ouvrez les gaz', 'imperatif_pilotage'],
  ['coupez les gaz', 'imperatif_pilotage'],
  ['mettez les gaz', 'imperatif_pilotage'],
  // — Obligations / conseils prescriptifs —
  ['il faut', 'obligation'],
  ['il faudrait', 'obligation'],
  ['il faudra', 'obligation'],
  ['vous devez', 'obligation'],
  ['vous devriez', 'obligation'],
  ['vous auriez du', 'obligation'],
  ['tu dois', 'obligation'],
  ['tu devrais', 'obligation'],
  ['tu peux', 'obligation'],
  ['vous pouvez', 'obligation'],
  ['essayez de', 'obligation'],
  ['essaie de', 'obligation'],
  ['pensez a', 'obligation'],
  ['veillez a', 'obligation'],
  // — Interdictions —
  ['evitez', 'interdiction'],
  ['evite', 'interdiction'],
  ['abstenez', 'interdiction'],
  ['arretez de', 'interdiction'],
  // — Conseils déguisés en groupe nominal (frontière fait/cause, côté pilote) —
  ['repere de freinage', 'conseil_deguise'],
  ['repere de corde', 'conseil_deguise'],
  ['point de corde', 'conseil_deguise'],
  ['patience a la corde', 'conseil_deguise'],
];

/**
 * Catalogue public (lecture seule), trié par longueur décroissante. Verrouillé
 * par un test snapshot : toute évolution doctrinale est un changement explicite,
 * tracé, et non un effet de bord.
 */
export const DOCTRINE_PROSCRIBED_TERMS: readonly {
  term: string;
  category: ProscriptionCategory;
}[] = [...PROSCRIBED]
  .sort((a, b) => b[0].length - a[0].length)
  .map(([term, category]) => ({ term, category }));

/** Erreur levée par `assertDoctrineSafe` quand une sortie viole la doctrine. */
export class DoctrineViolationError extends Error {
  readonly violations: ProscribedMatch[];
  constructor(violations: ProscribedMatch[], context?: string) {
    const terms = violations.map((v) => `« ${v.term} »`).join(', ');
    super(
      `Sortie non conforme à la doctrine OXV${context ? ` (${context})` : ''} : ` +
        `tournure(s) prescriptive(s) détectée(s) : ${terms}.`
    );
    this.name = 'DoctrineViolationError';
    this.violations = violations;
  }
}

/**
 * Normalise pour le matching : minuscule, accents retirés (NFD), apostrophes
 * typographiques unifiées, espaces compactés. Après normalisation tout est en
 * ASCII [a-z0-9' -], ce qui rend `\b` fiable (sans recourir au lookbehind, non
 * garanti sur Hermes).
 */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // diacritiques combinants
    .replace(/[‘’ʼ′]/g, "'") // apostrophes typographiques → droite
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const TERM_TO_CATEGORY = new Map<string, ProscriptionCategory>(
  PROSCRIBED.map(([term, category]) => [term, category])
);

// Une seule passe regex : alternation de tous les termes, bornée par `\b`.
// Termes longs en premier pour que les expressions multi-mots l'emportent.
const COMBINED = new RegExp(
  '\\b(' +
    [...PROSCRIBED]
      .map(([term]) => term)
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp)
      .join('|') +
    ')\\b',
  'g'
);

/**
 * Renvoie toutes les tournures proscrites trouvées (vide si la sortie est
 * conforme). N'altère pas le texte.
 */
export function findProscribedTerms(text: string): ProscribedMatch[] {
  if (!text) return [];
  const normalized = normalize(text);
  const matches: ProscribedMatch[] = [];
  // Regex partagée : on remet lastIndex à 0 (état global du flag 'g').
  COMBINED.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = COMBINED.exec(normalized)) !== null) {
    const term = m[1];
    matches.push({
      term,
      category: TERM_TO_CATEGORY.get(term) ?? 'imperatif_pilotage',
      index: m.index,
    });
    // Garde-fou anti-boucle si un terme vide se glissait (impossible ici).
    if (COMBINED.lastIndex === m.index) COMBINED.lastIndex++;
  }
  return matches;
}

/** `true` si la sortie ne contient aucune tournure prescriptive. */
export function isDoctrineSafe(text: string): boolean {
  return findProscribedTerms(text).length === 0;
}

/**
 * Garde-fou bloquant : lève `DoctrineViolationError` si la sortie contient une
 * tournure prescriptive. À appeler AVANT d'afficher/persister toute sortie
 * générée (débrief, assistant coach…). `context` enrichit le message d'erreur.
 */
export function assertDoctrineSafe(text: string, context?: string): void {
  const violations = findProscribedTerms(text);
  if (violations.length > 0) {
    throw new DoctrineViolationError(violations, context);
  }
}
