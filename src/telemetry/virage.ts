/**
 * VIRAGE — géométrie pure du zoom sur un virage.
 *
 * Aucun accès réseau, aucun composant : des points entrent, des points sortent.
 * Tout ce qui décide de ce qu'on voit est ici et se teste.
 *
 * ---
 *
 * LA FENÊTRE, ET CE QU'ELLE VAUT VRAIMENT
 *
 * Un virage est décrit en base par deux fractions de tour — `start_progress` et
 * `end_progress` dans `app_segment_analyses`. Les trames, elles, ne portent PAS
 * leur progression : `telemetry_frames` n'a pas de colonne `segment_progress`.
 *
 * On approche donc la progression par le RANG de la trame dans son tour :
 * `i / (n - 1)`. C'est exact si l'échantillonnage est régulier en temps ET la
 * vitesse constante — ce qui n'arrive jamais. Concrètement, la fenêtre est
 * décalée vers les portions lentes du tour, où les trames s'accumulent.
 *
 * **Cette approximation n'est valable que sur UN TOUR.** Appliquée à une séance
 * entière, elle ne découpe plus un virage mais une tranche arbitraire du
 * roulage. C'est exactement ce que faisait `cornerDeepDiveService` de l'arbre
 * V1 : il lisait mille trames de la SÉANCE et les découpait sur `i/(n-1)`. Ce
 * module ne prend donc que des trames de tour, et le type l'impose.
 *
 * La correction propre demande une colonne de progression par trame. Elle n'est
 * pas inventée ici.
 */

/** Une trame exploitable : position connue, vitesse éventuellement absente. */
export interface PointTour {
  lat: number;
  lon: number;
  speedKmh: number | null;
}

/** Fenêtre du virage en fractions de tour, telles que la base les porte. */
export interface FenetreVirage {
  start: number;
  end: number;
}

export interface TrancheVirage {
  points: PointTour[];
  /** Trame la plus proche de la corde de référence. null si aucune trame. */
  apex: PointTour | null;
}

/** Garde le point s'il porte bien deux coordonnées finies. */
function pointValide(p: {
  lat: number | null;
  lon: number | null;
  speedKmh?: number | null;
}): p is { lat: number; lon: number; speedKmh: number | null } {
  return p.lat !== null && p.lon !== null && Number.isFinite(p.lat) && Number.isFinite(p.lon);
}

/**
 * Découpe LES TRAMES D'UN TOUR sur la fenêtre du virage, et marque l'apex.
 *
 * `apexRef` est la corde de référence du circuit ; l'apex retenu est la trame
 * mesurée la plus proche — jamais un point construit. Sans fenêtre, tout le
 * tour est renvoyé : mieux vaut montrer trop que découper au hasard.
 */
export function trancheVirage(
  tramesDuTour: readonly { lat: number | null; lon: number | null; speedKmh?: number | null }[],
  fenetre: FenetreVirage | null,
  apexRef: { lat: number; lon: number } | null
): TrancheVirage {
  const valides: PointTour[] = [];
  for (const t of tramesDuTour) {
    if (pointValide(t)) valides.push({ lat: t.lat, lon: t.lon, speedKmh: t.speedKmh ?? null });
  }
  const n = valides.length;
  if (n === 0) return { points: [], apex: null };

  const fenetree =
    fenetre !== null && n > 1
      ? valides.filter((_, i) => {
          const p = i / (n - 1);
          return p >= fenetre.start && p <= fenetre.end;
        })
      : valides;

  if (fenetree.length === 0) return { points: [], apex: null };
  if (apexRef === null) return { points: fenetree, apex: null };

  // Argmin sur la distance au carré : la racine ne change pas le classement, et
  // on travaille en degrés — la comparaison reste locale au virage.
  let meilleur = 0;
  let d2 = Infinity;
  for (let i = 0; i < fenetree.length; i++) {
    const p = fenetree[i];
    const d = (p.lat - apexRef.lat) ** 2 + (p.lon - apexRef.lon) ** 2;
    if (d < d2) {
      d2 = d;
      meilleur = i;
    }
  }
  return { points: fenetree, apex: fenetree[meilleur] };
}

export interface Cadre {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/**
 * Cadre commun à plusieurs tranches — indispensable pour superposer deux
 * tours : deux cadres séparés les feraient coïncider visuellement alors qu'ils
 * ne passent pas au même endroit.
 *
 * Renvoie null si rien n'est cadrable.
 */
export function cadreCommun(tranches: readonly TrancheVirage[]): Cadre | null {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  let vus = 0;

  for (const t of tranches) {
    for (const p of t.points) {
      vus++;
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lon < minLon) minLon = p.lon;
      if (p.lon > maxLon) maxLon = p.lon;
    }
  }
  if (vus === 0) return null;

  // Un virage tenu au millimètre donnerait une étendue nulle et une division
  // par zéro à la projection. On ouvre alors un cadre minuscule mais fini.
  const EPS = 1e-9;
  if (maxLat - minLat < EPS) {
    minLat -= EPS;
    maxLat += EPS;
  }
  if (maxLon - minLon < EPS) {
    minLon -= EPS;
    maxLon += EPS;
  }
  return { minLat, maxLat, minLon, maxLon };
}

/**
 * Projette un point géographique dans une boîte de dessin, marge comprise.
 *
 * La latitude est inversée : elle croît vers le nord, l'axe Y d'un canvas croît
 * vers le bas. L'échelle est COMMUNE aux deux axes et le tracé est centré —
 * sans quoi un virage serré paraîtrait large et une épingle, ronde.
 */
export function projette(
  p: { lat: number; lon: number },
  cadre: Cadre,
  largeur: number,
  hauteur: number,
  marge: number
): { x: number; y: number } {
  const utileL = Math.max(1, largeur - 2 * marge);
  const utileH = Math.max(1, hauteur - 2 * marge);
  const etendueLat = cadre.maxLat - cadre.minLat;
  const etendueLon = cadre.maxLon - cadre.minLon;

  // Un degré de longitude est plus court qu'un degré de latitude dès qu'on
  // quitte l'équateur ; sans ce facteur, le virage serait étiré en largeur.
  const latMoyenne = ((cadre.minLat + cadre.maxLat) / 2) * (Math.PI / 180);
  const etendueLonCorrigee = etendueLon * Math.cos(latMoyenne);

  const echelle = Math.min(utileL / etendueLonCorrigee, utileH / etendueLat);
  const largeurTrace = etendueLonCorrigee * echelle;
  const hauteurTrace = etendueLat * echelle;
  const decalageX = marge + (utileL - largeurTrace) / 2;
  const decalageY = marge + (utileH - hauteurTrace) / 2;

  const x = decalageX + (p.lon - cadre.minLon) * Math.cos(latMoyenne) * echelle;
  const y = decalageY + (cadre.maxLat - p.lat) * echelle;
  return { x, y };
}
