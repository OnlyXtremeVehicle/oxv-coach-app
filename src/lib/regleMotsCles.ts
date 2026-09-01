/**
 * LA RÈGLE DES MOTS-CLÉS, écrite une fois — logique PURE.
 *
 * ===========================================================================
 * CE QU'ELLE DIT
 * ===========================================================================
 *
 * Toute feuille de données ne montre que des mots-clés, jamais de phrase.
 *
 * Une chaîne est une PHRASE si elle compte **plus de trois mots ET** contient
 * un mot outil. Les deux conditions comptent : « 12 VIRAGES » n'est pas une
 * phrase (trop court), « TOURS DE LA SÉANCE » non plus par le compte mais oui
 * par le mot outil — d'où la seconde règle d'écriture ci-dessous, plus stricte
 * que la définition.
 *
 * ===========================================================================
 * POURQUOI L'ÉCRITURE EST PLUS STRICTE QUE LA DÉTECTION
 * ===========================================================================
 *
 * `estPhrase` décrit ce qu'on REFUSE. `estMotCle` décrit ce qu'on ÉCRIT, et il
 * interdit tout mot outil, même dans un fragment de trois mots que la
 * définition laisserait passer.
 *
 * La raison est la composition. Les mots-clés se combinent —
 * `DONNÉE ABSENTE · <libellé>` — et deux fragments licites peuvent produire une
 * chaîne qui ne l'est plus. Interdire le mot outil à l'écriture rend la
 * composition sûre par construction, au lieu de la vérifier au cas par cas.
 *
 * Ce module ne connaît aucun écran. Il ne sait pas non plus quelles surfaces
 * sont des feuilles de données : cela vit dans `surfacesRestitution`.
 */

/**
 * Les mots outils, tels que le brief les énumère. Aucun n'est ajouté ni
 * retranché ici — la liste est celle du dossier, mot pour mot.
 */
export const MOTS_OUTILS: readonly string[] = [
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de',
  'vous', 'votre', 'vos',
  'est', 'sont', 'a', 'ont', 'était', 'sera',
  'dans', 'avec', 'pour', 'que', 'qui', 'sur', 'sans',
  'plus', 'moins', 'ce', 'cette',
];

const OUTILS = new Set(MOTS_OUTILS);

/** Au-delà de ce nombre de mots, la chaîne peut être une phrase. */
export const MOTS_MAX_FRAGMENT = 3;

/** De chaque côté du point médian, un mot-clé ne dépasse pas ce compte. */
export const MOTS_MAX_PAR_COTE = 3;

/**
 * Découpe en mots. Les apostrophes typographiques et droites séparent, parce
 * que « l'écran » porte deux mots dont le premier est un mot outil — et c'est
 * précisément celui qu'on cherche.
 */
export function mots(chaine: string): string[] {
  return chaine
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .split(/[^0-9a-zàâäçéèêëîïôöùûüÿœæ]+/i)
    .filter((m) => m.length > 0);
}

/** La chaîne contient-elle au moins un mot outil ? */
export function contientMotOutil(chaine: string): boolean {
  return mots(chaine).some((m) => OUTILS.has(m));
}

/**
 * La chaîne est-elle une PHRASE au sens du brief ?
 *
 * Plus de trois mots ET au moins un mot outil. Une seule des deux conditions ne
 * suffit pas — c'est la définition du dossier, et l'élargir ferait échouer la
 * garde sur des mots-clés légitimes.
 */
export function estPhrase(chaine: string): boolean {
  const m = mots(chaine);
  return m.length > MOTS_MAX_FRAGMENT && m.some((x) => OUTILS.has(x));
}

/** Ce qui empêche une chaîne d'être un mot-clé, ou `null` si elle en est un. */
export type MotifRefus =
  | 'mot outil'
  | 'minuscules'
  | 'trop de mots'
  | 'verbe conjugué'
  | 'vide';

/**
 * Quelques terminaisons de verbes conjugués courantes dans ce domaine. La liste
 * est volontairement COURTE : elle attrape les cas réels du dépôt sans
 * prétendre conjuguer le français. Un faux négatif ici est préférable à une
 * garde qui refuse « FREINAGE » parce qu'elle croit y voir un verbe.
 */
const VERBES_CONJUGUES =
  /^(?:.*(?:ez|ons|iez|ions)|(?:est|sont|sera|était|ont|avez|voyez|regardez))$/i;

/**
 * Un fragment respecte-t-il les quatre règles d'écriture ?
 *
 * Rend `null` si c'est un mot-clé valide, sinon le motif du refus. La forme
 * `SUJET · PRÉCISION` est acceptée : chaque côté est contrôlé séparément.
 */
export function motifRefusMotCle(chaine: string): MotifRefus | null {
  const brut = chaine.trim();
  if (brut.length === 0) return 'vide';

  // Règle 4 — aucun mot outil, jamais, même dans un fragment court.
  if (contientMotOutil(brut)) return 'mot outil';

  // Règle 1 — majuscules. On compare sur les seules lettres : chiffres,
  // ponctuation et point médian n'ont pas de casse.
  const lettres = brut.replace(/[^a-zàâäçéèêëîïôöùûüÿœæA-ZÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸŒÆ]/g, '');
  if (lettres.length > 0 && lettres !== lettres.toUpperCase()) return 'minuscules';

  // Règle 2 — trois mots au plus de chaque côté du point médian.
  for (const cote of brut.split('·')) {
    const m = mots(cote);
    if (m.length > MOTS_MAX_PAR_COTE) return 'trop de mots';
    // Règle 1 (suite) — jamais de verbe conjugué.
    if (m.some((x) => VERBES_CONJUGUES.test(x))) return 'verbe conjugué';
  }
  return null;
}

/** Raccourci : la chaîne est-elle un mot-clé valide ? */
export function estMotCle(chaine: string): boolean {
  return motifRefusMotCle(chaine) === null;
}
