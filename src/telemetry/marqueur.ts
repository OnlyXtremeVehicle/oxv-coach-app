/**
 * LE MARQUEUR RÉSOLU (jalon 6, phase 5).
 *
 * *« L'application ne stocke pas un horodatage : elle le résout en tour, virage,
 * vitesse d'entrée, décélération, distance avant la corde. »* — Plan de montage.
 *
 * Module PUR : des trames entrent, un marqueur résolu sort. Aucun accès réseau,
 * aucune dépendance React.
 *
 * ---
 *
 * POURQUOI RÉSOUDRE PLUTÔT QUE STOCKER
 *
 * Un coach pose un marqueur au bord de la piste : il appuie, et l'instant est
 * enregistré. Seul, cet instant ne dit rien — « 14 h 32 min 07 s » n'aide
 * personne trois jours plus tard.
 *
 * Résolu, il devient : *tour 4, virage 5, entrée à 118 km/h, 0,9 g de freinage,
 * 42 m avant la corde*. Le même geste, devenu lisible — et surtout, devenu
 * COMPARABLE d'une séance à l'autre.
 *
 * ---
 *
 * TOUT CHAMP EST NULLABLE, ET C'EST LE POINT
 *
 * Chaque mesure vaut `null` quand elle n'est pas établie. Aucune n'est
 * reconstruite, aucune valeur de remplacement n'est inventée. Un marqueur
 * partiellement résolu se lit ; un marqueur faussement complet se croit.
 *
 * ---
 *
 * CONVENTION DES AXES G — VERROUILLÉE AILLEURS, RESPECTÉE ICI
 *
 * `gForceX > 0` vaut FREINAGE ; l'accélération est la part positive de `−gForceX` ;
 * le latéral est `|gForceY|`. Cette convention est fixée par
 * `captureFrameMapping` et gardée par ses tests. Ne pas la ré-interpréter :
 * inverser le signe transformerait chaque freinage en accélération.
 */

import { haversineDistance } from '@/utils/geo';

/**
 * Écart de temps maximal toléré entre le marqueur et la trame retenue.
 *
 * À 25 Hz, la trame la plus proche est à 20 ms. Au-delà d'une seconde, on n'est
 * plus sur le geste du coach mais sur un trou d'enregistrement — et une vitesse
 * lue une seconde trop tard, dans un freinage, peut être fausse de 30 km/h. On
 * préfère ne rien dire.
 */
export const ECART_TRAME_MAX_MS = 1000;

/**
 * Distance maximale entre le marqueur et une corde pour qu'on la nomme.
 *
 * Trois cents mètres : de quoi couvrir une zone de freinage complète, trop peu
 * pour désigner le virage d'après. Au-delà, aucun virage n'est rendu — un
 * marqueur posé en ligne droite reste un marqueur posé en ligne droite.
 */
export const DISTANCE_CORDE_MAX_M = 300;

/**
 * Fenêtre remontée depuis le marqueur pour y chercher la décélération.
 *
 * Deux secondes : la durée d'un freinage franc. Chercher plus loin en arrière
 * attraperait le freinage du virage précédent et l'attribuerait à celui-ci.
 */
export const FENETRE_FREINAGE_MS = 2000;

/** Une trame telle que la base la porte, champs éventuellement absents. */
export interface TrameMarqueur {
  elapsedMs: number;
  lat: number | null;
  lon: number | null;
  speedKmh: number | null;
  /** Convention verrouillée : > 0 = freinage. */
  gForceX: number | null;
}

/** Bornes d'un tour, en millisecondes écoulées depuis le début de la capture. */
export interface BorneTour {
  numero: number;
  debutMs: number;
  finMs: number;
}

/** Corde de référence d'un virage. `numero` est en BASE 1, comme en base. */
export interface CordeVirage {
  numero: number;
  lat: number;
  lon: number;
}

export interface MarqueurResolu {
  /** L'instant posé par le coach, tel quel. Toujours présent. */
  instantMs: number;
  tour: number | null;
  /** Numéro de virage, base 1 — jamais ré-incrémenté (cf. D-21). */
  virage: number | null;
  vitesseEntreeKmh: number | null;
  /** Décélération maximale relevée dans les deux secondes précédentes, en g. */
  decelerationG: number | null;
  distanceAvantCordeM: number | null;
  /**
   * Écart entre le marqueur et la trame retenue. Dit la PRÉCISION de la
   * résolution : un écart de 800 ms se lit autrement qu'un écart de 20 ms.
   * `null` quand aucune trame n'a pu être retenue.
   */
  ecartTrameMs: number | null;
}

/** La trame porte-t-elle une position exploitable ? */
function positionne(t: TrameMarqueur): t is TrameMarqueur & { lat: number; lon: number } {
  return (
    typeof t.lat === 'number' &&
    typeof t.lon === 'number' &&
    Number.isFinite(t.lat) &&
    Number.isFinite(t.lon)
  );
}

function nombreFini(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Trame la plus proche de l'instant, ou null si rien n'est assez proche. */
function trameLaPlusProche(
  trames: readonly TrameMarqueur[],
  instantMs: number
): { trame: TrameMarqueur; ecart: number } | null {
  let meilleure: TrameMarqueur | null = null;
  let ecart = Number.POSITIVE_INFINITY;

  for (const t of trames) {
    if (!nombreFini(t?.elapsedMs)) continue;
    const d = Math.abs(t.elapsedMs - instantMs);
    if (d < ecart) {
      ecart = d;
      meilleure = t;
    }
  }

  if (meilleure === null || ecart > ECART_TRAME_MAX_MS) return null;
  return { trame: meilleure, ecart };
}

/** Numéro du tour qui contient l'instant, ou null. */
function tourDe(bornes: readonly BorneTour[], instantMs: number): number | null {
  if (!Array.isArray(bornes)) return null;
  for (const b of bornes) {
    if (!nombreFini(b?.debutMs) || !nombreFini(b?.finMs) || !nombreFini(b?.numero)) continue;
    if (instantMs >= b.debutMs && instantMs <= b.finMs) return b.numero;
  }
  return null;
}

/** Corde la plus proche d'une position, avec sa distance. Null si trop loin. */
function cordeLaPlusProche(
  cordes: readonly CordeVirage[],
  lat: number,
  lon: number
): { virage: number; distanceM: number } | null {
  if (!Array.isArray(cordes)) return null;

  let meilleur: CordeVirage | null = null;
  let distance = Number.POSITIVE_INFINITY;

  for (const c of cordes) {
    if (!nombreFini(c?.lat) || !nombreFini(c?.lon) || !nombreFini(c?.numero)) continue;
    const d = haversineDistance(lat, lon, c.lat, c.lon);
    if (d < distance) {
      distance = d;
      meilleur = c;
    }
  }

  if (meilleur === null || distance > DISTANCE_CORDE_MAX_M) return null;
  // Le numéro est rendu TEL QUEL : il est déjà en base 1. L'incrémenter
  // désignerait le virage suivant (D-21).
  return { virage: meilleur.numero, distanceM: distance };
}

/**
 * Décélération maximale dans la fenêtre qui PRÉCÈDE l'instant.
 *
 * On ne regarde qu'en arrière : un marqueur posé à l'entrée d'un virage décrit
 * ce que le pilote vient de faire, pas ce qu'il va faire. Rend `null` si aucune
 * trame de la fenêtre ne porte de mesure de freinage.
 */
function decelerationAvant(trames: readonly TrameMarqueur[], instantMs: number): number | null {
  let max: number | null = null;
  const debut = instantMs - FENETRE_FREINAGE_MS;

  for (const t of trames) {
    if (!nombreFini(t?.elapsedMs)) continue;
    if (t.elapsedMs < debut || t.elapsedMs > instantMs) continue;
    if (!nombreFini(t.gForceX)) continue;
    // Convention verrouillée : seule la part POSITIVE est du freinage.
    if (t.gForceX <= 0) continue;
    if (max === null || t.gForceX > max) max = t.gForceX;
  }

  return max;
}

/**
 * Résout un marqueur en faits lisibles.
 *
 * Ne lève jamais : une entrée absente ou incohérente produit un marqueur dont
 * les champs valent `null`, jamais une erreur ni une valeur inventée.
 */
export function resoudreMarqueur(
  instantMs: number,
  trames: readonly TrameMarqueur[],
  bornes: readonly BorneTour[],
  cordes: readonly CordeVirage[]
): MarqueurResolu {
  const vide: MarqueurResolu = {
    instantMs,
    tour: null,
    virage: null,
    vitesseEntreeKmh: null,
    decelerationG: null,
    distanceAvantCordeM: null,
    ecartTrameMs: null,
  };

  if (!nombreFini(instantMs) || !Array.isArray(trames) || trames.length === 0) return vide;

  const proche = trameLaPlusProche(trames, instantMs);
  // Le tour se déduit des BORNES, pas des trames : il reste connaissable même
  // quand aucune trame n'est assez proche de l'instant.
  const tour = tourDe(bornes, instantMs);

  if (proche === null) return { ...vide, tour };

  const { trame, ecart } = proche;
  const situe = positionne(trame) ? cordeLaPlusProche(cordes, trame.lat, trame.lon) : null;

  return {
    instantMs,
    tour,
    virage: situe?.virage ?? null,
    vitesseEntreeKmh: nombreFini(trame.speedKmh) && trame.speedKmh >= 0 ? trame.speedKmh : null,
    decelerationG: decelerationAvant(trames, instantMs),
    distanceAvantCordeM: situe?.distanceM ?? null,
    ecartTrameMs: ecart,
  };
}

/**
 * Phrase courte d'un marqueur résolu, pour une liste ou un fil.
 *
 * N'énonce QUE ce qui est mesuré : les champs nuls ne laissent pas de trace. Un
 * marqueur dont rien n'a pu être résolu rend `null`, et l'appelant affiche alors
 * l'instant seul — jamais une phrase à trous.
 */
export function phraseMarqueur(m: MarqueurResolu): string | null {
  const bouts: string[] = [];
  if (nombreFini(m.tour)) bouts.push(`Tour ${m.tour}`);
  if (nombreFini(m.virage)) bouts.push(`virage ${m.virage}`);
  if (nombreFini(m.vitesseEntreeKmh)) bouts.push(`${Math.round(m.vitesseEntreeKmh)} km/h`);
  if (nombreFini(m.decelerationG)) bouts.push(`${m.decelerationG.toFixed(1)} g`);
  if (nombreFini(m.distanceAvantCordeM)) {
    bouts.push(`${Math.round(m.distanceAvantCordeM)} m avant la corde`);
  }
  return bouts.length > 0 ? bouts.join(' · ') : null;
}
