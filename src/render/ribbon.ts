/**
 * Ruban triangulé le long d'une trace projetée.
 *
 * Socle de rendu T1, module 4 — la pièce centrale. Transforme une polyligne en
 * bande épaisse colorable point par point, prête pour un `Vertices` Skia en mode
 * `triangleStrip`.
 *
 * ---
 *
 * LA VRAIE DIFFICULTÉ N'EST PAS LE TRIANGLE, C'EST LA JOINTURE
 *
 * Décaler chaque point de la demi-largeur le long de la normale de SON segment
 * paraît suffisant. Ça ne l'est pas : à chaque changement de direction, les deux
 * segments adjacents décalent le même point vers deux endroits différents. Le
 * ruban s'ouvre côté extérieur du virage et se replie côté intérieur.
 *
 * La correction est l'ONGLET (miter) : au lieu de la normale d'un segment, on
 * décale le long de la bissectrice des deux normales, allongée de `1/cos(θ/2)`
 * pour que les bords des deux segments se rejoignent exactement.
 *
 * ---
 *
 * ET POURQUOI L'ONGLET DOIT ÊTRE BRIDÉ
 *
 * Ce facteur `1/cos(θ/2)` DIVERGE quand l'angle se referme : sur une épingle
 * serrée, il tend vers l'infini et projette une pointe de plusieurs dizaines de
 * mètres hors du circuit. Un artefact spectaculaire, et une donnée fausse — le
 * ruban dirait une largeur que rien ne justifie.
 *
 * D'où la bride. Au-delà, on renonce à l'onglet parfait et on retombe sur la
 * bissectrice simple : la jointure n'est plus rigoureusement jointive, mais elle
 * reste dans le circuit. Sur une trace de piste, ce compromis ne se voit pas ;
 * la pointe, elle, se verrait.
 */

import { sceneDistance, type ScenePoint } from './projection';

export interface RibbonOptions {
  /**
   * Largeur du ruban en mètres. Constante, ou fonction de l'indice du point
   * pour un ruban qui respire — par exemple avec la vitesse.
   */
  width: number | ((index: number) => number);
  /**
   * Allongement maximal de l'onglet. Défaut 4 : au-delà d'environ 29° d'angle
   * résiduel, on renonce à la jointure parfaite plutôt que de lancer une pointe.
   */
  miterLimit?: number;
}

export interface Ribbon {
  /**
   * Sommets, deux par point de la trace : gauche puis droite. Ordre direct pour
   * un `triangleStrip` — les triangles se forment sur les triplets glissants.
   */
  vertices: ScenePoint[];
  /** Nombre de points de trace effectivement retenus. */
  count: number;
}

const DEFAUT_MITER_LIMIT = 4;

/** Normalise un vecteur. Rend `null` s'il est nul — une direction ne s'invente pas. */
function normalise(x: number, y: number): { x: number; y: number } | null {
  const n = Math.hypot(x, y);
  if (n === 0) return null;
  return { x: x / n, y: y / n };
}

/**
 * Construit le ruban.
 *
 * Rend `null` en dessous de deux points distincts : une bande a besoin d'une
 * direction, et il n'y en a pas. L'appelant affiche l'absence.
 *
 * Les points consécutifs confondus sont écartés en amont : ils ne portent aucune
 * direction et feraient dégénérer les normales.
 */
export function buildRibbon(points: readonly ScenePoint[], options: RibbonOptions): Ribbon | null {
  const miterLimit = options.miterLimit ?? DEFAUT_MITER_LIMIT;

  // Nettoyage des doublons consécutifs, en gardant l'ordre.
  const pts: ScenePoint[] = [];
  for (const p of points) {
    const dernier = pts[pts.length - 1];
    if (!dernier || sceneDistance(dernier, p) > 0) pts.push(p);
  }
  if (pts.length < 2) return null;

  const largeurA = (i: number): number =>
    typeof options.width === 'function' ? options.width(i) : options.width;

  const vertices: ScenePoint[] = [];

  for (let i = 0; i < pts.length; i++) {
    const demi = largeurA(i) / 2;

    // Direction entrante et sortante. Aux extrémités, une seule existe.
    const entrant = i > 0 ? normalise(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y) : null;
    const sortant =
      i < pts.length - 1 ? normalise(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y) : null;

    // Normale d'un segment : la direction tournée d'un quart de tour.
    const normaleDe = (d: { x: number; y: number }) => ({ x: -d.y, y: d.x });

    let nx: number;
    let ny: number;

    if (!entrant || !sortant) {
      // Extrémité : la normale du seul segment disponible.
      const d = entrant ?? sortant!;
      const n = normaleDe(d);
      nx = n.x;
      ny = n.y;
    } else {
      const n1 = normaleDe(entrant);
      const n2 = normaleDe(sortant);
      const bissectrice = normalise(n1.x + n2.x, n1.y + n2.y);

      if (!bissectrice) {
        // Demi-tour exact : les deux normales s'annulent. Aucune bissectrice
        // n'existe ; on garde la normale entrante plutôt que de diviser par zéro.
        nx = n1.x;
        ny = n1.y;
      } else {
        // `1/cos(θ/2)`, obtenu sans trigonométrie : le produit scalaire de la
        // bissectrice avec l'une des normales VAUT cos(θ/2).
        const cos = bissectrice.x * n1.x + bissectrice.y * n1.y;
        const facteur = cos === 0 ? miterLimit : 1 / cos;
        const bride = Math.min(Math.abs(facteur), miterLimit);
        nx = bissectrice.x * bride;
        ny = bissectrice.y * bride;
      }
    }

    vertices.push({ x: pts[i].x + nx * demi, y: pts[i].y + ny * demi });
    vertices.push({ x: pts[i].x - nx * demi, y: pts[i].y - ny * demi });
  }

  return { vertices, count: pts.length };
}

/**
 * Duplique une valeur par point de trace en une valeur par sommet.
 *
 * Le ruban porte deux sommets par point : une couleur calculée par point doit
 * être doublée pour que Skia colore la bande, et non un bord sur deux.
 */
export function perVertex<T>(perPoint: readonly T[]): T[] {
  const out: T[] = [];
  for (const v of perPoint) {
    out.push(v, v);
  }
  return out;
}
