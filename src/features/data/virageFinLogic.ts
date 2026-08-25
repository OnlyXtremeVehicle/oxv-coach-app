/**
 * FIN DE VIRAGE — M14 chevauchement décélération/rotation, M15 rotation.
 * Logique PURE : aucun import React, aucun accès réseau.
 *
 * ===========================================================================
 * CE QUE CES DEUX LECTURES DISENT — ET CE QU'ELLES NE DISENT PAS
 * ===========================================================================
 *
 * M14 lit le CHEVAUCHEMENT entre la décélération et la montée de l'appui
 * latéral pendant un passage de virage : y a-t-il une fenêtre où les deux
 * coexistent, avec quelle pente le relâché s'opère, et à quel instant la
 * bascule se fait. Tout est estimé depuis les accélérations mesurées — le
 * module ne sait rien des commandes du pilote et ne prétend jamais les
 * connaître. Le libellé imposé est « chevauchement décélération/rotation
 * estimé », et rien d'autre.
 *
 * M15 lit la ROTATION depuis la vitesse de lacet (gyroscope, axe Z) : début,
 * pic, oscillations, stabilisation. La classification s'en tient à des FAITS
 * observables — un geste, ou des corrections — jamais à un diagnostic de
 * comportement du châssis, que ces canaux seuls ne permettent pas d'établir.
 *
 * ===========================================================================
 * TROIS RÈGLES D'HONNÊTETÉ, HÉRITÉES DE LA BANQUE
 * ===========================================================================
 *
 * 1. **Une valeur non mesurable est `null`, jamais un zéro fabriqué.** Une
 *    pente de relâché sur deux points n'existe pas ; elle est absente.
 *
 * 2. **L'absence se compte.** Les échantillons écartés faute de canal sont
 *    chiffrés (`echantillonsIgnores`), pas jetés en silence.
 *
 * 3. **Quand le signal ne suffit pas, la sortie propose des lectures
 *    possibles** (`alternatives`) plutôt qu'un verdict. Trancher sur du bruit
 *    serait plus net et faux.
 *
 * Conventions de signe, propres à ce module et nommées : `gLong` négatif vaut
 * décélération (même sens que `kinematics.aLong`, dv/dt) ; `gLat` est signé,
 * seul son module compte ici ; `lacetDegParS` est la vitesse de lacet en
 * degrés par seconde, signée.
 */

// ===========================================================================
// Entrées
// ===========================================================================

/** Un échantillon d'un passage de virage, pour la lecture M14. */
export interface EchantillonVirage {
  /** Temps depuis le début du passage, en ms. */
  tMs: number;
  /** Accélération longitudinale, en g. Négatif = décélération. `null` si non mesurée. */
  gLong: number | null;
  /** Accélération latérale, en g, signée. `null` si non mesurée. */
  gLat: number | null;
  /** Vitesse, en m/s. `null` si non mesurée. */
  vitesse: number | null;
}

/** Un échantillon pour la lecture M15. */
export interface EchantillonRotation {
  /** Temps depuis le début du passage, en ms. */
  tMs: number;
  /** Vitesse de lacet (gyroscope, axe Z), en degrés/s, signée. `null` si non mesurée. */
  lacetDegParS: number | null;
  /** Accélération latérale, en g, signée. `null` si non mesurée. */
  gLat: number | null;
}

export type Confiance = 'haute' | 'moyenne' | 'faible';

// ===========================================================================
// Conventions (des seuils nommés — des choix, pas des hypothèses sur le monde)
// ===========================================================================

/** Décélération retenue sous ce seuil, en g. Même famille que `braking.zones`. */
export const SEUIL_DECELERATION_G = -0.15;

/** Appui latéral considéré présent au-delà de ce module, en g. */
export const SEUIL_LATERAL_G = 0.1;

/** Une décélération plus courte que ceci n'est pas « soutenue ». */
export const DUREE_DECELERATION_MIN_MS = 300;

/** Fenêtre de mesure de la pente du relâché, en fin de décélération. */
export const FENETRE_RELACHE_MS = 400;

/** Rotation considérée engagée au-delà de ce seuil, en degrés/s. */
export const SEUIL_ROTATION_DEG_S = 4;

/** Une dérivée de lacet compte comme significative au-delà, en degrés/s². */
export const SEUIL_OSCILLATION_DEG_S2 = 30;

/** Durée de calme requise pour déclarer la rotation stabilisée. */
export const FENETRE_STABILISATION_MS = 300;

/** En dessous de ce nombre d'échantillons exploitables, on ne lit rien. */
export const MIN_ECHANTILLONS = 8;

// ===========================================================================
// Outils internes
// ===========================================================================

function estNombre(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Pente aux moindres carrés de `y` en fonction de `t` (t en ms, pente rendue
 * par SECONDE). `null` sous trois points, ou si tous les instants coïncident :
 * une pente sur moins de trois points n'est pas une mesure, c'est un trait.
 */
function penteParSeconde(points: readonly { tMs: number; y: number }[]): number | null {
  if (points.length < 3) return null;
  const n = points.length;
  let sT = 0;
  let sY = 0;
  for (const p of points) {
    sT += p.tMs;
    sY += p.y;
  }
  const mT = sT / n;
  const mY = sY / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.tMs - mT) * (p.y - mY);
    den += (p.tMs - mT) * (p.tMs - mT);
  }
  if (den === 0) return null;
  return (num / den) * 1000;
}

/** Trié par temps, sans jamais muter l'entrée. */
function parTemps<T extends { tMs: number }>(serie: readonly T[]): T[] {
  return [...serie].filter((e) => estNombre(e.tMs)).sort((a, b) => a.tMs - b.tMs);
}

// ===========================================================================
// M14 — chevauchement décélération/rotation estimé
// ===========================================================================

/** Libellé imposé par le cahier. C'est LE nom de cette lecture, partout. */
export const LIBELLE_CHEVAUCHEMENT = 'chevauchement décélération/rotation estimé';

export const VERSION_CHEVAUCHEMENT = 'virage-fin.m14.v1';

export interface ResultatChevauchement {
  version: string;
  confiance: Confiance;
  /** Toujours `LIBELLE_CHEVAUCHEMENT` — le nom de la lecture est verrouillé. */
  libelle: string;
  /**
   * Fenêtre où décélération soutenue ET montée de l'appui latéral coexistent.
   * `null` quand aucun chevauchement n'est observé — c'est un constat, pas
   * une erreur.
   */
  fenetre: { debutMs: number; finMs: number } | null;
  /** Durée du chevauchement, en ms. `null` sans fenêtre. */
  dureeMs: number | null;
  /**
   * Pente du relâché — d(gLong)/dt en fin de décélération, en g/s. Positive
   * quand la décélération se relâche. `null` si non mesurable.
   */
  penteRelacheGParS: number | null;
  /**
   * Instant estimé de bascule : premier moment où l'appui latéral dépasse la
   * décélération en module. `null` si jamais observé.
   */
  basculeMs: number | null;
  /** Échantillons écartés faute de canal exploitable — comptés, pas tus. */
  echantillonsIgnores: number;
  /** Constats factuels, en français. Jamais une consigne. */
  observations: string[];
}

function resultatChevauchementVide(
  ignores: number,
  observation: string
): ResultatChevauchement {
  return {
    version: VERSION_CHEVAUCHEMENT,
    confiance: 'faible',
    libelle: LIBELLE_CHEVAUCHEMENT,
    fenetre: null,
    dureeMs: null,
    penteRelacheGParS: null,
    basculeMs: null,
    echantillonsIgnores: ignores,
    observations: [observation],
  };
}

/**
 * Lit le chevauchement décélération/rotation estimé d'UN passage de virage.
 *
 * Étapes, toutes sur des grandeurs dérivées des accélérations mesurées :
 *
 * 1. La plus longue plage de décélération soutenue (gLong sous
 *    `SEUIL_DECELERATION_G` pendant au moins `DUREE_DECELERATION_MIN_MS`).
 * 2. Dans cette plage, la fenêtre où l'appui latéral est présent ET croissant
 *    (pente de |gLat| positive sur la fenêtre) — c'est le chevauchement.
 * 3. La pente du relâché : d(gLong)/dt sur les derniers `FENETRE_RELACHE_MS`
 *    de la décélération.
 * 4. La bascule : premier instant où |gLat| dépasse |gLong|.
 *
 * L'absence de chevauchement est rendue telle quelle (`fenetre: null`) avec
 * une observation : décélération et rotation peuvent aussi se succéder, et le
 * dire est une lecture, pas un échec.
 */
export function lireChevauchement(
  serie: readonly EchantillonVirage[]
): ResultatChevauchement {
  const tries = parTemps(serie);
  const exploitables = tries.filter((e) => estNombre(e.gLong));
  const ignores = tries.length - exploitables.length + (serie.length - tries.length);

  if (exploitables.length < MIN_ECHANTILLONS) {
    return resultatChevauchementVide(
      ignores,
      'Trop peu d’échantillons longitudinaux exploitables pour lire ce passage.'
    );
  }

  // -- 1. La plus longue décélération soutenue ------------------------------
  type Sample = { tMs: number; gLong: number; gLat: number | null };
  const canal: Sample[] = exploitables.map((e) => ({
    tMs: e.tMs,
    gLong: e.gLong as number,
    gLat: estNombre(e.gLat) ? e.gLat : null,
  }));

  let meilleure: Sample[] = [];
  let courante: Sample[] = [];
  for (const s of canal) {
    if (s.gLong <= SEUIL_DECELERATION_G) {
      courante.push(s);
    } else {
      if (dureeDe(courante) > dureeDe(meilleure)) meilleure = courante;
      courante = [];
    }
  }
  if (dureeDe(courante) > dureeDe(meilleure)) meilleure = courante;

  if (meilleure.length === 0 || dureeDe(meilleure) < DUREE_DECELERATION_MIN_MS) {
    return resultatChevauchementVide(
      ignores,
      'Aucune décélération soutenue observée sur ce passage — rien à chevaucher.'
    );
  }

  const observations: string[] = [];
  const finDecelMs = meilleure[meilleure.length - 1].tMs;

  // -- 2. La fenêtre de chevauchement ---------------------------------------
  const lateralConnu = meilleure.some((s) => s.gLat !== null);
  let fenetre: { debutMs: number; finMs: number } | null = null;

  if (!lateralConnu) {
    observations.push(
      'Le canal latéral est absent sur la décélération : le chevauchement n’est pas lisible.'
    );
  } else {
    // Dernière plage contiguë de la décélération où l'appui latéral est présent.
    let plage: Sample[] = [];
    let candidate: Sample[] = [];
    for (const s of meilleure) {
      if (s.gLat !== null && Math.abs(s.gLat) >= SEUIL_LATERAL_G) {
        candidate.push(s);
      } else {
        if (candidate.length > 0) plage = candidate;
        candidate = [];
      }
    }
    if (candidate.length > 0) plage = candidate;

    if (plage.length >= 3) {
      const penteLat = penteParSeconde(
        plage.map((s) => ({ tMs: s.tMs, y: Math.abs(s.gLat as number) }))
      );
      if (penteLat !== null && penteLat > 0) {
        fenetre = { debutMs: plage[0].tMs, finMs: plage[plage.length - 1].tMs };
      } else {
        observations.push(
          'L’appui latéral coexiste avec la décélération sans croître : lu comme un plateau, pas comme un chevauchement.'
        );
      }
    } else {
      observations.push(
        'Décélération et appui latéral se succèdent plutôt qu’ils ne se recouvrent sur ce passage.'
      );
    }
  }

  // -- 3. La pente du relâché -----------------------------------------------
  const queue = meilleure.filter((s) => s.tMs >= finDecelMs - FENETRE_RELACHE_MS);
  const penteRelacheGParS = penteParSeconde(queue.map((s) => ({ tMs: s.tMs, y: s.gLong })));
  if (penteRelacheGParS === null) {
    observations.push('La fin de décélération est trop courte pour estimer la pente du relâché.');
  }

  // -- 4. La bascule ----------------------------------------------------------
  let basculeMs: number | null = null;
  for (const s of meilleure) {
    if (s.gLat !== null && Math.abs(s.gLat) > Math.abs(s.gLong)) {
      basculeMs = s.tMs;
      break;
    }
  }

  // -- Confiance : la qualité de la mesure, pas le contenu du constat --------
  const partIgnoree = ignores / Math.max(1, ignores + exploitables.length);
  const confiance: Confiance =
    meilleure.length >= 10 && partIgnoree < 0.1 ? 'haute' : 'moyenne';

  if (fenetre !== null && observations.length === 0) {
    observations.push('Décélération et montée de l’appui latéral coexistent sur cette fenêtre.');
  }

  return {
    version: VERSION_CHEVAUCHEMENT,
    confiance,
    libelle: LIBELLE_CHEVAUCHEMENT,
    fenetre,
    dureeMs: fenetre === null ? null : fenetre.finMs - fenetre.debutMs,
    penteRelacheGParS,
    basculeMs,
    echantillonsIgnores: ignores,
    observations,
  };
}

function dureeDe(plage: readonly { tMs: number }[]): number {
  if (plage.length < 2) return 0;
  return plage[plage.length - 1].tMs - plage[0].tMs;
}

// ===========================================================================
// M15 — rotation : début, pic, oscillations, stabilisation
// ===========================================================================

export const VERSION_ROTATION = 'virage-fin.m15.v1';

/**
 * Trois lectures, toutes factuelles. Aucun diagnostic de châssis : la vitesse
 * de lacet seule dit qu'il y a eu des alternances, pas pourquoi.
 */
export type LectureRotation =
  | 'rotation en un geste'
  | 'corrections multiples observées'
  | 'signal insuffisant';

export interface ResultatRotation {
  version: string;
  confiance: Confiance;
  lecture: LectureRotation;
  /** Premier instant où la rotation est engagée. `null` si jamais. */
  debutMs: number | null;
  /** Instant du pic de vitesse de lacet (en module). */
  picMs: number | null;
  /** Valeur du pic, en degrés/s, signée. */
  picDegParS: number | null;
  /**
   * Alternances de signe de la dérivée du lacet au-delà de
   * `SEUIL_OSCILLATION_DEG_S2`. `null` quand le signal ne suffit pas.
   */
  oscillations: number | null;
  /** Premier instant après le pic où la rotation reste calme. `null` si jamais. */
  stabilisationMs: number | null;
  /**
   * Quand `lecture` vaut `'signal insuffisant'` : les lectures qui restent
   * possibles, énoncées plutôt que tranchées. Vide sinon.
   */
  alternatives: string[];
  /** Échantillons écartés faute de canal exploitable. */
  echantillonsIgnores: number;
  observations: string[];
}

const ALTERNATIVES_SIGNAL_INSUFFISANT: readonly string[] = [
  'Une rotation en un geste reste possible — le signal ne permet pas de l’établir.',
  'Des corrections multiples restent possibles — le signal ne permet pas de les compter.',
];

function resultatRotationInsuffisant(ignores: number, observation: string): ResultatRotation {
  return {
    version: VERSION_ROTATION,
    confiance: 'faible',
    lecture: 'signal insuffisant',
    debutMs: null,
    picMs: null,
    picDegParS: null,
    oscillations: null,
    stabilisationMs: null,
    alternatives: [...ALTERNATIVES_SIGNAL_INSUFFISANT],
    echantillonsIgnores: ignores,
    observations: [observation],
  };
}

/**
 * Lit la rotation d'UN passage de virage depuis la vitesse de lacet.
 *
 * 1. Début : premier échantillon où |lacet| atteint `SEUIL_ROTATION_DEG_S`.
 * 2. Pic : maximum de |lacet| ensuite.
 * 3. Oscillations : alternances de signe de la dérivée du lacet, quand les
 *    deux segments dépassent `SEUIL_OSCILLATION_DEG_S2` en module. Une montée
 *    puis une descente font UNE alternance — c'est la forme d'un geste ; au
 *    moins deux de plus disent des reprises.
 * 4. Stabilisation : premier instant après le pic où la dérivée reste sous le
 *    seuil pendant `FENETRE_STABILISATION_MS`.
 *
 * La classification s'en tient aux faits : `'rotation en un geste'` quand une
 * seule alternance suffit à décrire la courbe, `'corrections multiples
 * observées'` quand elles se comptent, `'signal insuffisant'` sinon — avec
 * `alternatives` rempli plutôt qu'un verdict forcé.
 */
export function lireRotation(serie: readonly EchantillonRotation[]): ResultatRotation {
  const tries = parTemps(serie);
  const exploitables = tries.filter((e) => estNombre(e.lacetDegParS));
  const ignores = tries.length - exploitables.length + (serie.length - tries.length);

  if (exploitables.length < MIN_ECHANTILLONS) {
    return resultatRotationInsuffisant(
      ignores,
      'Trop peu d’échantillons de lacet exploitables pour lire la rotation.'
    );
  }

  type Sample = { tMs: number; lacet: number };
  const canal: Sample[] = exploitables.map((e) => ({
    tMs: e.tMs,
    lacet: e.lacetDegParS as number,
  }));

  // -- 1. Début ---------------------------------------------------------------
  const iDebut = canal.findIndex((s) => Math.abs(s.lacet) >= SEUIL_ROTATION_DEG_S);
  if (iDebut < 0) {
    return resultatRotationInsuffisant(
      ignores,
      'La vitesse de lacet reste sous le seuil de rotation sur tout le passage.'
    );
  }
  const debutMs = canal[iDebut].tMs;

  // -- 2. Pic -----------------------------------------------------------------
  let iPic = iDebut;
  for (let i = iDebut; i < canal.length; i++) {
    if (Math.abs(canal[i].lacet) > Math.abs(canal[iPic].lacet)) iPic = i;
  }
  const picMs = canal[iPic].tMs;
  const picDegParS = canal[iPic].lacet;

  // -- 3. Oscillations --------------------------------------------------------
  // Dérivée entre échantillons voisins, en degrés/s². Les paires d'instants
  // confondus sont écartées : une dérivée sur dt nul n'existe pas.
  const derivees: { tMs: number; d: number }[] = [];
  for (let i = iDebut; i < canal.length - 1; i++) {
    const dt = canal[i + 1].tMs - canal[i].tMs;
    if (dt <= 0) continue;
    derivees.push({ tMs: canal[i + 1].tMs, d: ((canal[i + 1].lacet - canal[i].lacet) / dt) * 1000 });
  }

  let oscillations = 0;
  let dernierSigne = 0;
  for (const { d } of derivees) {
    if (Math.abs(d) < SEUIL_OSCILLATION_DEG_S2) continue;
    const signe = d > 0 ? 1 : -1;
    if (dernierSigne !== 0 && signe !== dernierSigne) oscillations++;
    dernierSigne = signe;
  }

  // -- 4. Stabilisation -------------------------------------------------------
  let stabilisationMs: number | null = null;
  for (let i = 0; i < derivees.length; i++) {
    if (derivees[i].tMs <= picMs) continue;
    const debutFenetre = derivees[i].tMs;
    let calme = true;
    let couvert = 0;
    for (let j = i; j < derivees.length; j++) {
      if (Math.abs(derivees[j].d) >= SEUIL_OSCILLATION_DEG_S2) {
        calme = false;
        break;
      }
      couvert = derivees[j].tMs - debutFenetre;
      if (couvert >= FENETRE_STABILISATION_MS) break;
    }
    if (calme && couvert >= FENETRE_STABILISATION_MS) {
      stabilisationMs = debutFenetre;
      break;
    }
  }

  // -- Lecture et confiance ---------------------------------------------------
  const lecture: LectureRotation =
    oscillations >= 2 ? 'corrections multiples observées' : 'rotation en un geste';

  const partIgnoree = ignores / Math.max(1, ignores + exploitables.length);
  const confiance: Confiance =
    stabilisationMs !== null && partIgnoree < 0.1 && canal.length >= 12 ? 'haute' : 'moyenne';

  const observations: string[] = [];
  if (lecture === 'rotation en un geste') {
    observations.push('La vitesse de lacet monte, passe son pic et redescend sans reprise comptée.');
  } else {
    observations.push(
      `${oscillations} alternances de la dérivée de lacet observées au-delà du seuil.`
    );
  }
  if (stabilisationMs === null) {
    observations.push('Aucune fenêtre de calme observée après le pic — la rotation ne se stabilise pas dans ce passage.');
  }

  return {
    version: VERSION_ROTATION,
    confiance,
    lecture,
    debutMs,
    picMs,
    picDegParS,
    oscillations,
    stabilisationMs,
    alternatives: [],
    echantillonsIgnores: ignores,
    observations,
  };
}
