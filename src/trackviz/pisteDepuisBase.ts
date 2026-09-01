/**
 * LA PISTE, CONSTRUITE DEPUIS LA BASE — logique PURE.
 *
 * ===========================================================================
 * LA PIÈCE QUI MANQUAIT ENTRE LE CIRCUIT ET L'ANALYSE
 * ===========================================================================
 *
 * `trackviz` sait tout faire sur une piste : recaler des points GPS sur un
 * tracé, les répartir en segments, en tirer des vitesses d'entrée, d'apex et de
 * sortie, des G, une erreur latérale. Rien de tout cela n'est propre à un
 * circuit.
 *
 * Mais la piste, elle, était écrite en dur : `HAUTE_SAINTONGE_TRACK` et
 * `HAUTE_SAINTONGE_SEGMENTS`, deux constantes de sept virages. Une séance
 * roulée ailleurs y écrivait sept segments d'un autre circuit, avec des écarts
 * latéraux kilométriques — des marges fabriquées, persistées, affichées comme
 * des mesures. La garde posée le 30/08 a arrêté cela en REFUSANT d'analyser
 * hors de Haute Saintonge, ce qui était juste et laissait le trou entier :
 * plus aucune séance réelle n'avait de segments.
 *
 * Ce module comble le trou. Il ne calcule rien de neuf ; il traduit ce que la
 * base porte déjà — la polyligne du circuit et ses virages détectés — dans la
 * forme que `trackviz` attend depuis le début.
 *
 * ===========================================================================
 * LES BORNES SONT À MI-CHEMIN ENTRE DEUX CORDES, ET NE FRANCHISSENT PAS LA LIGNE
 * ===========================================================================
 *
 * Un virage commence à mi-chemin de la corde précédente et finit à mi-chemin de
 * la suivante. C'est la règle qu'employait déjà `hauteSaintonge`, et elle a
 * l'avantage de ne rien inventer : elle ne demande ni angle d'entrée, ni
 * longueur de freinage, deux choses que `circuits.corners` ne porte pas.
 *
 * Le premier segment commence à 0 et le dernier finit à 1 — on ne fait PAS le
 * tour par la ligne d'arrivée. C'est le même choix qu'en V1, et il est
 * délibéré : un segment qui enjambe la ligne a un `progressStart` supérieur à
 * son `progressEnd`, et tout ce qui lit ces deux nombres — `segmentForProgress`,
 * le ruban, la fenêtre de virage — devrait alors traiter un cas modulaire. Le
 * gain serait quelques mètres de bitume ; le coût, une classe de bugs.
 *
 * ===========================================================================
 * AUCUN NOM N'EST INVENTÉ, AUCUN CONSEIL N'EST ÉCRIT
 * ===========================================================================
 *
 * `name` vient de la base ou vaut « Virage N » — le détecteur ne nomme pas, et
 * nommer est un acte éditorial. `coachingFocus` reste VIDE : le champ existait
 * pour porter une note de formulation, et la doctrine ne laisse aucun conseil
 * naître d'un calcul.
 */

import { nomVirage, type VirageCircuit } from '@/features/data/viragesCircuit';

import type { TrackVizSegmentDefinition } from './types';

/** Un point du tracé, tel que `circuits.centerline_latlon` le porte. */
export interface PointTrace {
  lat: number;
  lon: number;
}

/** Ce que `trackviz` a besoin de savoir d'un circuit. */
export interface PisteAnalysable {
  /** La polyligne du circuit, dans l'ordre de la marche. */
  trace: readonly PointTrace[];
  /** Les segments, un par virage détecté, dans l'ordre du tour. */
  segments: readonly TrackVizSegmentDefinition[];
}

/**
 * Points minimaux d'un tracé exploitable.
 *
 * `buildTrackGeometry` cumule des distances : deux points suffisent en théorie,
 * et ne décrivent aucun circuit en pratique. Quatre est le plancher que
 * `parseCenterline` applique déjà en lecture — on ne l'assouplit pas ici.
 */
export const POINTS_TRACE_MIN = 4;

/**
 * La piste analysable d'un circuit, ou `null`.
 *
 * `null` dès qu'il manque de quoi être honnête : un tracé trop court, ou aucun
 * virage situé. L'appelant n'analyse alors rien, et le dit — c'est la même
 * discipline que la garde qu'il remplace.
 */
export function pisteDepuisBase(
  trace: readonly PointTrace[] | null | undefined,
  virages: readonly VirageCircuit[]
): PisteAnalysable | null {
  if (!Array.isArray(trace) || trace.length < POINTS_TRACE_MIN) return null;

  const cordes = virages
    .filter(
      (v): v is VirageCircuit & { positionNormalisee: number } =>
        typeof v.positionNormalisee === 'number' &&
        Number.isFinite(v.positionNormalisee) &&
        v.positionNormalisee >= 0 &&
        v.positionNormalisee <= 1
    )
    .sort((a, b) => a.positionNormalisee - b.positionNormalisee);

  if (cordes.length === 0) return null;

  const segments: TrackVizSegmentDefinition[] = cordes.map((corde, i) => {
    const precedente = i === 0 ? null : cordes[i - 1].positionNormalisee;
    const suivante = i === cordes.length - 1 ? null : cordes[i + 1].positionNormalisee;

    const debut = precedente === null ? 0 : (precedente + corde.positionNormalisee) / 2;
    const fin = suivante === null ? 1 : (corde.positionNormalisee + suivante) / 2;

    return {
      id: `virage-${corde.index}`,
      order: corde.index,
      name: nomVirage(virages, corde.index),
      kind: 'turn',
      progressStart: arrondi(debut),
      progressEnd: arrondi(fin),
      apexProgress: arrondi(corde.positionNormalisee),
      // Vide, et il le reste : aucun conseil ne naît d'un calcul.
      coachingFocus: '',
    };
  });

  return { trace, segments };
}

/** Quatre décimales : le pas d'un tracé de cinq kilomètres vaut 50 cm. */
function arrondi(v: number): number {
  return Number(v.toFixed(4));
}
