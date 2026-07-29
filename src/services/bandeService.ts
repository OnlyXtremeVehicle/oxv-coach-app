/**
 * La bande d'une séance — jalon 4, phase 4octies.
 *
 * ---
 *
 * UNE SEULE LECTURE, PAS UNE PAR TOUR
 *
 * La bande n'a de sens qu'au-delà de vingt à trente tours. Appeler
 * `loadLapFrames` pour chacun ferait trente requêtes — et chacune relit la
 * table `laps` et la table `telemetry_sessions` au passage.
 *
 * Ce service charge la séance ENTIÈRE une fois, puis découpe côté client sur
 * les bornes de chaque tour. Une requête au lieu de trente.
 *
 * ---
 *
 * LES TOURS DE STAND N'ENTRENT PAS
 *
 * Un tour de sortie ne se compare à rien : il commence à l'arrêt, il ne couvre
 * pas le tracé, et sa présence dans la bande élargirait l'étendue sur toute la
 * première portion sans que la conduite ait varié.
 */

import {
  bandeDepuisTours,
  type Bande,
  formeRecommandee,
  type FormeTours,
  SEUIL_BASCULE_BANDE,
} from '@/telemetry/bande';
import { versSerieDistance, type TrameBrute } from '@/telemetry/adaptation';
import type { DistanceSeries } from '@/telemetry/resample';
import type { Lap } from '@/types/telemetry';

import { loadSessionFrames } from './sessionTelemetryService';

export interface BandeSeance {
  bande: Bande;
  /** Ce qu'il convient d'afficher pour ce nombre de tours. */
  forme: FormeTours;
  /** Tours chronométrés retenus — hors sortie et rentrée de stand. */
  toursRetenus: number;
  /** Pourquoi la bande est vide, s'il y a lieu. Descriptif, jamais prescriptif. */
  raison?: 'aucune-trame' | 'trop-peu-de-tours' | 'erreur-chargement';
}

/** Ce que chaque raison dit au pilote. */
export const TEXTE_BANDE: Record<NonNullable<BandeSeance['raison']>, string> = {
  'aucune-trame': 'Aucune trame enregistrée sur cette séance.',
  'trop-peu-de-tours': 'Trois tours chronométrés sont nécessaires pour dessiner une bande.',
  'erreur-chargement': 'Les trames n’ont pas pu être lues.',
};

const VIDE: Bande = {
  distance: [],
  mediane: [],
  q1: [],
  q3: [],
  min: [],
  max: [],
  effectif: [],
  nbTours: 0,
  pas: 5,
};

/**
 * Découpe les trames d'une séance sur les bornes d'un tour.
 *
 * Les bornes sont des horodatages absolus ; les trames portent un temps écoulé
 * depuis le début de la séance. La conversion se fait ici, une fois, comme dans
 * `loadLapFrames`.
 */
function tramesDuTour(
  trames: readonly TrameBrute[],
  debutSeanceMs: number,
  lap: Lap
): TrameBrute[] {
  const debut = new Date(lap.started_at).getTime() - debutSeanceMs;
  const fin = new Date(lap.ended_at).getTime() - debutSeanceMs;
  if (!Number.isFinite(debut) || !Number.isFinite(fin) || fin <= debut) return [];
  return trames.filter((t) => t.elapsedMs >= debut && t.elapsedMs <= fin);
}

/**
 * La bande d'une séance, depuis ses tours chronométrés.
 *
 * **Ne lève jamais.** Une panne devient une bande vide avec sa raison — jamais
 * un écran en erreur, jamais une courbe inventée.
 */
export async function loadBandeSeance(
  sessionId: string,
  debutSeanceIso: string,
  laps: readonly Lap[],
  pas = 5
): Promise<BandeSeance> {
  const chronometres = laps.filter((l) => !l.is_outlap && !l.is_inlap);
  const forme = formeRecommandee(chronometres.length);

  if (chronometres.length < 3) {
    return { bande: VIDE, forme, toursRetenus: chronometres.length, raison: 'trop-peu-de-tours' };
  }

  let trames: TrameBrute[];
  try {
    trames = await loadSessionFrames(sessionId);
  } catch {
    return { bande: VIDE, forme, toursRetenus: chronometres.length, raison: 'erreur-chargement' };
  }

  if (trames.length === 0) {
    return { bande: VIDE, forme, toursRetenus: chronometres.length, raison: 'aucune-trame' };
  }

  const debutSeanceMs = new Date(debutSeanceIso).getTime();
  const series: DistanceSeries[] = [];
  for (const lap of chronometres) {
    const s = versSerieDistance(tramesDuTour(trames, debutSeanceMs, lap));
    if (s.distance.length >= 2) series.push(s);
  }

  const bande = bandeDepuisTours(series, pas);
  return {
    bande,
    forme,
    toursRetenus: chronometres.length,
    raison: bande.distance.length === 0 ? 'trop-peu-de-tours' : undefined,
  };
}

export { SEUIL_BASCULE_BANDE };
