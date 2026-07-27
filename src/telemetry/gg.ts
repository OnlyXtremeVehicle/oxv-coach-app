/**
 * Enveloppe d'adhérence — module T1bis, versant CALCUL.
 *
 * Division du travail avec `src/render/gg.ts`, qui est le versant RENDU :
 * celui-là range les échantillons en cases de densité pour dessiner un nuage.
 * Celui-ci mesure la forme de ce nuage — son contour, et la part du temps passée
 * près de ce contour.
 *
 * ---
 *
 * LE VOCABULAIRE EST DOCTRINAL, PAS COSMÉTIQUE
 *
 * La littérature dit « cercle d'adhérence », « limite du pneu ». Ces mots
 * n'apparaissent pas ici. Affirmer une limite exigerait un modèle de pneu, une
 * masse, une charge aérodynamique et un état de piste que l'application n'a pas.
 *
 * Ce qui se mesure, c'est l'**enveloppe atteinte** : le plus loin que le pilote
 * est allé, ce jour-là, avec cette voiture, sur cette piste. Une limite invite à
 * s'en approcher ; une enveloppe atteinte constate. Le mot « marge » remplace
 * partout le mot « limite ».
 *
 * ---
 *
 * LE TAUX D'EXPLOITATION EST FRAGILE, ET LE DIT
 *
 * Le dossier le classe *« moyennement robuste : dépend de la qualité de
 * l'enveloppe et du filtrage, et le bruit gonfle les extrêmes »*. Un seul
 * échantillon aberrant élargit l'enveloppe et fait chuter le taux pour tous les
 * autres. Le module rend donc le nombre d'échantillons et la méthode employée,
 * pour que l'appelant puisse pondérer sa confiance.
 */

export interface GgPoint {
  /** Accélération latérale, en g. Positif = appui à droite. */
  lat: number;
  /** Accélération longitudinale, en g. Positif = accélère. */
  long: number;
}

export interface ReachedEnvelope {
  /** Contour, en ordre trigonométrique. Vide si le nuage est dégénéré. */
  hull: GgPoint[];
  /** Nombre d'échantillons exploitables retenus. */
  count: number;
  /** Magnitude maximale atteinte, en g. `null` si aucun échantillon. */
  peak: number | null;
}

/**
 * Coque convexe des extrêmes — parcours de Graham (balayage d'Andrew).
 *
 * Préférée à l'ellipse aux moindres carrés pour une raison doctrinale : une
 * ellipse LISSE le nuage, donc invente un contour là où le pilote n'est jamais
 * allé. La coque ne passe que par des points RÉELLEMENT atteints.
 *
 * Rend une coque vide sous trois points distincts : un contour a besoin d'une
 * surface, et deux points n'en délimitent aucune.
 */
export function reachedHull(samples: readonly GgPoint[]): ReachedEnvelope {
  const pts = samples.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.long));
  let peak: number | null = null;
  for (const p of pts) {
    const m = Math.hypot(p.lat, p.long);
    if (peak === null || m > peak) peak = m;
  }
  if (pts.length < 3) return { hull: [], count: pts.length, peak };

  const tri = [...pts].sort((a, b) => a.lat - b.lat || a.long - b.long);
  const croix = (o: GgPoint, a: GgPoint, b: GgPoint) =>
    (a.lat - o.lat) * (b.long - o.long) - (a.long - o.long) * (b.lat - o.lat);

  const bas: GgPoint[] = [];
  for (const p of tri) {
    while (bas.length >= 2 && croix(bas[bas.length - 2], bas[bas.length - 1], p) <= 0) bas.pop();
    bas.push(p);
  }
  const haut: GgPoint[] = [];
  for (let i = tri.length - 1; i >= 0; i--) {
    const p = tri[i];
    while (haut.length >= 2 && croix(haut[haut.length - 2], haut[haut.length - 1], p) <= 0)
      haut.pop();
    haut.push(p);
  }
  bas.pop();
  haut.pop();
  const hull = bas.concat(haut);

  // Tous les points alignés : la coque dégénère en segment, ce n'est pas un
  // contour. On le dit plutôt que de rendre une forme d'aire nulle.
  return { hull: hull.length >= 3 ? hull : [], count: pts.length, peak };
}

export interface ExploitationRate {
  /** Fraction du temps où la magnitude dépasse `fraction` de l'enveloppe. */
  rate: number;
  /** Échantillons retenus. */
  count: number;
  /** Seuil employé, en g. */
  thresholdG: number;
  /**
   * Fiabilité déclarée. Le dossier classe cette grandeur « moyennement
   * robuste » : le bruit gonfle les extrêmes, donc l'enveloppe, donc fait
   * chuter le taux.
   */
  reliability: 'moyenne';
}

/**
 * Taux d'exploitation — part du temps passée au-delà de `fraction` de
 * l'enveloppe atteinte.
 *
 * Rend `null` si l'enveloppe n'est pas mesurable : un taux calculé sur un pic
 * inexistant serait un chiffre sans référent.
 */
export function exploitationRate(
  samples: readonly GgPoint[],
  fraction = 0.9
): ExploitationRate | null {
  const pts = samples.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.long));
  if (pts.length === 0) return null;

  let peak = 0;
  const magnitudes: number[] = new Array(pts.length);
  for (let i = 0; i < pts.length; i++) {
    const m = Math.hypot(pts[i].lat, pts[i].long);
    magnitudes[i] = m;
    if (m > peak) peak = m;
  }
  if (peak <= 0) return null;

  const seuil = peak * fraction;
  let dedans = 0;
  for (const m of magnitudes) if (m >= seuil) dedans++;

  return {
    rate: dedans / pts.length,
    count: pts.length,
    thresholdG: seuil,
    reliability: 'moyenne',
  };
}

/**
 * Recouvrement freinage / appui — la signature du *trail braking*.
 *
 * Le dossier la classe explicitement comme **dérivation inférée par la forme** :
 * une décélération résiduelle maintenue pendant que la courbure augmente. Le
 * boîtier n'a pas de capteur de pression ; on ne mesure pas le geste, on observe
 * sa trace.
 *
 * Rend la fraction des échantillons portant SIMULTANÉMENT un freinage et un
 * appui latéral notables. **Ce n'est pas une note.** L'attribution causale — et
 * le jugement — restent au coach.
 */
export function trailBrakingOverlap(
  samples: readonly GgPoint[],
  seuilFreinage = -0.2,
  seuilLateral = 0.3
): { fraction: number; count: number } | null {
  const pts = samples.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.long));
  if (pts.length === 0) return null;

  let n = 0;
  for (const p of pts) {
    if (p.long <= seuilFreinage && Math.abs(p.lat) >= seuilLateral) n++;
  }
  return { fraction: n / pts.length, count: pts.length };
}
