/**
 * Géométrie de la courbe de delta — jalon 4, phase 4septies. Logique PURE.
 *
 * ---
 *
 * POURQUOI LA GÉOMÉTRIE EST SÉPARÉE DU DESSIN
 *
 * Une mise à l'échelle fausse ne plante pas : elle produit une courbe
 * plausible. Un facteur d'échelle inversé, un axe qui n'inclut pas zéro, une
 * interpolation par-dessus un trou — rien de tout cela ne lève d'exception, et
 * tout cela ment au pilote.
 *
 * Ce module est donc testé à part, sur des valeurs qu'on peut calculer à la
 * main. Le composant ne fait plus que peindre ce qu'il reçoit.
 *
 * ---
 *
 * LES TROUS NE SE FRANCHISSENT PAS
 *
 * `computeDelta` rend `null` là où l'une des deux traces ne dit rien — sous le
 * plancher de vitesse, par exemple. Une polyligne unique passerait par-dessus
 * en ligne droite, et cette ligne droite se lirait comme une mesure.
 *
 * `runs()` découpe donc la courbe en segments continus. Un trou reste un trou,
 * et il se voit.
 *
 * ---
 *
 * ZÉRO EST TOUJOURS DANS LE CADRE
 *
 * L'axe vertical inclut zéro même si toute la courbe est d'un seul côté. Sans
 * cela, une séance où le pilote perd partout afficherait une courbe qui monte
 * depuis le bas du cadre, et la ligne de référence — celle qui donne son sens
 * au signe — sortirait de l'écran.
 */

/** Un point de la courbe, en coordonnées de dessin. */
export interface PointCourbe {
  x: number;
  y: number;
}

/** Le cadre de dessin, en points de vue SVG. */
export interface Cadre {
  largeur: number;
  hauteur: number;
}

/** L'échelle retenue, et ce qu'elle borne. */
export interface EchelleDelta {
  /** Distance minimale et maximale de la grille, en mètres. */
  distanceMin: number;
  distanceMax: number;
  /** Bornes verticales, en secondes. Contiennent toujours zéro. */
  deltaMin: number;
  deltaMax: number;
  /** Ordonnée de la ligne de référence (delta nul), en points de vue. */
  yZero: number;
}

/**
 * Marge verticale, en fraction de l'amplitude.
 *
 * Une courbe qui touche le bord haut du cadre paraît coupée. Dix pour cent
 * suffisent à la poser sans l'écraser.
 */
export const MARGE_VERTICALE = 0.1;

/**
 * Amplitude verticale minimale, en secondes.
 *
 * Sur un tour comparé à lui-même, le delta vaut zéro partout. Sans plancher,
 * l'échelle serait nulle et la division exploserait — ou pire, le bruit
 * numérique s'afficherait comme une courbe agitée.
 */
export const AMPLITUDE_MIN_S = 0.2;

/** Bornes verticales, zéro inclus, avec marge et plancher. */
export function echelleDelta(
  distances: readonly number[],
  cumule: readonly (number | null)[],
  cadre: Cadre
): EchelleDelta | null {
  if (distances.length === 0) return null;

  const valeurs = cumule.filter((v): v is number => v !== null && Number.isFinite(v));
  // Zéro entre TOUJOURS dans l'intervalle : c'est la ligne de référence, et
  // sans elle le signe de la courbe n'a plus de sens lisible.
  let bas = 0;
  let haut = 0;
  for (const v of valeurs) {
    if (v < bas) bas = v;
    if (v > haut) haut = v;
  }

  let amplitude = haut - bas;
  if (amplitude < AMPLITUDE_MIN_S) {
    const manque = (AMPLITUDE_MIN_S - amplitude) / 2;
    bas -= manque;
    haut += manque;
    amplitude = AMPLITUDE_MIN_S;
  }
  const marge = amplitude * MARGE_VERTICALE;
  bas -= marge;
  haut += marge;

  const distanceMin = distances[0];
  const distanceMax = distances[distances.length - 1];
  const etendue = haut - bas;

  return {
    distanceMin,
    distanceMax,
    deltaMin: bas,
    deltaMax: haut,
    yZero: cadre.hauteur * (1 - (0 - bas) / etendue),
  };
}

/** Un delta en secondes vers une ordonnée de dessin. */
export function versY(secondes: number, echelle: EchelleDelta, cadre: Cadre): number {
  const etendue = echelle.deltaMax - echelle.deltaMin;
  if (etendue <= 0) return cadre.hauteur / 2;
  return cadre.hauteur * (1 - (secondes - echelle.deltaMin) / etendue);
}

/** Une distance en mètres vers une abscisse de dessin. */
export function versX(metres: number, echelle: EchelleDelta, cadre: Cadre): number {
  const etendue = echelle.distanceMax - echelle.distanceMin;
  if (etendue <= 0) return 0;
  return ((metres - echelle.distanceMin) / etendue) * cadre.largeur;
}

/**
 * Découpe la courbe en segments CONTINUS.
 *
 * Un `null` interrompt le segment courant. Le suivant repart au premier point
 * connu — jamais de trait par-dessus le trou, qui se lirait comme une mesure.
 *
 * Un segment d'un seul point est conservé : il se dessinera en pastille, ce qui
 * est plus honnête que de le taire.
 */
export function runs(
  distances: readonly number[],
  cumule: readonly (number | null)[],
  echelle: EchelleDelta,
  cadre: Cadre
): PointCourbe[][] {
  const out: PointCourbe[][] = [];
  let courant: PointCourbe[] = [];

  const n = Math.min(distances.length, cumule.length);
  for (let i = 0; i < n; i++) {
    const v = cumule[i];
    if (v === null || !Number.isFinite(v) || !Number.isFinite(distances[i])) {
      if (courant.length > 0) out.push(courant);
      courant = [];
      continue;
    }
    courant.push({ x: versX(distances[i], echelle, cadre), y: versY(v, echelle, cadre) });
  }
  if (courant.length > 0) out.push(courant);
  return out;
}

/** `"12.3,45.6 78.9,10.1"` — la forme qu'attend `<Polyline points=…>`. */
export function versAttributPoints(points: readonly PointCourbe[]): string {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

/**
 * Un repère nommé posé sur la courbe — un virage, le plus souvent.
 *
 * Le nom vient du découpage en segments, donc du gyroscope. Sans lui, cette
 * liste est vide et la courbe se dessine sans repères : c'est le comportement
 * voulu, pas une dégradation à masquer.
 */
export interface Repere {
  /** Abscisse curviligne, en mètres. */
  distanceM: number;
  /** Nom affiché. « V3 », « Ligne droite », etc. */
  nom: string;
}

/** Un repère prêt à dessiner : sa position, et s'il tient dans le cadre. */
export interface RepereAncre extends Repere {
  x: number;
  /** Le libellé se pose-t-il à gauche du trait plutôt qu'à droite ? */
  aGauche: boolean;
}

/**
 * Largeur approximative d'un libellé de repère, en points de vue.
 *
 * Sert seulement à décider du côté : au-delà de cette marge du bord droit, le
 * libellé bascule à gauche du trait pour ne pas sortir du cadre.
 */
export const LARGEUR_LIBELLE = 34;

/**
 * Place les repères sur l'axe, en écartant ceux qui tombent hors grille et
 * ceux qui se chevaucheraient.
 *
 * **L'écartement n'est pas cosmétique.** Deux libellés superposés deviennent
 * illisibles tous les deux ; en garder un et taire l'autre serait pire encore,
 * puisque rien ne dirait qu'il manque. On garde donc le premier de chaque
 * groupe trop serré, et le compte des écartés est rendu à l'appelant.
 */
export function ancreRepere(
  reperes: readonly Repere[],
  echelle: EchelleDelta,
  cadre: Cadre,
  ecartMin = 28
): { ancres: RepereAncre[]; ecartes: number } {
  const dansGrille = reperes
    .filter((r) => r.distanceM >= echelle.distanceMin && r.distanceM <= echelle.distanceMax)
    .map((r) => ({ ...r, x: versX(r.distanceM, echelle, cadre) }))
    .sort((a, b) => a.x - b.x);

  const ancres: RepereAncre[] = [];
  let dernierX = Number.NEGATIVE_INFINITY;
  for (const r of dansGrille) {
    if (r.x - dernierX < ecartMin) continue;
    dernierX = r.x;
    ancres.push({ ...r, aGauche: r.x > cadre.largeur - LARGEUR_LIBELLE });
  }
  return { ancres, ecartes: dansGrille.length - ancres.length };
}

/**
 * Un delta en secondes, tel qu'il s'écrit.
 *
 * Le signe est un FAIT — positif, le tour courant a mis plus de temps — et il
 * s'écrit. Il ne se code pas en couleur : la banque de visualisations proscrit
 * « le delta coloré et le signe de comparaison imposé », qui transformeraient
 * un constat en verdict.
 *
 * `null` rend « — », jamais zéro.
 */
export function formateSecondes(v: number | null, decimales = 2): string {
  if (v === null || !Number.isFinite(v)) return '—';
  const signe = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${signe}${Math.abs(v).toFixed(decimales).replace('.', ',')} s`;
}

/** Une distance en mètres, telle qu'elle s'écrit sur un axe. */
export function formateDistance(m: number): string {
  if (!Number.isFinite(m)) return '—';
  if (Math.abs(m) >= 1000) return `${(m / 1000).toFixed(2).replace('.', ',')} km`;
  return `${Math.round(m)} m`;
}
