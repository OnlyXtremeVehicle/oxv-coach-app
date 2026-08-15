/**
 * Zone cardio d'une pastille roster coach (lot BIO) — module PUR, sans I/O.
 *
 * POURQUOI RELATIF AU PILOTE, ET JAMAIS ABSOLU : une zone absolue (pourcentage de
 * FC max, « zone 4 = seuil ») serait une INTERPRÉTATION médicale. Elle exigerait
 * l'âge, s'appuierait sur une norme physiologique de population, et poserait donc
 * un jugement sur l'état du pilote — or le coach JUGE, l'app NE DIAGNOSTIQUE PAS.
 * On situe la FC courante dans la plage RÉELLEMENT OBSERVÉE chez CE pilote pendant
 * CETTE séance : « vous contre vous », doctrine OXV. Aucune norme externe n'entre
 * dans ce fichier, et aucun classement entre pilotes n'est possible par construction
 * (chaque plage est propre à son porteur).
 *
 * POURQUOI NULL EST UNE SORTIE LÉGITIME : tant que la plage observée est trop
 * étroite, aucun placement n'est honnête. La règle du repo est « absence égale
 * rien » — on renvoie null, jamais un 'median' de repli qui ferait passer une
 * invention pour une mesure.
 *
 * Ce module ne connaît ni React, ni Supabase, ni le canal live : il transforme des
 * nombres en zone, en couleur et en libellé. La FC elle-même continue de ne vivre
 * que dans `BiometryLiveEvent` sur le canal privé coach (cf. liveHealthGate) ;
 * rien ici ne l'écrit nulle part, et RosterMeta ne porte toujours aucune mesure.
 */

import { palette, speedHeat } from '@/theme/v2';

/** Position FACTUELLE dans la plage observée du pilote — vocabulaire fermé. */
export type CardioZone = 'bas' | 'median' | 'haut';

/** Plage de FC réellement observée chez un pilote pendant une séance (bpm). */
export interface ObservedRange {
  minBpm: number;
  maxBpm: number;
}

/**
 * Amplitude minimale (bpm) en dessous de laquelle on refuse de situer la FC.
 *
 * Sur une plage de 3 bpm, un tercile fait 1 bpm : le bruit du capteur suffirait à
 * faire basculer la pastille d'une couleur à l'autre. Colorer dans ces conditions
 * afficherait une précision qui n'existe pas. Le seuil est exporté pour que
 * l'appelant puisse expliquer l'absence de couleur plutôt que la subir.
 */
export const MIN_SPREAD_BPM = 10;

/**
 * Situe `hrBpm` dans la plage observée du pilote, en TERCILES de cette plage.
 *
 * Renvoie `null` — donc AUCUNE couleur de zone — dès que le placement ne serait
 * pas défendable : entrée non finie, plage incohérente (max < min), ou amplitude
 * inférieure à `MIN_SPREAD_BPM`. Jamais de repli sur 'median'.
 *
 * Bornes : sous le minimum observé la zone reste 'bas', au-dessus du maximum elle
 * reste 'haut' — la sortie ne quitte jamais l'ensemble fermé des trois zones, même
 * si l'appelant transmet une FC hors plage (la plage se met à jour au tick suivant
 * via `updateObservedRange`, l'affichage ne doit pas clignoter entre-temps).
 * Bornes internes fermées à gauche : [min, t1) = bas, [t1, t2) = médian,
 * [t2, max] = haut.
 */
export function cardioZone(hrBpm: number, observed: ObservedRange): CardioZone | null {
  // Garde d'entrée : la FC vient d'un capteur BLE relayé, donc d'une frontière non
  // typée à l'exécution. Tout doute vaut null (fail-closed, comme liveHealthGate).
  if (typeof hrBpm !== 'number' || !Number.isFinite(hrBpm)) return null;
  if (observed === null || typeof observed !== 'object') return null;

  const { minBpm, maxBpm } = observed;
  if (typeof minBpm !== 'number' || !Number.isFinite(minBpm)) return null;
  if (typeof maxBpm !== 'number' || !Number.isFinite(maxBpm)) return null;
  if (maxBpm < minBpm) return null;

  const spread = maxBpm - minBpm;
  if (spread < MIN_SPREAD_BPM) return null;

  if (hrBpm <= minBpm) return 'bas';
  if (hrBpm >= maxBpm) return 'haut';

  const premierTercile = minBpm + spread / 3;
  const secondTercile = minBpm + (2 * spread) / 3;
  if (hrBpm < premierTercile) return 'bas';
  if (hrBpm < secondTercile) return 'median';
  return 'haut';
}

/**
 * Couleur de la pastille cardio — rampe d'INTENSITÉ froid → chaud.
 *
 * POURQUOI NI OR NI ROUGE. Une échelle vert → rouge se lit universellement
 * « bon → mauvais » : appliquée à la physiologie d'un pilote, c'est un VERDICT sur
 * son état, donc un diagnostic — interdit. Une rampe froid → chaud se lit
 * « bas → haut » : c'est une MAGNITUDE, un constat. L'app mesure, elle ne juge pas.
 * L'or `#FFB703` est par ailleurs réservé au CHRONO / RECORD / RYTHME, et les deux
 * rouges sont exclus : `#C8102E` est le rouge de MARQUE (jamais une donnée de
 * perf), `#F65B5B` est le rouge de DONNÉE du freinage (une couleur = une donnée) —
 * et il porterait de surcroît la lecture « alarme » que ce module refuse.
 *
 * Les teintes sont prises dans `speedHeat`, la rampe de chaleur déjà partagée par
 * la carte et la heatmap, pour la même raison qu'elle a été construite : elle dit
 * une intensité sans or ni rouge. On en retient 3 des 4 arrêts (bleu, vert, jaune)
 * puisqu'il y a 3 terciles ; le cyan est un arrêt de transition.
 */
export function cardioZoneColor(zone: CardioZone | null): string {
  // Pas de zone situable → couleur INERTE : elle ne signifie rien d'autre que
  // « pas situable », surtout pas une quatrième zone implicite.
  if (zone === null) return palette.faint;
  if (zone === 'bas') return speedHeat[0]; // pas sombre — intensité basse
  if (zone === 'median') return speedHeat[2]; // pas clair — intermédiaire
  return speedHeat[3]; // pas le plus clair — intensité haute
}

/**
 * Libellé d'accessibilité de la pastille — vocabulaire FERMÉ et descriptif.
 *
 * Ces quatre chaînes sont lues par les lecteurs d'écran : elles doivent décrire une
 * POSITION, pas porter un jugement. Aucun mot d'évaluation ni d'alerte (« élevé »,
 * « critique », « anormal », « zone rouge »…) n'y entre — un test verrouille cet
 * invariant. Le cas null dit ce qui est vrai : la donnée est partagée, elle n'est
 * simplement pas encore situable.
 */
export function cardioZoneLabel(zone: CardioZone | null): string {
  if (zone === null) return 'cardio partagé';
  if (zone === 'bas') return 'cardio bas';
  if (zone === 'median') return 'cardio médian';
  return 'cardio haut';
}

/**
 * Étend la plage observée avec un nouvel échantillon — de façon IMMUABLE.
 *
 * C'est le seul producteur légitime de l'argument `observed` de `cardioZone` : la
 * plage doit être MESURÉE au fil de la séance, jamais devinée ni pré-remplie par
 * une valeur type. Première valeur finie → min = max = FC (plage d'amplitude nulle,
 * donc non situable tant qu'elle ne s'ouvre pas : c'est voulu).
 *
 * Une valeur non finie laisse `prev` STRICTEMENT inchangé (référence comprise) :
 * un décrochage capteur ne doit ni élargir la plage, ni provoquer un rendu. Même
 * logique quand la FC tombe à l'intérieur de la plage : on renvoie la référence
 * existante pour que l'appelant (mémo React) ne re-rende pas la pastille.
 */
export function updateObservedRange(
  prev: ObservedRange | null,
  hrBpm: number
): ObservedRange | null {
  if (typeof hrBpm !== 'number' || !Number.isFinite(hrBpm)) return prev;

  // Premier échantillon exploitable — ou plage antérieure corrompue à la frontière
  // non typée : on repart d'une plage honnête, adossée à une mesure réelle.
  if (prev === null || typeof prev !== 'object') return { minBpm: hrBpm, maxBpm: hrBpm };
  if (!Number.isFinite(prev.minBpm) || !Number.isFinite(prev.maxBpm)) {
    return { minBpm: hrBpm, maxBpm: hrBpm };
  }

  if (hrBpm < prev.minBpm) return { minBpm: hrBpm, maxBpm: prev.maxBpm };
  if (hrBpm > prev.maxBpm) return { minBpm: prev.minBpm, maxBpm: hrBpm };
  return prev;
}
