/**
 * Tendance de séance — module M06. Logique PURE.
 * Sans React, sans react-native, sans Supabase : testable seule (ts-jest, node).
 *
 * ---
 *
 * CE QUE CE MODULE DIT, ET CE QU'IL NE DIT PAS
 *
 * Il DÉCRIT la trajectoire des temps au tour d'une séance : en baisse, stables,
 * en hausse — ou rien, quand il n'y a pas de quoi conclure. Il ne dit JAMAIS
 * pourquoi. Une hausse tardive des temps est rendue telle quelle, « tendance
 * tardive observée » : aucune interprétation physiologique ou mécanique n'est
 * posée sur le pilote. Le constat appartient à l'app, la lecture au pilote.
 *
 * ---
 *
 * POURQUOI PAS UNE MOYENNE, NI UNE DROITE AUX MOINDRES CARRÉS
 *
 * Une séance porte des tours gâchés — trafic, drapeau, sortie large — qui
 * tirent une moyenne ou une régression classique bien au-delà de ce que la
 * séance raconte vraiment. La pente est donc estimée par THEIL–SEN : la
 * médiane des pentes de toutes les paires de tours. Un tour aberrant ne pèse
 * que sur les paires qui le contiennent, jamais sur toute la droite.
 *
 * ---
 *
 * LES TOURS DE CHAUFFE NE SONT PAS UNE PROGRESSION
 *
 * Les premiers tours d'une séance sont presque toujours les plus lents :
 * pneus, freins, repères. Les garder ferait lire « progresse » à toutes les
 * séances du monde, y compris les plates. Sont donc écartés, EN TÊTE de séance
 * seulement, les tours consécutifs nettement au-dessus de la médiane des tours
 * chronométrés (`FACTEUR_CHAUFFE`). Un tour lent AU MILIEU reste retenu :
 * c'est de la séance, pas de la mise en température.
 *
 * Chaque tour écarté l'est avec un motif nommé — l'écran peut dire ce qu'il
 * n'a pas compté, et pourquoi.
 */

/** Estampille du calcul : toute évolution de méthode est un changement tracé. */
export const PROGRESSION_ALGO_VERSION = 'progression-1.0.0';

/** En deçà, aucune tendance n'est prononcée : deux points font une anecdote. */
export const MIN_TOURS_TENDANCE = 4;

/**
 * Un tour de tête de séance au-delà de médiane × ce facteur est de la chauffe.
 * 8 % au-dessus de la médiane, sur un tour de 90 s, c'est plus de 7 s : un
 * écart de mise en température, pas un écart de pilotage.
 */
export const FACTEUR_CHAUFFE = 1.08;

/**
 * Plancher du seuil de stabilité, en millisecondes. Une amplitude estimée plus
 * petite que la dispersion naturelle des tours — ou que ce plancher — est du
 * bruit : la séance « plafonne ». Le seuil effectif est
 * max(SEUIL_PLAFOND_MS, écart absolu médian des temps retenus).
 */
export const SEUIL_PLAFOND_MS = 300;

export type DirectionTendance = 'progresse' | 'plafonne' | 'se degrade' | 'indeterminee';

export type Confiance = 'haute' | 'moyenne' | 'faible';

/** Ce qu'un tour de séance doit porter pour entrer dans le calcul. */
export interface TourSession {
  /** Position du tour dans la séance (1 = premier tour roulé). */
  index: number;
  /** Temps du tour en millisecondes. `null` = non chronométré. */
  tempsMs: number | null;
  /** Tour jugé exploitable par la détection amont. */
  valide: boolean;
  /** Étiquettes éventuelles ('outlap', 'inlap', …). */
  tags?: readonly string[];
}

/** Pourquoi un tour n'entre pas dans la tendance. */
export type MotifEcart = 'non chronometre' | 'invalide' | 'tour de stand' | 'chauffe';

export interface TourEcarte {
  index: number;
  motif: MotifEcart;
}

export interface TendanceSession {
  version: string;
  confiance: Confiance;
  direction: DirectionTendance;
  /**
   * Amplitude estimée sur l'empan des tours retenus, en millisecondes.
   * Négative = temps en baisse. `null` quand la direction est indéterminée —
   * jamais un zéro fabriqué.
   */
  amplitudeMs: number | null;
  /** Pente Theil–Sen, en ms par tour. `null` quand indéterminée. */
  penteMsParTour: number | null;
  /**
   * Constat en clair, factuel. Une hausse concentrée en fin de séance est
   * rendue « Tendance tardive observée. » — le fait, sans la cause.
   */
  libelle: string;
  toursRetenus: number;
  toursEcartes: TourEcarte[];
  /** La hausse, quand hausse il y a, est-elle concentrée en fin de séance ? */
  tardive: boolean;
}

/** Médiane d'une liste non vide. */
function mediane(valeurs: readonly number[]): number {
  const tri = [...valeurs].sort((a, b) => a - b);
  const m = tri.length >> 1;
  return tri.length % 2 === 1 ? tri[m] : (tri[m - 1] + tri[m]) / 2;
}

/** Un tour chronométré, valide, hors stands. */
function chronometre(t: TourSession): { ok: true } | { ok: false; motif: MotifEcart } {
  if (t.tags?.some((tag) => tag === 'outlap' || tag === 'inlap')) {
    return { ok: false, motif: 'tour de stand' };
  }
  if (!t.valide) return { ok: false, motif: 'invalide' };
  if (t.tempsMs === null || !Number.isFinite(t.tempsMs) || t.tempsMs <= 0) {
    return { ok: false, motif: 'non chronometre' };
  }
  return { ok: true };
}

/** Un tour retenu, une fois les filtres passés : temps garanti présent. */
interface TourRetenu {
  index: number;
  tempsMs: number;
}

/**
 * Pente Theil–Sen : médiane des pentes de toutes les paires, en ms par tour.
 * `null` si moins de deux points — une pente d'un point n'existe pas.
 */
function penteTheilSen(tours: readonly TourRetenu[]): number | null {
  const pentes: number[] = [];
  for (let i = 0; i < tours.length; i++) {
    for (let j = i + 1; j < tours.length; j++) {
      const dx = tours[j].index - tours[i].index;
      if (dx <= 0) continue;
      pentes.push((tours[j].tempsMs - tours[i].tempsMs) / dx);
    }
  }
  return pentes.length > 0 ? mediane(pentes) : null;
}

/** Confiance de lecture : elle ne dit que l'effectif, jamais la qualité du pilote. */
function confianceEffectif(retenus: number): Confiance {
  if (retenus >= 8) return 'haute';
  if (retenus >= 5) return 'moyenne';
  return 'faible';
}

const LIBELLES: Record<Exclude<DirectionTendance, 'se degrade'>, string> = {
  progresse: 'Temps en baisse observés sur les tours retenus.',
  plafonne: 'Temps stables observés sur les tours retenus.',
  indeterminee: 'Trop peu de tours retenus pour dégager une tendance.',
};

const LIBELLE_HAUSSE = 'Temps en hausse observés sur les tours retenus.';
const LIBELLE_TARDIF = 'Tendance tardive observée.';

/**
 * Tendance robuste d'une séance.
 *
 * Étapes : filtre des tours non chronométrés / invalides / de stand, écart des
 * tours de chauffe en tête de séance, pente Theil–Sen sur ce qui reste, puis
 * verdict borné par la dispersion — une amplitude sous le bruit « plafonne ».
 */
export function calculeTendanceSession(tours: readonly TourSession[]): TendanceSession {
  const ecartes: TourEcarte[] = [];
  const chronos: TourRetenu[] = [];

  for (const t of tours) {
    const verdict = chronometre(t);
    if (verdict.ok) {
      chronos.push({ index: t.index, tempsMs: t.tempsMs as number });
    } else {
      ecartes.push({ index: t.index, motif: verdict.motif });
    }
  }
  chronos.sort((a, b) => a.index - b.index);

  // Chauffe : en TÊTE de séance seulement, tours consécutifs nettement
  // au-dessus de la médiane des tours chronométrés. Un tour lent au milieu
  // reste retenu — c'est de la séance.
  let retenus = chronos;
  if (chronos.length > 0) {
    const seuil = mediane(chronos.map((t) => t.tempsMs)) * FACTEUR_CHAUFFE;
    let debut = 0;
    while (debut < chronos.length && chronos[debut].tempsMs > seuil) {
      ecartes.push({ index: chronos[debut].index, motif: 'chauffe' });
      debut++;
    }
    retenus = chronos.slice(debut);
  }

  const indetermine: Omit<TendanceSession, 'confiance' | 'toursRetenus' | 'toursEcartes'> = {
    version: PROGRESSION_ALGO_VERSION,
    direction: 'indeterminee',
    amplitudeMs: null,
    penteMsParTour: null,
    libelle: LIBELLES.indeterminee,
    tardive: false,
  };

  if (retenus.length < MIN_TOURS_TENDANCE) {
    return {
      ...indetermine,
      confiance: 'faible',
      toursRetenus: retenus.length,
      toursEcartes: ecartes,
    };
  }

  const pente = penteTheilSen(retenus);
  const empan = retenus[retenus.length - 1].index - retenus[0].index;
  if (pente === null || empan <= 0) {
    return {
      ...indetermine,
      confiance: 'faible',
      toursRetenus: retenus.length,
      toursEcartes: ecartes,
    };
  }

  const amplitudeMs = pente * empan;

  // Seuil de stabilité : la plus grande des deux bornes — plancher fixe, ou
  // dispersion robuste des temps retenus (écart absolu médian).
  const temps = retenus.map((t) => t.tempsMs);
  const med = mediane(temps);
  const eam = mediane(temps.map((v) => Math.abs(v - med)));
  const seuilAmplitude = Math.max(SEUIL_PLAFOND_MS, eam);

  let direction: DirectionTendance;
  if (Math.abs(amplitudeMs) < seuilAmplitude) {
    direction = 'plafonne';
  } else {
    direction = amplitudeMs < 0 ? 'progresse' : 'se degrade';
  }

  // Hausse TARDIVE : la première moitié des tours retenus est stable
  // (son amplitude propre reste sous le seuil) alors que l'ensemble monte.
  // Le module rend le fait — jamais une cause.
  let tardive = false;
  if (direction === 'se degrade') {
    const moitie = retenus.slice(0, Math.ceil(retenus.length / 2));
    const pente1 = penteTheilSen(moitie);
    const empan1 = moitie[moitie.length - 1].index - moitie[0].index;
    tardive = pente1 !== null && Math.abs(pente1 * empan1) < seuilAmplitude;
  }

  const libelle =
    direction === 'se degrade' ? (tardive ? LIBELLE_TARDIF : LIBELLE_HAUSSE) : LIBELLES[direction];

  return {
    version: PROGRESSION_ALGO_VERSION,
    confiance: confianceEffectif(retenus.length),
    direction,
    amplitudeMs,
    penteMsParTour: pente,
    libelle,
    toursRetenus: retenus.length,
    toursEcartes: ecartes,
    tardive,
  };
}
