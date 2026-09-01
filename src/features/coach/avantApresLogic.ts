/**
 * AVANT / APRÈS UNE INTERVENTION — l'effet observé, pur (M27, côté coach).
 *
 * Module sans I/O : ni React, ni réseau. Un marqueur d'intervention entre
 * (« j'ai dit quelque chose au pilote à cet instant »), une série de tours avec
 * leur métrique entre, une lecture d'effet sort.
 *
 * ---
 *
 * CE QUE CE MODULE DIT, ET CE QU'IL NE DIT PAS
 *
 * Il dit : « sur les n tours comparables avant le marqueur et les n tours
 * comparables après, la médiane a bougé de tant, avec telle dispersion ». C'est
 * une OBSERVATION, au sens du dossier — jamais une preuve.
 *
 * Il ne dit pas : « l'intervention a causé ce changement ». Le trafic, le
 * carburant, la gomme, la fatigue bougent aussi entre deux fenêtres. C'est
 * pourquoi chaque résultat porte `reserves` — la liste de ce qui empêche de
 * lire la corrélation comme une causalité. Un résultat sans réserve n'existe
 * pas : la réserve de fond y figure toujours.
 *
 * ---
 *
 * MÉDIANE ET ÉCART ABSOLU MÉDIAN, PAS MOYENNE ET ÉCART-TYPE
 *
 * Les fenêtres sont petites (trois tours par défaut) et une séance porte des
 * tours gâchés par le trafic. La règle est déjà posée dans `bande.ts` :
 * médiane et écart absolu médian quand l'effectif est petit ou qu'un tour est
 * aberrant. On réutilise `ecartAbsoluMedian` plutôt que de le réécrire.
 *
 * ---
 *
 * ON NE FABRIQUE PAS DE ZÉRO
 *
 * Un tour sans valeur mesurée n'entre pas dans une fenêtre — il ne devient pas
 * une valeur nulle. Une fenêtre trop courte ne rend pas un effet de zéro : elle
 * rend `statut: 'non testée'` et des champs `null`, et l'écran dit pourquoi.
 */

import { ecartAbsoluMedian } from '@/telemetry/bande';

/** Version de la lecture — à faire évoluer si les seuils ou la méthode changent. */
export const VERSION_AVANT_APRES = 'avant-apres-v1';

/**
 * Taille visée de chaque fenêtre, en tours comparables. — À VALIDER (fondateur) :
 * trois tours suffisent à une médiane robuste sans remonter trop loin dans la
 * séance, mais aucune donnée réelle n'a encore tranché.
 */
export const TAILLE_FENETRE_TOURS = 3;

/**
 * Effectif minimal d'UNE fenêtre pour qu'un effet soit seulement calculable.
 * — À VALIDER : sous deux tours, une médiane n'est qu'une valeur isolée.
 */
export const MIN_TOURS_PAR_FENETRE = 2;

/**
 * Rapport |effet| / dispersion à partir duquel l'effet est dit « probable ».
 * — À VALIDER : un déplacement de la médiane qui dépasse la dispersion
 * observée sort du bruit ordinaire de la séance, sans plus.
 */
export const RATIO_EFFET_PROBABLE = 1;

/**
 * Rapport |effet| / dispersion à partir duquel l'effet est dit « validé ».
 * — À VALIDER : deux fois la dispersion observée, seuil classique mais
 * arbitraire tant qu'aucune séance réelle ne l'a confronté.
 */
export const RATIO_EFFET_VALIDE = 2;

/** Un tour et sa métrique, tels que le fil de séance les connaît. */
export interface TourMetrique {
  /** Numéro de tour, base 1 — même convention que `EvenementFil.tour`. */
  tour: number;
  /** Instant de bouclage du tour (ms epoch), ou `null` si non daté. */
  instantMs: number | null;
  /**
   * Valeur de la métrique observée sur ce tour (temps au tour, vitesse de
   * pointe…). `null` = non mesurée — le tour n'entre alors dans aucune fenêtre.
   */
  valeur: number | null;
  /** Tour jugé exploitable en amont (ni sortie de piste, ni drapeau, ni trafic déclaré). */
  valide: boolean;
}

/**
 * Le marqueur d'intervention, sous les deux formes que le fil coach expose :
 * un numéro de tour (base 1), ou un instant. Le TOUR gagne quand les deux sont
 * présents — c'est la donnée la plus directe, l'instant demande de retrouver le
 * tour par les horodatages.
 */
export interface MarqueurIntervention {
  tour: number | null;
  instantMs: number | null;
}

export type StatutEffet = 'non testée' | 'probable' | 'validée' | 'non concluante';

/** Les deux fenêtres réellement retenues, tours identifiés pour l'écran. */
export interface FenetresAppariees {
  /** Numéros des tours retenus AVANT l'intervention, du plus proche au plus lointain. */
  toursAvant: number[];
  /** Numéros des tours retenus APRÈS l'intervention, du plus proche au plus lointain. */
  toursApres: number[];
}

export interface EffetAvantApres {
  version: string;
  confiance: 'haute' | 'moyenne' | 'faible';
  statut: StatutEffet;
  /**
   * Médiane(après) − médiane(avant), dans l'unité de la métrique.
   * `null` quand l'effet n'est pas calculable — jamais un zéro fabriqué.
   */
  effetMedian: number | null;
  /** Écart absolu médian de la fenêtre avant. `null` si non calculable. */
  dispersionAvant: number | null;
  /** Écart absolu médian de la fenêtre après. `null` si non calculable. */
  dispersionApres: number | null;
  fenetres: FenetresAppariees;
  /**
   * Ce qui empêche de lire cette corrélation comme une causalité. Jamais vide :
   * la réserve de fond y figure toujours.
   */
  reserves: string[];
}

/** Contexte facultatif — ce que l'appelant sait des conditions entre les fenêtres. */
export interface ContexteAvantApres {
  /**
   * `true` si les conditions (météo, piste, pneus) ont changé entre les
   * fenêtres, `false` si elles sont restées stables, `null`/absent si personne
   * ne le sait. L'inconnu produit une réserve, pas un silence.
   */
  conditionsChangees?: boolean | null;
  /** Taille de fenêtre visée, si l'écran veut autre chose que le défaut. */
  tailleFenetre?: number;
}

/** Réserve de fond, présente sur TOUT résultat. */
const RESERVE_CORRELATION =
  'Effet observé sur les tours, pas une preuve : d’autres facteurs bougent entre les fenêtres.';

const RESERVE_CONDITIONS_CHANGEES = 'Conditions changées entre les fenêtres.';
const RESERVE_CONDITIONS_INCONNUES = 'Conditions entre les fenêtres non renseignées.';

/** Médiane d'un tableau non vide de nombres finis. */
function mediane(valeurs: readonly number[]): number {
  const trie = [...valeurs].sort((a, b) => a - b);
  const n = trie.length;
  const m = n >> 1;
  return n % 2 === 1 ? trie[m] : (trie[m - 1] + trie[m]) / 2;
}

/** Un tour peut-il entrer dans une fenêtre ? Valide, ET mesuré. */
function tourComparable(t: TourMetrique): boolean {
  if (t === null || typeof t !== 'object') return false;
  if (typeof t.tour !== 'number' || !Number.isFinite(t.tour) || t.tour < 1) return false;
  if (t.valide !== true) return false;
  return typeof t.valeur === 'number' && Number.isFinite(t.valeur);
}

/**
 * Retrouve le tour de l'intervention. Le tour déclaré gagne ; sinon on cherche
 * par l'instant : l'intervention appartient au premier tour bouclé APRÈS elle.
 * Rend `null` quand rien ne permet de situer le marqueur.
 */
function tourDeLIntervention(
  marqueur: MarqueurIntervention,
  tours: readonly TourMetrique[]
): number | null {
  if (typeof marqueur.tour === 'number' && Number.isFinite(marqueur.tour) && marqueur.tour >= 1) {
    return Math.floor(marqueur.tour);
  }
  const at = marqueur.instantMs;
  if (typeof at !== 'number' || !Number.isFinite(at)) return null;
  let candidat: number | null = null;
  for (const t of tours) {
    if (typeof t.instantMs !== 'number' || !Number.isFinite(t.instantMs)) continue;
    if (t.instantMs >= at && (candidat === null || t.tour < candidat)) {
      candidat = t.tour;
    }
  }
  return candidat;
}

/** Résultat « rien à mesurer », avec le motif dans les réserves. */
function nonTestee(reserves: string[]): EffetAvantApres {
  return {
    version: VERSION_AVANT_APRES,
    confiance: 'faible',
    statut: 'non testée',
    effetMedian: null,
    dispersionAvant: null,
    dispersionApres: null,
    fenetres: { toursAvant: [], toursApres: [] },
    reserves,
  };
}

/**
 * Lit l'effet d'une intervention sur une métrique de tour.
 *
 * Fenêtres APPARIÉES : les `n` tours comparables les plus proches de part et
 * d'autre du tour de l'intervention — qui, lui, n'entre dans aucune fenêtre :
 * il est à cheval sur les deux états. Les tours invalides ou non mesurés sont
 * écartés, jamais convertis en zéro.
 *
 * Le statut compare le déplacement de la médiane à la dispersion observée :
 * un effet plus petit que le bruit de la séance ne conclut rien.
 */
export function litEffetAvantApres(
  marqueur: MarqueurIntervention,
  tours: readonly TourMetrique[],
  contexte: ContexteAvantApres = {}
): EffetAvantApres {
  const reservesContexte: string[] = [RESERVE_CORRELATION];
  if (contexte.conditionsChangees === true) reservesContexte.push(RESERVE_CONDITIONS_CHANGEES);
  else if (contexte.conditionsChangees !== false)
    reservesContexte.push(RESERVE_CONDITIONS_INCONNUES);

  if (!Array.isArray(tours) || tours.length === 0) {
    return nonTestee([...reservesContexte, 'Aucun tour fourni.']);
  }
  if (marqueur === null || typeof marqueur !== 'object') {
    return nonTestee([...reservesContexte, 'Marqueur d’intervention non situable.']);
  }

  const tourPivot = tourDeLIntervention(marqueur, tours);
  if (tourPivot === null) {
    return nonTestee([...reservesContexte, 'Marqueur d’intervention non situable.']);
  }

  const taille =
    typeof contexte.tailleFenetre === 'number' &&
    Number.isFinite(contexte.tailleFenetre) &&
    contexte.tailleFenetre >= MIN_TOURS_PAR_FENETRE
      ? Math.floor(contexte.tailleFenetre)
      : TAILLE_FENETRE_TOURS;

  const comparables = tours.filter(tourComparable);
  // Du plus proche du pivot au plus lointain, de chaque côté. Le tour pivot
  // lui-même est exclu : l'intervention le coupe en deux.
  const avant = comparables
    .filter((t) => t.tour < tourPivot)
    .sort((a, b) => b.tour - a.tour)
    .slice(0, taille);
  const apres = comparables
    .filter((t) => t.tour > tourPivot)
    .sort((a, b) => a.tour - b.tour)
    .slice(0, taille);

  const fenetres: FenetresAppariees = {
    toursAvant: avant.map((t) => t.tour),
    toursApres: apres.map((t) => t.tour),
  };

  if (avant.length < MIN_TOURS_PAR_FENETRE || apres.length < MIN_TOURS_PAR_FENETRE) {
    return {
      ...nonTestee([
        ...reservesContexte,
        'Pas assez de tours comparables de part et d’autre de l’intervention.',
      ]),
      fenetres,
    };
  }

  const valeursAvant = avant.map((t) => t.valeur as number);
  const valeursApres = apres.map((t) => t.valeur as number);

  const effetMedian = mediane(valeursApres) - mediane(valeursAvant);
  const dispersionAvant = ecartAbsoluMedian(valeursAvant);
  const dispersionApres = ecartAbsoluMedian(valeursApres);

  const reserves = [...reservesContexte];
  const fenetresPleines = avant.length >= taille && apres.length >= taille;
  if (!fenetresPleines) {
    reserves.push('Fenêtres plus courtes que visé : lecture moins assise.');
  }

  // La dispersion de référence : la plus GRANDE des deux fenêtres. Prendre la
  // plus petite gonflerait le ratio et ferait « valider » un effet que la
  // fenêtre la plus bruitée ne distingue pas de son propre bruit.
  const dispersions = [dispersionAvant, dispersionApres].filter(
    (d): d is number => typeof d === 'number' && Number.isFinite(d)
  );
  const dispersionRef = dispersions.length > 0 ? Math.max(...dispersions) : null;

  let statut: StatutEffet;
  if (dispersionRef === null) {
    statut = 'non concluante';
    reserves.push('Dispersion non calculable : l’ampleur de l’effet ne se juge pas.');
  } else if (dispersionRef === 0) {
    // Tours strictement identiques dans chaque fenêtre : tout déplacement est
    // net, mais l'échelle du bruit est inconnue — on ne « valide » pas.
    statut = effetMedian !== 0 ? 'probable' : 'non concluante';
    reserves.push('Dispersion nulle dans les fenêtres : échelle du bruit inconnue.');
  } else {
    const ratio = Math.abs(effetMedian) / dispersionRef;
    if (ratio >= RATIO_EFFET_VALIDE) statut = 'validée';
    else if (ratio >= RATIO_EFFET_PROBABLE) statut = 'probable';
    else statut = 'non concluante';
  }

  const confiance: EffetAvantApres['confiance'] =
    fenetresPleines && dispersionRef !== null && contexte.conditionsChangees === false
      ? 'haute'
      : fenetresPleines && dispersionRef !== null
        ? 'moyenne'
        : 'faible';

  return {
    version: VERSION_AVANT_APRES,
    confiance,
    statut,
    effetMedian,
    dispersionAvant,
    dispersionApres,
    fenetres,
    reserves,
  };
}

/** Ce que l'écran dit du statut. Descriptif, jamais une consigne. */
export function libelleStatut(statut: StatutEffet): string {
  switch (statut) {
    case 'non testée':
      return 'Pas encore de tours de part et d’autre pour observer un effet.';
    case 'probable':
      return 'Un déplacement se dessine dans les tours observés.';
    case 'validée':
      return 'Le déplacement observé dépasse nettement le bruit des tours.';
    case 'non concluante':
      return 'Rien ne se distingue du bruit ordinaire de la séance.';
  }
}
