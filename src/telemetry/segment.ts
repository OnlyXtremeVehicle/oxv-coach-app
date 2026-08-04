/**
 * Segmentation — découpage d'un tour en lignes droites et virages.
 *
 * Module T1bis. Détecte les virages par **seuillage de la courbure `1/R`**,
 * jamais du rayon : `R` diverge en ligne droite, et un seuil sur une grandeur
 * qui part à l'infini n'a pas de sens.
 *
 * ---
 *
 * POURQUOI UN SEUIL SEUL NE SUFFIT PAS
 *
 * Un simple `|1/R| > seuil` découpe un long virage en une dizaine de morceaux
 * dès que la courbure oscille autour de la valeur de coupure — et le bruit à
 * 25 Hz l'y fait osciller. On obtiendrait des « virages » de trois mètres.
 *
 * Deux garde-fous, tous deux nécessaires :
 *
 *   — **HYSTÉRÉSIS** : on entre en virage au-dessus du seuil haut, on n'en sort
 *     qu'en dessous du seuil bas. La zone morte entre les deux absorbe
 *     l'oscillation.
 *   — **LONGUEUR MINIMALE** : un segment plus court que quelques mètres n'est
 *     pas un virage, c'est du bruit. Il est absorbé par son voisin.
 *
 * ---
 *
 * CE MODULE NE NOMME PAS LES VIRAGES
 *
 * Il rend des bornes et un sens de rotation. L'appariement avec la topologie
 * connue d'un circuit — « virage 3 », « l'épingle » — appartient au circuit, pas
 * au signal. Confondre les deux ferait apparaître des noms de virages sur un
 * circuit dont on n'a pas la carte.
 */

export type SegmentKind = 'droite' | 'virage';
export type Rotation = 'gauche' | 'droite';

export interface Segment {
  kind: SegmentKind;
  /** Indices de début et de fin, inclus. */
  from: number;
  to: number;
  /** Abscisses curvilignes correspondantes, en mètres. */
  distanceFrom: number;
  distanceTo: number;
  /** Longueur du segment, en mètres. */
  length: number;
  /** Sens de rotation. `null` sur une ligne droite. */
  rotation: Rotation | null;
  /**
   * Courbure maximale rencontrée, en 1/m, en valeur absolue. `null` si le
   * segment ne porte aucune courbure exploitable.
   */
  peakCurvature: number | null;
}

export interface SegmentOptions {
  /**
   * Seuil d'ENTRÉE en virage, en 1/m. Défaut 1/200 — un rayon de 200 m, ce qui
   * distingue une vraie courbe d'une ligne droite qui n'est jamais parfaite.
   */
  enter?: number;
  /**
   * Seuil de SORTIE, en 1/m. Défaut 1/350. Plus bas que l'entrée : c'est
   * l'hystérésis qui empêche le découpage en confettis.
   */
  exit?: number;
  /** Longueur minimale d'un segment retenu, en mètres. Défaut 15. */
  minLength?: number;
}

const ENTER_DEFAUT = 1 / 200;
const EXIT_DEFAUT = 1 / 350;
const MIN_LENGTH_DEFAUT = 15;

/**
 * Découpe un tour en segments alternés.
 *
 * Rend une liste vide si l'entrée ne permet aucune lecture — pas un faux
 * segment couvrant tout le tour, qui laisserait croire à une analyse.
 */
export function segmentLap(
  curvature: readonly (number | null)[],
  distance: readonly number[],
  options: SegmentOptions = {}
): Segment[] {
  const enter = options.enter ?? ENTER_DEFAUT;
  const exit = options.exit ?? EXIT_DEFAUT;
  const minLength = options.minLength ?? MIN_LENGTH_DEFAUT;

  const n = Math.min(curvature.length, distance.length);
  if (n < 2) return [];

  // 1) Classement point par point, avec hystérésis.
  const enVirage: boolean[] = new Array(n).fill(false);
  let dedans = false;
  for (let i = 0; i < n; i++) {
    const c = curvature[i];
    if (c === null || !Number.isFinite(c)) {
      // Absence de courbure : on conserve l'état courant plutôt que de
      // trancher. Un trou de signal ne clôt pas un virage.
      enVirage[i] = dedans;
      continue;
    }
    const abs = Math.abs(c);
    if (!dedans && abs >= enter) dedans = true;
    else if (dedans && abs < exit) dedans = false;
    enVirage[i] = dedans;
  }

  // 2) Regroupement en segments bruts.
  const bruts: { kind: SegmentKind; from: number; to: number }[] = [];
  let debut = 0;
  for (let i = 1; i <= n; i++) {
    if (i === n || enVirage[i] !== enVirage[debut]) {
      bruts.push({ kind: enVirage[debut] ? 'virage' : 'droite', from: debut, to: i - 1 });
      debut = i;
    }
  }

  // 3) Absorption des segments trop courts.
  //
  // Par leur voisin PRÉCÉDENT quand il existe. Le premier segment du tour n'en
  // a pas : jusqu'au 04/08/2026 il échappait donc au filtre, et trois mètres de
  // bruit en tête de tour ressortaient comme un segment à part entière — alors
  // que les mêmes trois mètres au milieu du tour étaient absorbés. Le filtre
  // avait un trou, et il était toujours au même endroit.
  //
  // Sans précédent, on absorbe donc vers le SUIVANT : le début est reporté, et
  // le segment qui l'accueille garde son propre sens. C'est la symétrie exacte
  // de l'absorption arrière, qui conserve le sens du précédent.
  const fusionnes: typeof bruts = [];
  let debutReporte: number | null = null;
  for (const s of bruts) {
    const depart: number = debutReporte ?? s.from;
    const longueur = distance[s.to] - distance[depart];
    const precedent = fusionnes[fusionnes.length - 1];
    if (longueur < minLength) {
      if (precedent) {
        precedent.to = s.to;
        debutReporte = null;
      } else {
        debutReporte = depart;
      }
      continue;
    }
    fusionnes.push({ ...s, from: depart });
    debutReporte = null;
  }

  // Si `debutReporte` survit à la boucle, c'est que le tour ENTIER tient sous
  // `minLength` : les segments bruts partitionnent la trace, donc un début non
  // consommé signifie que l'accumulation n'a jamais atteint le seuil.
  //
  // On rend alors une liste vide, conformément au contrat annoncé en tête de
  // module : « pas un faux segment couvrant tout le tour, qui laisserait croire
  // à une analyse ». Quinze mètres ne se découpent pas en droites et en
  // virages. Avant le 04/08/2026 ce cas rendait un segment — parce que le
  // premier échappait au filtre, pas parce que quelqu'un l'avait décidé.

  // 4) Enrichissement — sens et courbure de pointe.
  return fusionnes.map((s) => {
    let peak: number | null = null;
    let signe = 0;
    for (let i = s.from; i <= s.to; i++) {
      const c = curvature[i];
      if (c === null || !Number.isFinite(c)) continue;
      const abs = Math.abs(c);
      if (peak === null || abs > peak) {
        peak = abs;
        signe = Math.sign(c);
      }
    }
    return {
      kind: s.kind,
      from: s.from,
      to: s.to,
      distanceFrom: distance[s.from],
      distanceTo: distance[s.to],
      length: distance[s.to] - distance[s.from],
      // Une ligne droite n'a pas de sens de rotation, et un virage sans
      // courbure exploitable non plus.
      rotation: s.kind === 'virage' && signe !== 0 ? (signe > 0 ? 'droite' : 'gauche') : null,
      peakCurvature: peak,
    };
  });
}

/**
 * Point de corde — l'indice de VITESSE MINIMALE dans un segment.
 *
 * Le dossier retient la vitesse minimale plutôt que le rayon minimal : c'est
 * *« l'indicateur le plus discriminant du niveau »*, et c'est un fait MESURÉ,
 * là où le rayon est une dérivation de plus.
 *
 * Rend `null` si le segment ne porte aucune vitesse exploitable.
 */
export function apexIndex(
  speed: readonly (number | null)[],
  from: number,
  to: number
): number | null {
  let best: number | null = null;
  let bestI: number | null = null;
  for (let i = Math.max(0, from); i <= Math.min(to, speed.length - 1); i++) {
    const v = speed[i];
    if (v === null || !Number.isFinite(v)) continue;
    if (best === null || v < best) {
      best = v;
      bestI = i;
    }
  }
  return bestI;
}
