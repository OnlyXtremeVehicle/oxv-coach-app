/**
 * LES EXCEPTIONS À LA RÈGLE DES MOTS-CLÉS — nommées, justifiées, datées.
 *
 * Une exception non écrite est une règle qui ne s'applique pas, et personne ne
 * le sait. Chaque entrée porte donc son motif en français et sa date : le jour
 * où l'on se demande pourquoi une phrase subsiste sur une feuille de données,
 * la réponse est ici.
 *
 * Le dossier P4 en annonce trois. On n'en ajoute pas une quatrième sans dire
 * pourquoi, et une exception qui n'attrape plus rien se retire.
 */

export interface ExceptionRestitution {
  /** Chemin exact, séparateurs POSIX. */
  readonly fichier: string;
  /** Fragment reconnaissable de la chaîne autorisée. */
  readonly fragment: string;
  /** Pourquoi la phrase reste, en français. */
  readonly motif: string;
  /** Quand l'exception a été posée. */
  readonly depuis: string;
}

/**
 * TROIS CATÉGORIES QUE LA RÈGLE NE GOUVERNE PAS, et qu'il fallait nommer.
 *
 * La première mesure du 01/09/2026 a rendu soixante-neuf phrases bloquantes sur
 * les deux écrans du Mans. En les lisant une à une, trois familles n'avaient
 * rien à faire là — non par indulgence, mais parce que la règle ne parle pas
 * d'elles :
 *
 *   • Les LIBELLÉS D'ACCESSIBILITÉ. Ils ne s'affichent jamais ; un lecteur
 *     d'écran les énonce. « Comparer cette séance à une autre » est exactement
 *     ce qu'il faut entendre, et un mot-clé y serait inutilisable. La règle des
 *     mots-clés gouverne ce qui se LIT sur une feuille, pas ce qui s'ENTEND.
 *
 *   • Les CINQ ÉTATS. La doctrine exige que l'état vide nomme le champ manquant
 *     et que l'erreur dise sa cause : « Aucun tour complet capté pour cette
 *     séance » est la forme imposée. Interdire la phrase ici mettrait deux
 *     règles du même brief en contradiction.
 *
 *   • Les AMORCES DE SAISIE. Un `placeholder` décrit ce qu'on attend dans un
 *     champ ; il disparaît dès la première frappe.
 *
 * Ces trois-là s'écartent par le RÔLE de la chaîne, pas par son contenu — d'où
 * une liste de marqueurs plutôt qu'une liste de textes.
 */
export const ROLES_HORS_REGLE: readonly { readonly marqueur: string; readonly motif: string }[] = [
  { marqueur: 'accessibilityLabel', motif: 'énoncé par un lecteur d’écran, jamais affiché' },
  { marqueur: 'accessibilityHint', motif: 'énoncé par un lecteur d’écran, jamais affiché' },
  { marqueur: 'accessibilityValue', motif: 'énoncé par un lecteur d’écran, jamais affiché' },
  { marqueur: 'accessibilityActions', motif: 'nom d’action pour lecteur d’écran' },
  { marqueur: 'emptyMessage', motif: 'état vide — la doctrine exige qu’il nomme le champ manquant' },
  { marqueur: 'emptyLabel', motif: 'état vide — même exigence' },
  { marqueur: 'emptySource', motif: 'provenance citée telle quelle' },
  { marqueur: 'errorCause', motif: 'état d’erreur — la doctrine exige qu’il dise sa cause' },
  { marqueur: 'placeholder', motif: 'amorce de saisie, effacée à la première frappe' },
];

export const EXCEPTIONS: readonly ExceptionRestitution[] = [
  {
    fichier: 'app/(app2)/bilan/[sessionId].tsx',
    fragment: 'intention.body',
    motif:
      'Verbatim humain. Le pilote a dicté ses mots ; les réduire à un mot-clé ' +
      'reviendrait à réécrire sa parole. La règle gouverne ce que l’application ' +
      'énonce, jamais ce qu’un humain a dit.',
    depuis: '2026-09-01',
  },
  {
    fichier: 'app/(app2)/bilan/[sessionId].tsx',
    fragment: 'note.body',
    motif:
      'Verbatim du coach, même raison. La phrase est attribuée et porte le nom ' +
      'de son auteur — c’est une feuille de récit enclavée dans une feuille de ' +
      'données, et l’attribution est ce qui rend la cohabitation lisible.',
    depuis: '2026-09-01',
  },
  {
    fichier: '*',
    fragment: 'errorCause',
    motif:
      'État d’erreur. Une reprise se dit en une phrase : « La file n’a pas pu ' +
      'être chargée » nomme la panne et ce qu’on peut faire ensuite. Un mot-clé ' +
      'y serait un mot de plus à décoder au pire moment.',
    depuis: '2026-09-01',
  },
  {
    fichier: '*',
    fragment: 'emptySource',
    motif:
      'Provenance. Le champ nomme la table ou la grandeur attendue — c’est un ' +
      'identifiant technique cité tel quel, pas une phrase adressée au pilote.',
    depuis: '2026-09-01',
  },
];

/**
 * LE CLIQUET — l'état mesuré le 01/09/2026, à faire maigrir.
 *
 * La règle des mots-clés arrive sur des écrans écrits avant elle. La première
 * mesure a rendu quarante et une phrases sur les deux écrans du Mans : une
 * garde rouge dès le premier jour n'arrête pas le travail, elle se fait
 * désarmer.
 *
 * On prend donc le même parti que `modulesOrphelins` : la garde refuse toute
 * phrase NOUVELLE, et invite à baisser le plafond dès qu'il maigrit. Le
 * fondateur a demandé de tout corriger — ce cliquet est ce qui rend la
 * correction vérifiable, pas ce qui la remplace.
 *
 * Un plafond ne remonte JAMAIS. S'il faut l'augmenter, c'est qu'on a ajouté une
 * phrase, et c'est précisément ce que la garde existe pour refuser.
 */
export const PLAFOND_PHRASES: Readonly<Record<string, number>> = {
  // 34 → 33 le 01/09/2026 : « TENDANCE DE LA SÉANCE » est devenue
  // « PENTE · TOURS ». Un plafond ne remonte jamais, et il descend dès
  // qu'une phrase disparaît — c'est ce qui fait de ce cliquet autre chose
  // qu'une liste d'exclusions.
  'app/(app2)/data/session/[id].tsx': 33,
  'app/(app2)/bilan/[sessionId].tsx': 7,
};

/**
 * LE SECOND CLIQUET — les QUATRE RÈGLES D'ÉCRITURE, mesurées le 05/09/2026.
 *
 * ===========================================================================
 * CE QU'IL COMPTE, ET EN QUOI IL DIFFÈRE DU PREMIER
 * ===========================================================================
 *
 * `PLAFOND_PHRASES` compte les PHRASES — plus de trois mots ET un mot outil.
 * Celui-ci compte les étiquettes qui ne sont pas des MOTS-CLÉS : majuscules,
 * forme `SUJET · PRÉCISION`, jamais de verbe conjugué, aucun mot outil jamais.
 * `motifRefusMotCle` implémente ces quatre règles depuis le 01/09 et n'était
 * appliqué à AUCUNE feuille de données — seulement au registre des
 * présentations et aux libellés de service.
 *
 * ===========================================================================
 * POURQUOI UN CLIQUET, ET PAS UN INTERDIT — décision du fondateur du 05/09
 * ===========================================================================
 *
 * Cent soixante étiquettes sur deux cent neuf sont refusées. Un
 * interdit serait rouge le premier jour et désarmé le second. Le cliquet fige
 * le compte : il refuse toute étiquette NOUVELLE hors règle, et invite à
 * baisser le plafond dès qu'il maigrit.
 *
 * Corriger n'est pas un renommage mécanique : la règle de taille dit déjà qu'on
 * ne peut pas seulement grossir, il faut COUPER. Ce cliquet rend la correction
 * vérifiable, il ne la remplace pas.
 *
 * ===========================================================================
 * CE QU'IL NE COMPTE PAS, ET POURQUOI CHAQUE EXCLUSION A SA RAISON
 * ===========================================================================
 *
 * Une mesure naïve — tout littéral d'une feuille — rend 505 refus sur 556, dont
 * l'essentiel est du bruit : fragments SQL, chemins SVG, morceaux de code. Un
 * cliquet posé là-dessus bougerait au moindre `.select()` ajouté.
 *
 * Ne sont donc lues que les POSITIONS D'ÉTIQUETTE — les props de libellé et les
 * nœuds de texte JSX. Sont écartés :
 *
 *   • `accessibility*` — de la prose, lue à voix haute. La soumettre à la règle
 *     dégraderait l'accessibilité au nom de la doctrine ;
 *   • `empty*`, `error*` — les états, déjà tenus par le premier cliquet ;
 *   • tout le reste : une chaîne qui n'est pas en position d'étiquette n'est
 *     pas une étiquette.
 *
 * Un plafond ne remonte JAMAIS.
 */
export const PLAFOND_ETIQUETTES: Readonly<Record<string, number>> = {
  'app/(app2)/data/session/[id].tsx': 68,
  'app/(app2)/data/comparer.tsx': 16,
  'src/features/data/saison/SaisonSections.tsx': 15,
  'app/(admin)/analyse-session/[id].tsx': 12,
  'app/(app2)/bilan/[sessionId].tsx': 11,
  'app/(coach)/rapport.tsx': 9,
  'app/(coach)/comparer.tsx': 7,
  'app/(coach)/priorites.tsx': 7,
  'app/(app2)/data/index.tsx': 5,
  'app/(app2)/signature.tsx': 5,
  'app/(app2)/data/carnet.tsx': 2,
  'app/(app2)/bilan/carte-souvenir.tsx': 2,
  'src/components/telemetry/NiveauxRestitution.tsx': 1,
};

/** Une ligne est-elle couverte par une exception ? */
export function estExcepte(fichierPosix: string, ligne: string): boolean {
  if (ROLES_HORS_REGLE.some((r) => ligne.includes(r.marqueur))) return true;
  const f = fichierPosix.split(String.fromCharCode(92)).join('/').toLowerCase();
  return EXCEPTIONS.some(
    (e) =>
      (e.fichier === '*' || f.endsWith(e.fichier.toLowerCase())) && ligne.includes(e.fragment)
  );
}
