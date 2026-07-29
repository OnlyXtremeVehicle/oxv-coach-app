/**
 * Chargement d'un delta entre deux tours — jalon 4, phase 4septies.
 *
 * ---
 *
 * CE QUE CE SERVICE DÉBLOQUE
 *
 * `computeDelta` a été écrit au lot T1bis, avec le test qui prouve qu'il se
 * referme à zéro sur un tour comparé à lui-même — le critère d'acceptation
 * numéro un du jalon 4. **Il n'était appelé nulle part.** Comme les six autres
 * modules de la banque de calculs.
 *
 * Ce service est le premier appelant. Il ne calcule rien lui-même : il charge,
 * convertit par `adaptation`, et délègue.
 *
 * ---
 *
 * IL NE FABRIQUE RIEN
 *
 * *Correction du 29/07 : j'avais écrit ici que `telemetry_frames` était vide en
 * production. C'est faux — la table porte 53 trames.* Ce qui est vrai est plus
 * précis, et pire : **aucune séance ne porte à la fois des trames et un tour.**
 * Les 53 trames sont sur une séance sans tour ; l'unique ligne `laps` est sur
 * une séance sans trame.
 *
 * `loadLapFrames` rendra donc bien un tableau vide sur toute séance — mais pour
 * cette raison-là, et pas parce que rien n'aurait jamais été capturé. La
 * distinction compte le jour où l'on jugera un écran éteint.
 *
 * Ce service rendra `null` avec sa raison, et l'écran dira l'absence — comme
 * les six lectures d'insight du lot 13. C'est voulu : un delta inventé sur des
 * tours fabriqués serait indiscernable d'un delta réel, et le premier vrai tour
 * ne se verrait pas arriver.
 */

import { tousDeuxComparables, versSerieDistance, type TrameBrute } from '@/telemetry/adaptation';
import { computeDelta, type DeltaResult } from '@/telemetry/delta';

import { loadLapFrames, PLAFOND_TRAMES_TOUR } from './sessionTelemetryService';

/** Pourquoi un delta n'a pas pu être établi. Descriptif, jamais prescriptif. */
export type RaisonAbsence =
  | 'aucune-trame'
  | 'tour-trop-court'
  | 'tours-non-comparables'
  | 'erreur-chargement';

export interface DeltaEntreTours {
  /** Le résultat, ou `null` si rien n'a pu être établi. */
  delta: DeltaResult | null;
  raison?: RaisonAbsence;
  /** Numéros des deux tours, tels que demandés. */
  tours: { courant: number; reference: number };
  /**
   * L'un des deux tours est-il arrivé AMPUTÉ ?
   *
   * `loadLapFrames` plafonne à `PLAFOND_TRAMES_TOUR` trames, soit quatre-vingts
   * secondes à vingt-cinq hertz — moins qu'un tour sur beaucoup de circuits.
   *
   * Le piège est qu'un delta sur deux tours tronqués **se referme proprement**
   * et paraît juste : il décrit simplement un début de tour en se faisant
   * passer pour le tour entier. Rien dans la courbe ne le trahit, d'où ce
   * drapeau, que l'écran doit rendre visible.
   */
  tronque: boolean;
}

/** Ce que chaque raison dit au pilote. Un constat, jamais une consigne. */
export const TEXTE_ABSENCE: Record<RaisonAbsence, string> = {
  'aucune-trame': 'Aucune trame enregistrée sur ces tours.',
  'tour-trop-court': 'Un des deux tours est trop court pour être comparé.',
  'tours-non-comparables': 'Les deux tours ne couvrent pas la même distance.',
  'erreur-chargement': 'Les trames n’ont pas pu être lues.',
};

/**
 * Delta entre deux tours d'une même séance.
 *
 * Fail-closed : toute absence rend `delta: null` avec sa raison. Aucun repli
 * sur une valeur par défaut — un zéro voudrait dire « les deux tours sont
 * identiques », ce qui est un fait, et pas celui qu'on connaît.
 */
export async function loadDeltaEntreTours(
  sessionId: string,
  tourCourant: number,
  tourReference: number,
  pasM = 5
): Promise<DeltaEntreTours> {
  const tours = { courant: tourCourant, reference: tourReference };

  let brutCourant: TrameBrute[];
  let brutReference: TrameBrute[];
  try {
    [brutCourant, brutReference] = await Promise.all([
      loadLapFrames(sessionId, tourCourant),
      loadLapFrames(sessionId, tourReference),
    ]);
  } catch {
    return { delta: null, raison: 'erreur-chargement', tours, tronque: false };
  }

  // Le seul indice de troncature disponible : la requête a rendu exactement son
  // plafond. Un tour qui compte pile ce nombre de trames est possible, mais
  // improbable ; on préfère un avertissement de trop à un delta muet et faux.
  const tronque =
    brutCourant.length >= PLAFOND_TRAMES_TOUR || brutReference.length >= PLAFOND_TRAMES_TOUR;

  if (brutCourant.length === 0 || brutReference.length === 0) {
    return { delta: null, raison: 'aucune-trame', tours, tronque };
  }

  const serieCourant = versSerieDistance(brutCourant);
  const serieReference = versSerieDistance(brutReference);
  if (serieCourant.distance.length < 2 || serieReference.distance.length < 2) {
    return { delta: null, raison: 'tour-trop-court', tours, tronque };
  }

  // Comparer un tour complet à un demi-tour tronqué produirait un delta qui
  // diverge sans jamais se refermer — un écart lisible, et faux.
  if (!tousDeuxComparables(brutCourant, brutReference)) {
    return { delta: null, raison: 'tours-non-comparables', tours, tronque };
  }

  return { delta: computeDelta(serieCourant, serieReference, pasM), tours, tronque };
}
