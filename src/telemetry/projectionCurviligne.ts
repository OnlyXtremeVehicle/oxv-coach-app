/**
 * PROJECTION CURVILIGNE — de l'abscisse en mètres au point du tracé. Logique PURE.
 *
 * Les modules d'analyse parlent en DISTANCE le long du tour (`distanceM`,
 * zones de `confianceLogic`, delta par distance…). Le tracé de l'écran Séance
 * (`TraceCircuit`) parle en POINTS de polyligne. Ce module est le chaînon :
 * il indexe la polyligne par distances cumulées, puis répond à deux questions —
 * « où est le mètre s ? » (pour poser une puce) et « quels points couvrent
 * [début, fin] ? » (pour surligner une zone, celle où la confiance de mesure
 * est réduite, par exemple).
 *
 * Représentation ADOPTÉE, pas inventée : la même que `TraceCircuit` —
 * une centerline lat/lon (base `circuits.centerline_latlon`) ou déjà métrique
 * `{x, y}`. Les lat/lon passent par `projectToMeters` du générateur de
 * circuits, réutilisé tel quel (doctrine « reproduire, ne pas réinventer »).
 * L'index travaille donc en MÈTRES ; l'appelant qui veut des pixels applique
 * ensuite la même transformation écran qu'au reste du tracé.
 *
 * ===========================================================================
 * TROIS RÈGLES D'HONNÊTETÉ GÉOMÉTRIQUE
 * ===========================================================================
 *
 * 1. **Hors du tour, rien.** Une abscisse en dehors de [0, longueur] (au-delà
 *    de la tolérance flottante) rend `null` — jamais un point extrapolé ni un
 *    rabattement silencieux sur une extrémité. Un appelant qui reçoit `null`
 *    sait que sa distance et ce tracé ne parlent pas du même tour.
 *
 * 2. **Un tracé inexploitable n'a pas d'index.** Moins de deux points situés,
 *    ou une longueur nulle : `construireIndex` rend `null`. Pas de silhouette
 *    inventée (même règle que `TraceCircuit`).
 *
 * 3. **Le bouclage est explicite.** Un tour fermé possède un segment de
 *    fermeture (dernier point → premier) qui COMPTE dans la longueur, et une
 *    portion peut le traverser (début 3 800 m, fin 200 m). Un tracé ouvert ne
 *    boucle jamais : une portion « à l'envers » y rend `null`.
 */

import { projectToMeters, type LatLon, type Point } from '@/circuit/circuitGenerator';

// ===========================================================================
// Conventions nommées
// ===========================================================================

/** Version du calcul — à incrémenter à chaque changement de méthode. */
export const VERSION_PROJECTION_CURVILIGNE = '1.0.0';

/**
 * Tolérance sur les comparaisons d'abscisses, en mètres.
 *
 * Elle absorbe l'arithmétique flottante — un découpage en zones dont les
 * bornes se recomposent en `longueur ± epsilon` — et RIEN d'autre : un
 * millimètre est déjà cent fois trop grand pour être une erreur d'addition,
 * et bien trop petit pour être une vraie distance de tour. Une abscisse dans
 * la tolérance est rabattue sur la borne ; au-delà, c'est `null`.
 */
export const TOLERANCE_ABSCISSE_M = 1e-3;

/**
 * En deçà de cet écart entre deux abscisses, une portion est dite SANS
 * étendue : il n'y a rien à surligner, on rend `null` plutôt qu'un point
 * déguisé en segment.
 */
export const ETENDUE_MIN_PORTION_M = TOLERANCE_ABSCISSE_M;

// ===========================================================================
// Types
// ===========================================================================

/**
 * L'index d'une polyligne par distances cumulées. Construit une fois par
 * tracé, interrogé autant de fois qu'il y a de zones ou de repères à poser.
 *
 * Ne se fabrique QUE par `construireIndex` : les invariants (points finis,
 * cumulées croissantes, doublon de fermeture retiré) sont garantis là-bas.
 */
export interface IndexCurviligne {
  /**
   * Sommets métriques de la polyligne. Pour un tracé fermé, le premier point
   * n'est PAS dupliqué en fin de liste : la fermeture est portée par
   * `ferme`, pas par un doublon.
   */
  points: readonly Point[];
  /**
   * Distance cumulée au sommet i, en mètres. `cumulees[0]` vaut 0 ;
   * la liste est croissante (au sens large : deux sommets confondus
   * partagent leur cumulée).
   */
  cumulees: readonly number[];
  /** Le tracé boucle-t-il (segment de fermeture dernier → premier) ? */
  ferme: boolean;
  /**
   * Longueur totale de la polyligne, en mètres — segment de fermeture
   * INCLUS si `ferme`. C'est la borne haute des abscisses admises.
   */
  longueurTotale: number;
}

// ===========================================================================
// Construction de l'index
// ===========================================================================

function estFini(p: Point): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y);
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Construit l'index curviligne d'une polyligne — lat/lon (forme de la base)
 * ou déjà métrique `{x, y}`, exactement comme `TraceCircuit` la reçoit.
 *
 * Les points non finis sont écartés (même règle que `fitPointsToBox`). Pour
 * un tracé fermé dont la base duplique le premier point en dernier (forme
 * usuelle d'un way OSM fermé), le doublon est retiré : la fermeture est un
 * fait de l'index, pas un point de plus.
 *
 * Rend `null` quand la polyligne est inexploitable : moins de deux points
 * situés, ou longueur nulle (tous les points confondus). Un index de rien
 * n'existe pas.
 */
export function construireIndex(
  polyligne: readonly LatLon[] | readonly Point[],
  ferme: boolean
): IndexCurviligne | null {
  if (polyligne.length < 2) return null;

  const premier = polyligne[0];
  const metriques: Point[] =
    'lat' in premier
      ? projectToMeters([...(polyligne as readonly LatLon[])])
      : [...(polyligne as readonly Point[])];

  const points = metriques.filter(estFini);
  if (points.length < 2) return null;

  // Doublon de fermeture : un way fermé répète souvent son premier point en
  // dernier. Le garder créerait un segment de fermeture de longueur nulle et
  // fausserait le bouclage — on le retire, la fermeture vit dans `ferme`.
  if (ferme && points.length > 2 && distance(points[0], points[points.length - 1]) === 0) {
    points.pop();
  }

  const cumulees: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cumulees.push(cumulees[i - 1] + distance(points[i - 1], points[i]));
  }

  const longueurTotale = ferme
    ? cumulees[cumulees.length - 1] + distance(points[points.length - 1], points[0])
    : cumulees[cumulees.length - 1];

  if (longueurTotale <= 0) return null;

  return { points, cumulees, ferme, longueurTotale };
}

// ===========================================================================
// Abscisse → point
// ===========================================================================

/**
 * Rabat `s` sur [0, longueur] si l'écart tient dans la tolérance flottante ;
 * rend `null` sinon (vraiment dehors) ou si `s` n'est pas un nombre fini.
 */
function abscisseAdmise(index: IndexCurviligne, s: number): number | null {
  if (!Number.isFinite(s)) return null;
  if (s < -TOLERANCE_ABSCISSE_M || s > index.longueurTotale + TOLERANCE_ABSCISSE_M) return null;
  return Math.min(Math.max(s, 0), index.longueurTotale);
}

/** Interpolation linéaire entre deux points, u dans [0, 1]. */
function interpoler(a: Point, b: Point, u: number): Point {
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
}

/**
 * Le point du tracé à l'abscisse `s` (mètres depuis le départ du tour),
 * interpolé linéairement entre les deux sommets qui l'encadrent.
 *
 * `s` hors de [0, longueurTotale] (tolérance comprise) → `null`, JAMAIS une
 * extrapolation silencieuse. Sur un tracé fermé, `s = longueurTotale` rend le
 * point de départ : la fin du tour est son début.
 */
export function pointADistance(index: IndexCurviligne, s: number): Point | null {
  const abscisse = abscisseAdmise(index, s);
  if (abscisse === null) return null;

  const { points, cumulees, ferme, longueurTotale } = index;
  const dernierSommetM = cumulees[cumulees.length - 1];

  // Segment de fermeture (dernier sommet → premier) d'un tracé fermé.
  if (ferme && abscisse >= dernierSommetM) {
    const longueurFermeture = longueurTotale - dernierSommetM;
    if (longueurFermeture <= 0) return { ...points[0] };
    const u = (abscisse - dernierSommetM) / longueurFermeture;
    return interpoler(points[points.length - 1], points[0], Math.min(u, 1));
  }

  // Tracé ouvert : l'abscisse rabattue sur la longueur est le dernier sommet.
  if (!ferme && abscisse >= dernierSommetM) return { ...points[points.length - 1] };

  for (let i = 1; i < cumulees.length; i++) {
    if (abscisse > cumulees[i]) continue;
    const longueurSegment = cumulees[i] - cumulees[i - 1];
    // Sommets confondus : segment sans étendue, le point est le sommet même.
    if (longueurSegment <= 0) return { ...points[i] };
    const u = (abscisse - cumulees[i - 1]) / longueurSegment;
    return interpoler(points[i - 1], points[i], u);
  }

  // Inatteignable : l'abscisse admise est bornée par les cas ci-dessus.
  return { ...points[points.length - 1] };
}

// ===========================================================================
// Portion — la sous-polyligne d'une zone
// ===========================================================================

/**
 * Sous-polyligne SANS bouclage, `0 ≤ debutM ≤ finM ≤ longueur` garanti par
 * l'appelant. Extrémités interpolées, sommets strictement intérieurs repris
 * tels quels (sans doublonner un sommet confondu avec une extrémité).
 */
function portionDroite(index: IndexCurviligne, debutM: number, finM: number): Point[] {
  const debut = pointADistance(index, debutM);
  const fin = pointADistance(index, finM);
  // Invariant d'appel : les deux abscisses sont admises.
  if (debut === null || fin === null) return [];

  const sortie: Point[] = [debut];
  for (let i = 0; i < index.cumulees.length; i++) {
    const c = index.cumulees[i];
    if (c > debutM + TOLERANCE_ABSCISSE_M && c < finM - TOLERANCE_ABSCISSE_M) {
      sortie.push({ ...index.points[i] });
    }
  }
  sortie.push(fin);
  return sortie;
}

/**
 * La sous-polyligne couvrant [debutM, finM] — le géométrique d'une zone de
 * distance (celles de `decouperZones`, notamment), prête à être surlignée sur
 * le tracé. Extrémités interpolées, sommets intérieurs conservés.
 *
 * Bouclage : sur un tracé FERMÉ, `finM < debutM` désigne la portion qui
 * traverse la ligne (début 3 800 m → fin 200 m d'un tour de 4 000 m) ; le
 * point de jonction (fin du tour = début du tour) n'apparaît qu'une fois.
 * Sur un tracé ouvert, `finM < debutM` rend `null` : rien n'y boucle.
 *
 * `null` aussi quand une borne sort de [0, longueur] (tolérance comprise) —
 * jamais une portion partielle silencieuse — ou quand l'étendue est sous
 * `ETENDUE_MIN_PORTION_M` : un point n'est pas une portion, `pointADistance`
 * est là pour lui.
 */
export function portion(index: IndexCurviligne, debutM: number, finM: number): Point[] | null {
  const debut = abscisseAdmise(index, debutM);
  const fin = abscisseAdmise(index, finM);
  if (debut === null || fin === null) return null;

  if (fin >= debut) {
    if (fin - debut < ETENDUE_MIN_PORTION_M) return null;
    return portionDroite(index, debut, fin);
  }

  // fin < debut : bouclage, réservé aux tracés fermés. Chaque moitié n'existe
  // que si elle a une étendue ; une moitié sous la tolérance est un résidu
  // flottant, pas un bout de tracé.
  if (!index.ferme) return null;
  const avantLigne =
    index.longueurTotale - debut >= ETENDUE_MIN_PORTION_M
      ? portionDroite(index, debut, index.longueurTotale)
      : null;
  const apresLigne = fin >= ETENDUE_MIN_PORTION_M ? portionDroite(index, 0, fin) : null;

  if (avantLigne !== null && apresLigne !== null) {
    // Le point à `longueurTotale` et le point à 0 sont le même : une seule fois.
    return [...avantLigne, ...apresLigne.slice(1)];
  }
  // Une seule moitié a une étendue : la portion, c'est elle (l'autre borne est
  // sur la ligne, à la tolérance près). Aucune des deux : rien à surligner.
  return avantLigne ?? apresLigne;
}

// ===========================================================================
// Longueur
// ===========================================================================

/**
 * Longueur totale de la polyligne indexée, en mètres — fermeture incluse si
 * le tracé est fermé. C'est la borne haute que `pointADistance` et `portion`
 * admettent.
 */
export function longueurTotale(index: IndexCurviligne): number {
  return index.longueurTotale;
}
