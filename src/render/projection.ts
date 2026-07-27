/**
 * Projection géographique → scène 2D locale, en mètres.
 *
 * Socle de rendu T1. Premier module, parce que tous les autres en dépendent :
 * on ne décime, on ne colore et on ne triangule que des points déjà projetés.
 *
 * ---
 *
 * POURQUOI CE MODULE EXISTE, ALORS QU'UNE PROJECTION EXISTE DÉJÀ
 *
 * `src/components/CircuitMap/projection.ts` projette **relativement à
 * `HAUTE_SAINTONGE_TRACK`**, en dur, avec un cache au niveau module. Origine et
 * viewBox sont ceux de ce circuit-là, définitivement.
 *
 * Le garde-fou multi-circuit existe côté ANALYSE — `analyzeTrackVizSession`
 * refuse une séance courue ailleurs plutôt que d'inventer des marges. Le RENDU
 * n'a pas cet égard : une séance de Valence y serait projetée avec l'origine de
 * Haute-Saintonge, donc très loin hors du viewBox, sans qu'aucune erreur ne soit
 * levée. Un écran vide, et rien pour le dire.
 *
 * Ce module ne connaît aucun circuit. Il reçoit des points, il en tire une
 * projection. C'est tout.
 *
 * ---
 *
 * LE MODÈLE, ET SA LIMITE ASSUMÉE
 *
 * Projection équirectangulaire locale : à l'échelle d'un circuit (quelques
 * kilomètres), la courbure terrestre est négligée. L'erreur croît avec l'écart à
 * l'origine et avec la latitude ; elle reste sous le mètre sur l'emprise d'un
 * circuit, ce qui est très en deçà de la précision du GPS lui-même.
 *
 * Ce n'est PAS une projection cartographique générale. Ne pas l'employer pour
 * des distances de l'ordre de la dizaine de kilomètres.
 */

/** Un point tel qu'il sort du GPS. */
export interface GeoPoint {
  lat: number;
  lon: number;
}

/** Un point de scène, en mètres, Y orienté vers le bas (convention écran). */
export interface ScenePoint {
  x: number;
  y: number;
}

export interface SceneBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Projection {
  /** Origine géographique — le barycentre des points fournis. */
  readonly origin: GeoPoint;
  /** Emprise des points projetés, en mètres. */
  readonly bounds: SceneBounds;
  /** Projette un point. Déterministe, sans effet de bord. */
  project(point: GeoPoint): ScenePoint;
  /** Chaîne `viewBox` SVG couvrant l'emprise, avec une marge en pourcentage. */
  viewBox(paddingPct?: number): string;
}

/** Mètres par degré de latitude. Constante WGS84 usuelle. */
const M_PER_DEG_LAT = 111_320;

/**
 * Emprise minimale, en mètres. Un tracé réduit à un point — ou à une ligne
 * parfaitement droite — donnerait un viewBox d'aire nulle, donc un rendu
 * invisible ou une division par zéro chez l'appelant. On garantit un cadre.
 */
const MIN_SPAN_M = 10;

const DEFAULT_PADDING_PCT = 12;

/**
 * Construit une projection à partir des points qui doivent tenir dans la scène.
 *
 * Rend `null` si la liste est vide : **l'absence de géométrie n'est pas une
 * erreur, et ne se remplace pas par une projection inventée.** L'appelant
 * affiche l'absence. C'est la même règle que côté analyse.
 */
export function buildProjection(points: readonly GeoPoint[]): Projection | null {
  if (points.length === 0) return null;

  let sumLat = 0;
  let sumLon = 0;
  for (const p of points) {
    sumLat += p.lat;
    sumLon += p.lon;
  }
  const originLat = sumLat / points.length;
  const originLon = sumLon / points.length;

  // Le facteur en longitude dépend de la latitude : un degré de longitude
  // vaut ~111 km à l'équateur et ~0 au pôle. C'est ce cosinus qui rend la
  // projection juste à Valence comme en Charente-Maritime.
  const mPerDegLon = M_PER_DEG_LAT * Math.cos((originLat * Math.PI) / 180);

  const project = (point: GeoPoint): ScenePoint => ({
    x: (point.lon - originLon) * mPerDegLon,
    // Y inversé : en géographie la latitude croît vers le nord, à l'écran
    // l'ordonnée croît vers le bas.
    y: -(point.lat - originLat) * M_PER_DEG_LAT,
  });

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    const s = project(p);
    if (s.x < minX) minX = s.x;
    if (s.x > maxX) maxX = s.x;
    if (s.y < minY) minY = s.y;
    if (s.y > maxY) maxY = s.y;
  }

  const bounds: SceneBounds = { minX, minY, maxX, maxY };

  const viewBox = (paddingPct: number = DEFAULT_PADDING_PCT): string => {
    const w = Math.max(maxX - minX, MIN_SPAN_M);
    const h = Math.max(maxY - minY, MIN_SPAN_M);
    // La marge se calcule sur l'emprise GARANTIE, pas sur l'emprise brute :
    // sinon un tracé plat donnerait une marge nulle sur un axe.
    const padX = (w * paddingPct) / 100;
    const padY = (h * paddingPct) / 100;
    // Recentrage : si l'emprise réelle est plus petite que le minimum garanti,
    // le cadre s'étend symétriquement autour d'elle plutôt que vers la droite.
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const x = cx - w / 2 - padX;
    const y = cy - h / 2 - padY;
    return `${x} ${y} ${w + 2 * padX} ${h + 2 * padY}`;
  };

  return {
    origin: { lat: originLat, lon: originLon },
    bounds,
    project,
    viewBox,
  };
}

/**
 * Distance en mètres entre deux points de scène. Euclidienne — la projection
 * ayant déjà ramené le problème dans le plan.
 */
export function sceneDistance(a: ScenePoint, b: ScenePoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

/**
 * Cap en degrés dans le repère de scène, dans `[0, 360)`, 0 vers le haut de
 * l'écran (nord) et croissant dans le sens horaire — comme un cap de navigation.
 *
 * Rend `null` si les deux points sont confondus : **un cap n'existe pas sans
 * déplacement**, et rendre 0 serait fabriquer une direction plein nord.
 */
export function sceneHeading(from: ScenePoint, to: ScenePoint): number | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return null;
  // `-dy` parce que l'axe Y de la scène descend : un déplacement vers le nord
  // a un dy négatif et doit donner un cap de 0.
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/**
 * Écart angulaire absolu entre deux caps, en degrés, dans `[0, 180]`.
 * Gère le passage par 0 : entre 350° et 10°, l'écart est 20°, pas 340°.
 */
export function headingDelta(a: number, b: number): number {
  const d = Math.abs(b - a) % 360;
  return d > 180 ? 360 - d : d;
}
