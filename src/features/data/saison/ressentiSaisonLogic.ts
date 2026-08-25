/**
 * LE RESSENTI SUR LA SAISON — ce que le pilote a nommé, compté.
 *
 * ===========================================================================
 * LA MATIÈRE ÉTAIT SAISIE, PERSISTÉE, RELUE — ET JETÉE
 * ===========================================================================
 *
 * Après chaque run, le pilote choisit un THÈME (le freinage, le placement, le
 * rythme, la voiture) et un ressenti. Les deux partent dans `pilot_notes`, en
 * colonnes dédiées, contraintes côté Postgres.
 *
 * `pilotNotesService` les relit. Et les trois consommateurs des notes ignorent
 * tous le champ `theme` : il n'apparaît dans aucun comptage.
 *
 * Détail qui signe le motif de ce dépôt : la migration a créé l'index
 * `pilot_notes_theme_idx on (user_id, theme)` — **l'index exact qu'exigerait la
 * requête d'agrégat** — et aucune requête ne l'emprunte.
 *
 * ===========================================================================
 * LE SEUIL N'EST PAS UN ORNEMENT
 * ===========================================================================
 *
 * Deux notes ne font pas une tendance. Sous le seuil, on ne dit RIEN et on dit
 * pourquoi — jamais un pourcentage sur trois réponses, qui donnerait à un
 * hasard l'allure d'un constat.
 *
 * ===========================================================================
 * ET SURTOUT : ON COMPTE, ON N'INTERPRÈTE PAS
 * ===========================================================================
 *
 * La phrase rendue dit *ce que le pilote a nommé le plus souvent*. Elle ne dit
 * pas que c'est sa faiblesse, ni ce qu'il faudrait en faire. Un thème revenu
 * souvent est un thème qui l'occupe — le sens lui appartient.
 */

/** Les quatre thèmes du QCM d'après-run. Miroir de `qcmLogic.THEMES`. */
export const THEMES_LIBELLES: Readonly<Record<string, string>> = {
  freinage: 'le freinage',
  placement: 'le placement',
  rythme: 'le rythme',
  voiture: 'la voiture',
};

/**
 * En deçà, aucune phrase.
 *
 * Huit réponses, c'est-à-dire environ deux journées de piste : assez pour
 * qu'un thème dominant ne soit pas le fruit d'une seule sortie difficile.
 * Le nombre est discutable ; ce qui ne l'est pas, c'est qu'il en faille un.
 */
export const MINIMUM_REPONSES = 8;

export interface ComptageTheme {
  cle: string;
  libelle: string;
  n: number;
}

export interface RessentiSaison {
  /** Total de réponses exploitables. */
  total: number;
  /** Comptage décroissant, sans rang affiché. */
  comptes: ComptageTheme[];
  /** La phrase à rendre, ou `null` si le seuil n'est pas atteint. */
  phrase: string | null;
  /** Pourquoi il n'y a pas de phrase. `null` quand il y en a une. */
  raison: string | null;
}

/**
 * Compte les thèmes nommés et rend une phrase factuelle.
 *
 * `themes` est la liste brute des valeurs de `pilot_notes.theme` sur la
 * saison — `null` compris, car une note libre n'a pas de thème et ne doit pas
 * gonfler le dénominateur.
 */
export function ressentiSaison(themes: readonly (string | null)[]): RessentiSaison {
  const compte = new Map<string, number>();
  for (const t of themes) {
    if (t === null || !(t in THEMES_LIBELLES)) continue;
    compte.set(t, (compte.get(t) ?? 0) + 1);
  }

  const total = [...compte.values()].reduce((a, b) => a + b, 0);
  const comptes: ComptageTheme[] = [...compte.entries()]
    .map(([cle, n]) => ({ cle, libelle: THEMES_LIBELLES[cle], n }))
    // À égalité, l'ordre des thèmes du QCM départage — sans quoi deux lectures
    // successives réordonneraient la liste sous les yeux du pilote.
    .sort((a, b) => b.n - a.n || a.cle.localeCompare(b.cle, 'fr'));

  if (total < MINIMUM_REPONSES) {
    return {
      total,
      comptes,
      phrase: null,
      raison: `Cette lecture demande au moins ${MINIMUM_REPONSES} retours d'après-run. Vous en avez ${total}.`,
    };
  }

  const premier = comptes[0];
  const exaequo = comptes.filter((c) => c.n === premier.n);

  /**
   * L'ÉGALITÉ EST DITE, PAS TRANCHÉE.
   *
   * Désigner un « premier » entre deux thèmes à égalité serait fabriquer une
   * dominance que le comptage ne montre pas.
   */
  if (exaequo.length > 1) {
    const noms = exaequo.map((c) => c.libelle);
    const liste = `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`;
    return {
      total,
      comptes,
      phrase: `Sur ${total} retours, ${liste} reviennent autant l'un que l'autre.`,
      raison: null,
    };
  }

  return {
    total,
    comptes,
    phrase: `Sur ${total} retours après vos runs, c'est ${premier.libelle} que vous avez nommé le plus souvent — ${premier.n} fois.`,
    raison: null,
  };
}
