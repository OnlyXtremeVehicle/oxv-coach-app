/**
 * Cinématique — socle de calcul T1bis, module partagé.
 *
 * Transforme une suite de trames en grandeurs dérivées : distance curviligne,
 * accélérations, courbure. Tous les autres modules de T1bis s'appuient dessus.
 *
 * ---
 *
 * TROIS RÈGLES QUE LE DOSSIER FIXE, ET LEURS MOTIFS
 *
 * 1. `a_lat = v × ω_lacet`, JAMAIS le canal `GForceY`.
 *
 *    Le canal accéléromètre mesure la gravité en plus de l'accélération propre.
 *    Sur un circuit à dévers, ou dès que la voiture roule, il lit une composante
 *    de `g` qui n'a rien à voir avec la tenue de route. La voie gyroscopique est
 *    indépendante de l'orientation : elle ne voit que la rotation réelle.
 *
 * 2. On travaille sur la COURBURE `1/R`, jamais sur le rayon `R`.
 *
 *    `R = v / ω` diverge en ligne droite — ω tend vers zéro, R vers l'infini.
 *    Un graphique de R est illisible et une moyenne de R n'a aucun sens. La
 *    courbure, elle, vaut zéro en ligne droite : c'est une grandeur bornée et
 *    sommable.
 *
 * 3. Toute grandeur porte son ORIGINE — mesurée ou dérivée.
 *
 *    Le dossier l'impose dès le socle de calcul. Une vitesse sort du capteur ;
 *    une accélération est calculée. Le pilote a le droit de savoir laquelle est
 *    un fait et laquelle est une reconstruction.
 *
 * ---
 *
 * L'ABSENCE NE SE FABRIQUE PAS
 *
 * Une dérivée n'existe pas au premier ni au dernier point — il n'y a rien à
 * dériver d'un seul côté. Ces bornes valent `null`, pas zéro. Zéro serait un
 * fait mesuré : « aucune accélération ». Ce n'est pas ce qu'on sait.
 */

/** Provenance d'une grandeur. Le dossier l'exige dès le socle. */
export type Origine = 'mesure' | 'derivation';

/** Une trame réduite à ce que la cinématique consomme. */
export interface Sample {
  /** Horodatage en secondes. Monotone croissant. */
  t: number;
  /** Vitesse en m/s — canal direct, le plus fiable du boîtier. */
  speed: number;
  /** Vitesse de lacet en rad/s (gyroscope, axe Z). */
  yawRate?: number;
}

export interface Kinematics {
  /** Distance curviligne cumulée, en mètres. Clé d'appariement des tours. */
  distance: number[];
  /** Accélération longitudinale en g. `null` aux bornes. */
  aLong: (number | null)[];
  /** Accélération latérale en g. `null` sans vitesse de lacet. */
  aLat: (number | null)[];
  /** Courbure signée en 1/m. `null` sans vitesse de lacet ou à l'arrêt. */
  curvature: (number | null)[];
  /** Origine de chaque famille, pour l'affichage. */
  origines: { speed: Origine; aLong: Origine; aLat: Origine; curvature: Origine };
}

const G = 9.80665;

/**
 * Sous cette vitesse, le cap et la vitesse de lacet ne veulent plus rien dire :
 * le boîtier gèle son cap et le bruit domine. Le dossier note « cap gelé sous
 * 0,1 m/s » ; on prend une marge, la courbure n'ayant aucun sens à l'arrêt.
 */
const VITESSE_MIN_MS = 0.5;

/**
 * Distance curviligne cumulée par intégration de la vitesse.
 *
 * `∫ v dt` plutôt que la somme des distances entre points GPS : la vitesse est
 * le canal le plus fiable du boîtier, la position porte 0,5 m de bruit qui
 * s'accumulerait à chaque pas.
 *
 * Méthode des trapèzes — la vitesse varie continûment entre deux trames.
 */
export function cumulativeDistance(samples: readonly Sample[]): number[] {
  const out: number[] = new Array(samples.length);
  let cumul = 0;
  for (let i = 0; i < samples.length; i++) {
    if (i > 0) {
      const dt = samples[i].t - samples[i - 1].t;
      if (dt > 0) cumul += ((samples[i].speed + samples[i - 1].speed) / 2) * dt;
    }
    out[i] = cumul;
  }
  return out;
}

/**
 * Accélération longitudinale, en g, par différences CENTRÉES.
 *
 * La différence centrée `(v[i+1] − v[i−1]) / (t[i+1] − t[i−1])` est d'ordre deux
 * là où la différence avant est d'ordre un : à 25 Hz, sur un signal bruité, la
 * différence est visible. Elle n'existe pas aux bornes, qui valent donc `null`.
 */
export function longitudinalAcceleration(samples: readonly Sample[]): (number | null)[] {
  const out: (number | null)[] = new Array(samples.length).fill(null);
  for (let i = 1; i < samples.length - 1; i++) {
    const dt = samples[i + 1].t - samples[i - 1].t;
    if (dt <= 0) continue;
    out[i] = (samples[i + 1].speed - samples[i - 1].speed) / dt / G;
  }
  return out;
}

/**
 * Accélération latérale, en g, par `a_lat = v × ω`.
 *
 * Rend `null` quand la vitesse de lacet est absente : on ne se rabat PAS sur
 * `GForceY`, qui serait faux sur dévers. Une absence honnête vaut mieux qu'une
 * valeur biaisée qui se lira comme une mesure.
 */
export function lateralAcceleration(samples: readonly Sample[]): (number | null)[] {
  return samples.map((s) => {
    if (s.yawRate === undefined || !Number.isFinite(s.yawRate)) return null;
    return (s.speed * s.yawRate) / G;
  });
}

/**
 * Courbure signée en 1/m — `1/R = ω / v`.
 *
 * Le signe porte le sens du virage. `null` sous la vitesse plancher : à l'arrêt
 * la courbure n'existe pas, et la division exploserait.
 */
export function curvature(samples: readonly Sample[]): (number | null)[] {
  return samples.map((s) => {
    if (s.yawRate === undefined || !Number.isFinite(s.yawRate)) return null;
    if (s.speed < VITESSE_MIN_MS) return null;
    return s.yawRate / s.speed;
  });
}

/** Assemble les quatre grandeurs en une seule passe lisible. */
export function computeKinematics(samples: readonly Sample[]): Kinematics {
  return {
    distance: cumulativeDistance(samples),
    aLong: longitudinalAcceleration(samples),
    aLat: lateralAcceleration(samples),
    curvature: curvature(samples),
    origines: {
      speed: 'mesure',
      aLong: 'derivation',
      aLat: 'derivation',
      curvature: 'derivation',
    },
  };
}

/**
 * Lissage Savitzky-Golay, fenêtre impaire, ordre 2.
 *
 * Le dossier l'impose AVANT toute dérivation : à 25 Hz la dérivée brute amplifie
 * le bruit au point de rendre le jerk inexploitable. Savitzky-Golay préserve les
 * extrema — un pic de freinage reste un pic — là où une moyenne glissante les
 * arrondit, ce qui effacerait précisément ce qu'on cherche.
 *
 * Les `null` sont traversés sans être inventés : une fenêtre qui n'a pas assez
 * de points valides rend `null`.
 */
export function savitzkyGolay(valeurs: readonly (number | null)[], fenetre = 7): (number | null)[] {
  const f = fenetre % 2 === 0 ? fenetre + 1 : fenetre;
  const demi = Math.floor(f / 2);
  if (f < 3) return [...valeurs];

  return valeurs.map((_, i) => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let k = -demi; k <= demi; k++) {
      const j = i + k;
      if (j < 0 || j >= valeurs.length) continue;
      const v = valeurs[j];
      if (v === null || !Number.isFinite(v)) continue;
      xs.push(k);
      ys.push(v);
    }
    // Un ajustement quadratique demande au moins trois points distincts.
    if (ys.length < 3) return valeurs[i] ?? null;

    // Régression polynomiale d'ordre 2 centrée : par symétrie des xs, les
    // sommes impaires s'annulent quand la fenêtre est complète, mais on résout
    // le cas général pour rester juste sur les bords.
    let s0 = 0,
      s1 = 0,
      s2 = 0,
      s3 = 0,
      s4 = 0;
    let t0 = 0,
      t1 = 0,
      t2 = 0;
    for (let n = 0; n < xs.length; n++) {
      const x = xs[n];
      const y = ys[n];
      const x2 = x * x;
      s0 += 1;
      s1 += x;
      s2 += x2;
      s3 += x2 * x;
      s4 += x2 * x2;
      t0 += y;
      t1 += x * y;
      t2 += x2 * y;
    }
    // Système normal 3×3 résolu par Cramer.
    const det = s0 * (s2 * s4 - s3 * s3) - s1 * (s1 * s4 - s3 * s2) + s2 * (s1 * s3 - s2 * s2);
    if (Math.abs(det) < 1e-12) return valeurs[i] ?? null;
    const a0 =
      (t0 * (s2 * s4 - s3 * s3) - s1 * (t1 * s4 - s3 * t2) + s2 * (t1 * s3 - s2 * t2)) / det;
    return a0;
  });
}
