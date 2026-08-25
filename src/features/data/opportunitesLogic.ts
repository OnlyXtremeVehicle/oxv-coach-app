/**
 * Écarts locaux par segment — module M07. Logique PURE.
 * Sans React, sans react-native, sans Supabase : testable seule (ts-jest, node).
 *
 * ---
 *
 * CE QUE CE MODULE FAIT
 *
 * Le delta cumulé (T1bis, `src/telemetry/delta.ts`) dit OÙ le temps se fait le
 * long du tour. Ce module le découpe en segments de piste et rend, pour chacun,
 * l'écart local SIGNÉ :
 *
 *     écart local = Δt(sortie du segment) − Δt(entrée du segment)
 *
 * Positif = le tour courant a rendu du temps sur ce segment ; négatif = il en a
 * pris. Les segments sont rendus triés du plus grand écart rendu au plus grand
 * écart pris : c'est l'ordre du potentiel, pas un classement de qualité.
 *
 * AUCUNE CAUSE N'EST ATTRIBUÉE. Un segment où le temps se rend est un endroit
 * à regarder, pas une erreur nommée : le module donne le où et le combien,
 * jamais le pourquoi.
 *
 * ---
 *
 * LA RÉCONCILIATION, QUI EST LE CONTRAT DU MODULE
 *
 * La somme des écarts locaux DOIT retomber sur le delta total du tour : les
 * segments se partagent le tour, ils ne le réinventent pas. La construction
 * est télescopique — chaque sortie de segment est l'entrée du suivant — donc
 * l'égalité est structurelle ; il ne reste que l'arrondi flottant de la somme,
 * borné par `TOLERANCE_RECONCILIATION_S`. Le résultat porte l'écart mesuré et
 * le verdict `reconcilie` ; un test le verrouille.
 *
 * ---
 *
 * LES TROUS NE FABRIQUENT RIEN
 *
 * Le delta amont écarte les pas sans vitesse exploitable et reporte la
 * dernière valeur cumulée connue. Ce module lit donc, à chaque frontière, la
 * dernière valeur CONNUE à cette distance — jamais une interpolation à travers
 * un trou. Le premier point de la grille vaut zéro par construction.
 */

import type { DeltaResult } from '@/telemetry/delta';
import type { Confiance } from '@/features/data/progressionLogic';

/** Estampille du calcul : toute évolution de méthode est un changement tracé. */
export const OPPORTUNITES_ALGO_VERSION = 'opportunites-1.0.0';

/** Longueur de segment par défaut, en mètres. Compromis lisibilité / bruit. */
export const LONGUEUR_SEGMENT_M_DEFAUT = 100;

/**
 * Tolérance de réconciliation, en secondes.
 *
 * La somme télescopique est structurellement égale au delta total ; seul
 * l'arrondi flottant de l'addition subsiste. Une milliseconde le couvre très
 * largement — au-delà, c'est un défaut de construction, pas un arrondi.
 */
export const TOLERANCE_RECONCILIATION_S = 0.001;

/** Un segment de piste et son écart local signé. */
export interface SegmentEcart {
  /** Entrée du segment, en mètres depuis le départ du tour. */
  debutM: number;
  /** Sortie du segment, en mètres. */
  finM: number;
  /** Delta cumulé connu à l'entrée, en secondes. */
  deltaEntreeS: number;
  /** Delta cumulé connu à la sortie, en secondes. */
  deltaSortieS: number;
  /**
   * Écart local signé, en secondes : Δt(sortie) − Δt(entrée).
   * Positif = temps rendu par le tour courant sur ce segment.
   */
  ecartLocalS: number;
}

export interface OpportunitesTour {
  version: string;
  /** Confiance de lecture, dérivée de la part de pas écartés par le delta amont. */
  confiance: Confiance;
  /**
   * Segments triés par écart local décroissant : le plus grand temps rendu
   * d'abord — l'ordre du potentiel, sans cause attribuée.
   */
  segments: SegmentEcart[];
  /** Delta total du tour, en secondes. `null` si le delta amont n'a rien pu dire. */
  totalS: number | null;
  /** Somme des écarts locaux, en secondes. */
  sommeSegmentsS: number;
  /** |somme − total|, en secondes. `null` quand le total est absent. */
  ecartReconciliationS: number | null;
  /** Vrai quand la somme retombe sur le total dans la tolérance. */
  reconcilie: boolean;
  /** Pas écartés par le delta amont, repris tels quels. */
  pasEcartes: number;
}

export interface OptionsDecoupe {
  /** Longueur de segment régulière, en mètres. */
  longueurSegmentM?: number;
  /**
   * Frontières explicites, en mètres (entrées de virages, par exemple).
   * Quand elles sont fournies, elles remplacent la découpe régulière ; elles
   * sont rabattues sur la grille du delta, bornées et dédoublonnées.
   */
  bornesM?: readonly number[];
}

/**
 * Dernière valeur cumulée CONNUE à l'index donné, en remontant la grille.
 * L'index 0 vaut zéro par construction du delta amont : la remontée aboutit
 * toujours.
 */
function cumulConnuA(cumulative: readonly (number | null)[], index: number): number {
  for (let i = index; i >= 0; i--) {
    const v = cumulative[i];
    if (v !== null) return v;
  }
  return 0;
}

/** Confiance de lecture : elle ne parle que des données, jamais du pilote. */
function confianceLecture(pasEcartes: number, pasTotal: number): Confiance {
  if (pasTotal <= 0) return 'faible';
  const part = pasEcartes / pasTotal;
  if (part < 0.05) return 'haute';
  if (part < 0.2) return 'moyenne';
  return 'faible';
}

/** Indices de frontière sur la grille : réguliers, ou rabattus des bornes fournies. */
function indicesFrontieres(
  grille: readonly number[],
  step: number,
  options?: OptionsDecoupe
): number[] {
  const dernier = grille.length - 1;

  if (options?.bornesM && options.bornesM.length > 0) {
    const indices = new Set<number>([0, dernier]);
    for (const borne of options.bornesM) {
      if (!Number.isFinite(borne)) continue;
      const idx = Math.round(borne / step);
      if (idx > 0 && idx < dernier) indices.add(idx);
    }
    return [...indices].sort((a, b) => a - b);
  }

  const longueur = options?.longueurSegmentM ?? LONGUEUR_SEGMENT_M_DEFAUT;
  const pasParSegment = Math.max(1, Math.round(longueur / step));
  const indices: number[] = [];
  for (let i = 0; i < dernier; i += pasParSegment) indices.push(i);
  indices.push(dernier); // Le dernier segment peut être plus court : il existe.
  return indices;
}

/**
 * Découpe un delta de tour en segments et rend leurs écarts locaux signés,
 * triés par écart décroissant.
 *
 * `null` quand la grille porte moins de deux points : il n'y a pas de segment
 * à découper, et un résultat vide se ferait passer pour une lecture.
 */
export function calculeOpportunites(
  delta: DeltaResult,
  options?: OptionsDecoupe
): OpportunitesTour | null {
  const { distance: grille, cumulative, step } = delta;
  if (grille.length < 2 || step <= 0) return null;

  const frontieres = indicesFrontieres(grille, step, options);

  const segments: SegmentEcart[] = [];
  let somme = 0;
  for (let k = 0; k + 1 < frontieres.length; k++) {
    const iDebut = frontieres[k];
    const iFin = frontieres[k + 1];
    const deltaEntreeS = cumulConnuA(cumulative, iDebut);
    const deltaSortieS = cumulConnuA(cumulative, iFin);
    const ecartLocalS = deltaSortieS - deltaEntreeS;
    somme += ecartLocalS;
    segments.push({
      debutM: grille[iDebut],
      finM: grille[iFin],
      deltaEntreeS,
      deltaSortieS,
      ecartLocalS,
    });
  }

  // Tri par écart local décroissant ; à égalité, l'ordre de la piste.
  segments.sort((a, b) => b.ecartLocalS - a.ecartLocalS || a.debutM - b.debutM);

  const totalS = delta.total;
  const ecartReconciliationS = totalS !== null ? Math.abs(somme - totalS) : null;

  return {
    version: OPPORTUNITES_ALGO_VERSION,
    confiance: confianceLecture(delta.skipped, grille.length - 1),
    segments,
    totalS,
    sommeSegmentsS: somme,
    ecartReconciliationS,
    reconcilie: ecartReconciliationS !== null && ecartReconciliationS <= TOLERANCE_RECONCILIATION_S,
    pasEcartes: delta.skipped,
  };
}
