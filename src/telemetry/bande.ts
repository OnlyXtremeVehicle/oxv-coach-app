/**
 * La bande — *functional boxplot* en base distance. Jalon 4, phase 4octies.
 * Logique PURE.
 *
 * ---
 *
 * LE PROBLÈME QU'ELLE RÉSOUT
 *
 * *« Bascule automatique superposition → bande au-delà de 20 à 30 tours. »*
 *
 * Superposer quarante traces de vitesse ne montre plus quarante tours : ça
 * montre un buisson. La bande remplace les traces individuelles par ce qu'elles
 * ont en commun — une ligne centrale et l'étendue autour d'elle.
 *
 * ---
 *
 * MÉDIANE ET QUARTILES, PAS MOYENNE ET ÉCART-TYPE
 *
 * Le dossier est explicite : *« Préférer médiane et MAD à moyenne/écart-type
 * quand n est petit ou en présence de tours aberrants (trafic). »*
 *
 * Une séance de piste EST pleine de tours aberrants — un dépassement, un
 * drapeau, un tour d'observation. Une moyenne les absorbe et déplace toute la
 * courbe ; une médiane les ignore. Sur vingt tours dont deux sont gâchés par du
 * trafic, l'écart entre les deux méthodes se voit à l'œil nu.
 *
 * ---
 *
 * CE QU'ELLE NE FAIT PAS
 *
 * Elle ne compare à personne d'autre. Elle ne trace aucune cible. Le dossier
 * l'écrit pour la mémoire du circuit et cela vaut ici : *« la ligne médiane se
 * trace, jamais superposée à celle du pilote — superposée, elle deviendrait une
 * cible, et l'application aurait prescrit sans un mot. »*
 *
 * Cette bande décrit VOS tours à vous. C'est un miroir de votre régularité, pas
 * un objectif.
 */

import { resampleOnGrid, type DistanceSeries } from './resample';

/** La bande, telle qu'un rendu la consomme. */
export interface Bande {
  /** Grille commune, en mètres. */
  distance: number[];
  /** Valeur centrale à chaque pas. `null` là où trop peu de tours mesurent. */
  mediane: (number | null)[];
  /** Premier quartile — le quart le plus bas des tours. */
  q1: (number | null)[];
  /** Troisième quartile. */
  q3: (number | null)[];
  /** Étendue complète, hors quartiles : ce que les tours extrêmes ont fait. */
  min: (number | null)[];
  max: (number | null)[];
  /** Nombre de tours mesurant à chaque pas — l'appui de la médiane. */
  effectif: number[];
  /** Nombre de tours entrés dans le calcul. */
  nbTours: number;
  /** Pas de la grille, en mètres. */
  pas: number;
}

/**
 * Nombre minimal de tours mesurant un pas pour que sa médiane veuille dire
 * quelque chose.
 *
 * En deçà, le pas rend `null` et la bande s'y interrompt. Une médiane sur deux
 * valeurs est la moyenne de ces deux valeurs : elle n'a plus aucune des
 * propriétés qui justifiaient de la choisir.
 */
export const EFFECTIF_MIN = 3;

/**
 * Seuil de bascule superposition → bande.
 *
 * **Ce n'est pas une mesure.** Le dossier annonce « au-delà de 20 à 30 tours »
 * et le critère d'acceptation du jalon exige le seuil RÉEL, *mesuré* sur
 * appareil. Vingt-quatre est le milieu de la fourchette annoncée, retenu comme
 * convention en attendant cette mesure.
 *
 * Il est exporté pour que la mesure puisse le remplacer sans chercher un nombre
 * enfoui dans un composant.
 */
export const SEUIL_BASCULE_BANDE = 24;

/** Ce qu'un rendu doit afficher pour un nombre de tours donné. */
export type FormeTours = 'superposition' | 'bande';

/**
 * Superposer, ou résumer.
 *
 * Au-delà du seuil, les traces individuelles cessent de se distinguer : les
 * montrer toutes revient à n'en montrer aucune.
 */
export function formeRecommandee(nbTours: number, seuil = SEUIL_BASCULE_BANDE): FormeTours {
  return nbTours > seuil ? 'bande' : 'superposition';
}

/** Médiane d'un échantillon déjà trié. */
function medianeTriee(v: readonly number[]): number {
  const n = v.length;
  const m = n >> 1;
  return n % 2 === 1 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/**
 * Quantile par interpolation linéaire sur un échantillon trié.
 *
 * Méthode dite « linéaire » (celle de R type 7) : sur de petits effectifs, les
 * méthodes par position sautent d'une valeur à l'autre et la bande tressaute
 * d'un pas au suivant sans que la conduite ait changé.
 */
function quantileTrie(v: readonly number[], p: number): number {
  const n = v.length;
  if (n === 1) return v[0];
  const h = (n - 1) * p;
  const bas = Math.floor(h);
  const haut = Math.min(bas + 1, n - 1);
  return v[bas] + (h - bas) * (v[haut] - v[bas]);
}

/**
 * Écart absolu médian — la dispersion robuste que le dossier recommande.
 *
 * Exporté séparément : il sert aussi à décrire la régularité d'une séance, sans
 * qu'on ait besoin de la bande entière.
 */
export function ecartAbsoluMedian(valeurs: readonly number[]): number | null {
  const v = valeurs.filter((x) => Number.isFinite(x));
  if (v.length === 0) return null;
  const trie = [...v].sort((a, b) => a - b);
  const med = medianeTriee(trie);
  const ecarts = trie.map((x) => Math.abs(x - med)).sort((a, b) => a - b);
  return medianeTriee(ecarts);
}

/**
 * La bande, depuis plusieurs tours indexés par distance.
 *
 * Les tours sont ré-échantillonnés sur une grille COMMUNE bornée à leur emprise
 * partagée — la même règle que le delta : toute comparaison en base distance,
 * jamais en base temps, faute de quoi un tour lent et un tour rapide ne
 * s'alignent sur rien.
 *
 * Rend une bande vide si moins de `EFFECTIF_MIN` tours sont fournis : une bande
 * bâtie sur deux tours n'est pas une bande, c'est un intervalle.
 */
export function bandeDepuisTours(tours: readonly DistanceSeries[], pas = 5): Bande {
  const utiles = tours.filter((t) => t.distance.length >= 2 && t.values.length >= 2);
  const vide: Bande = {
    distance: [],
    mediane: [],
    q1: [],
    q3: [],
    min: [],
    max: [],
    effectif: [],
    nbTours: utiles.length,
    pas,
  };
  if (utiles.length < EFFECTIF_MIN) return vide;

  // Emprise PARTAGÉE : au-delà, un pas ne serait mesuré que par les tours les
  // plus longs, et la bande s'y rétrécirait pour une raison qui n'a rien à voir
  // avec la conduite.
  let debut = Number.NEGATIVE_INFINITY;
  let fin = Number.POSITIVE_INFINITY;
  for (const t of utiles) {
    debut = Math.max(debut, t.distance[0]);
    fin = Math.min(fin, t.distance[t.distance.length - 1]);
  }
  if (!Number.isFinite(debut) || !Number.isFinite(fin) || fin <= debut) return vide;

  const grille: number[] = [];
  for (let d = debut; d <= fin + 1e-9; d += pas) grille.push(d);
  if (grille.length < 2) return vide;

  const colonnes = utiles.map((t) => resampleOnGrid(t, grille));

  const mediane: (number | null)[] = [];
  const q1: (number | null)[] = [];
  const q3: (number | null)[] = [];
  const min: (number | null)[] = [];
  const max: (number | null)[] = [];
  const effectif: number[] = [];

  for (let i = 0; i < grille.length; i++) {
    const ech: number[] = [];
    for (const c of colonnes) {
      const v = c[i];
      if (v !== null && Number.isFinite(v)) ech.push(v);
    }
    effectif.push(ech.length);

    if (ech.length < EFFECTIF_MIN) {
      mediane.push(null);
      q1.push(null);
      q3.push(null);
      min.push(null);
      max.push(null);
      continue;
    }

    ech.sort((a, b) => a - b);
    mediane.push(medianeTriee(ech));
    q1.push(quantileTrie(ech, 0.25));
    q3.push(quantileTrie(ech, 0.75));
    min.push(ech[0]);
    max.push(ech[ech.length - 1]);
  }

  return { distance: grille, mediane, q1, q3, min, max, effectif, nbTours: utiles.length, pas };
}

/** Y a-t-il de quoi dessiner ? Une bande sans un seul pas mesuré n'existe pas. */
export function bandeExploitable(b: Bande): boolean {
  return b.distance.length >= 2 && b.mediane.some((v) => v !== null);
}
