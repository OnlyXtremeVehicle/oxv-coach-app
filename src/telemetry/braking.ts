/**
 * Freinage — module T1bis, sans capteur de pression.
 *
 * Le boîtier ne mesure aucune pression de frein. Tout ce qui suit est donc
 * **déduit de la décélération**, et le module le dit plutôt que de le laisser
 * croire.
 *
 * ---
 *
 * LE SEUIL DE −0,3 g, ET CE QU'IL EXCLUT
 *
 * Une voiture qui lève le pied décélère : frein moteur, traînée aérodynamique,
 * résistance au roulement. Compter cela comme un freinage ferait apparaître des
 * « zones de freinage » sur des lignes droites où le pilote n'a rien touché.
 *
 * −0,3 g est le seuil conventionnel qui sépare le lever de pied du freinage
 * réel. Il est conventionnel, donc réglable — mais il a une raison, et ce n'est
 * pas un réglage esthétique.
 *
 * ---
 *
 * CE QUE CE MODULE NE FAIT PAS
 *
 * Il ne dit pas si le pilote a bien ou mal freiné. Il ne compare pas à une
 * référence idéale. Il rapporte OÙ la décélération a commencé, combien elle a
 * duré, et jusqu'où elle est allée. *« L'attribution causale reste au coach. »*
 */

export interface BrakingZone {
  /** Indices de début et de fin, inclus. */
  from: number;
  to: number;
  /** Abscisses curvilignes, en mètres. */
  distanceFrom: number;
  distanceTo: number;
  /** Longueur de la zone, en mètres. */
  length: number;
  /** Durée, en secondes. */
  duration: number;
  /** Décélération maximale atteinte, en g (valeur NÉGATIVE). */
  peakG: number;
  /** Décélération moyenne sur la zone, en g (valeur négative). */
  meanG: number;
  /** Vitesse d'entrée et de sortie, en m/s. */
  entrySpeed: number;
  exitSpeed: number;
}

export interface BrakingOptions {
  /**
   * Seuil d'entrée en freinage, en g. Défaut −0,3 : conventionnel, exclut le
   * frein moteur.
   */
  threshold?: number;
  /**
   * Seuil de SORTIE, en g. Défaut −0,15 — hystérésis, pour ne pas hacher une
   * zone unique en plusieurs quand la décélération oscille autour du seuil.
   */
  release?: number;
  /** Durée minimale d'une zone retenue, en secondes. Défaut 0,2. */
  minDuration?: number;
}

/**
 * Seuil d'entrée en freinage, en g. **Constante PARTAGÉE du dépôt.**
 *
 * −0,3 g est la convention qui sépare un freinage d'un simple lever de pied :
 * le frein moteur d'une voiture de route décélère autour de −0,1 à −0,2 g, un
 * appui franc dépasse largement −0,5 g.
 *
 * Elle est exportée depuis le 13/08/2026 parce que `brakingPointsService`
 * portait son PROPRE critère — une chute de 15 km/h, sans notion de distance —
 * et que deux seuils pour une même notion finissent toujours par diverger.
 * `DETTE.md` relevait « trois seuils de freinage sans constante partagée » ;
 * c'en est une.
 */
export const SEUIL_FREINAGE_G = -0.3;

const SEUIL_DEFAUT_G = SEUIL_FREINAGE_G;
const RELACHE_DEFAUT_G = -0.15;
const DUREE_MIN_DEFAUT_S = 0.2;

/**
 * Détecte les zones de freinage d'un tour.
 *
 * Rend une liste vide si rien ne dépasse le seuil — une séance de découverte
 * sans freinage franc est un fait, pas une erreur.
 */
export function detectBrakingZones(
  aLong: readonly (number | null)[],
  speed: readonly number[],
  distance: readonly number[],
  time: readonly number[],
  options: BrakingOptions = {}
): BrakingZone[] {
  const seuil = options.threshold ?? SEUIL_DEFAUT_G;
  const relache = options.release ?? RELACHE_DEFAUT_G;
  const dureeMin = options.minDuration ?? DUREE_MIN_DEFAUT_S;

  const n = Math.min(aLong.length, speed.length, distance.length, time.length);
  const zones: BrakingZone[] = [];

  let debut: number | null = null;

  for (let i = 0; i < n; i++) {
    const a = aLong[i];
    if (a === null || !Number.isFinite(a)) continue;

    if (debut === null) {
      if (a <= seuil) debut = i;
      continue;
    }
    // En freinage : on n'en sort qu'au-dessus du seuil de relâche.
    if (a > relache) {
      const zone = construire(debut, i - 1, aLong, speed, distance, time);
      if (zone && zone.duration >= dureeMin) zones.push(zone);
      debut = null;
    }
  }

  // Une zone encore ouverte à la fin du tour est réelle : on la ferme.
  if (debut !== null) {
    const zone = construire(debut, n - 1, aLong, speed, distance, time);
    if (zone && zone.duration >= dureeMin) zones.push(zone);
  }

  return zones;
}

function construire(
  from: number,
  to: number,
  aLong: readonly (number | null)[],
  speed: readonly number[],
  distance: readonly number[],
  time: readonly number[]
): BrakingZone | null {
  if (to < from) return null;

  let peak = 0;
  let somme = 0;
  let compte = 0;
  for (let i = from; i <= to; i++) {
    const a = aLong[i];
    if (a === null || !Number.isFinite(a)) continue;
    if (a < peak) peak = a;
    somme += a;
    compte++;
  }
  // Aucune valeur exploitable : la zone n'existe pas. Rendre des zéros
  // fabriquerait un freinage à décélération nulle.
  if (compte === 0) return null;

  return {
    from,
    to,
    distanceFrom: distance[from],
    distanceTo: distance[to],
    length: distance[to] - distance[from],
    duration: time[to] - time[from],
    peakG: peak,
    meanG: somme / compte,
    entrySpeed: speed[from],
    exitSpeed: speed[to],
  };
}

/**
 * Dispersion des points de freinage entre tours, en mètres.
 *
 * Écart-type des abscisses curvilignes d'entrée en freinage sur une même zone.
 * C'est la mesure de RÉPÉTABILITÉ — un pilote régulier freine au même endroit.
 *
 * Le dossier recommande **médiane et MAD** plutôt que moyenne et écart-type
 * quand l'échantillon est petit ou porte des tours aberrants dus au trafic. Les
 * deux sont rendus : à l'appelant de choisir selon son échantillon.
 *
 * Rend `null` sous deux points — une dispersion d'un seul point n'existe pas.
 */
export function brakingDispersion(
  abscisses: readonly number[]
): { mean: number; stdDev: number; median: number; mad: number } | null {
  const xs = abscisses.filter((x) => Number.isFinite(x));
  if (xs.length < 2) return null;

  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length;

  const tri = [...xs].sort((a, b) => a - b);
  const median = mediane(tri);
  const ecarts = tri.map((x) => Math.abs(x - median)).sort((a, b) => a - b);

  return { mean, stdDev: Math.sqrt(variance), median, mad: mediane(ecarts) };
}

function mediane(trie: readonly number[]): number {
  const m = trie.length >> 1;
  return trie.length % 2 === 0 ? (trie[m - 1] + trie[m]) / 2 : trie[m];
}
