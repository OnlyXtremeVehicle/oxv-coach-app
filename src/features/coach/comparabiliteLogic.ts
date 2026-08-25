/**
 * COMPARABILITÉ DE DEUX SÉANCES — le score, pur (M09, côté coach).
 *
 * Module sans I/O. Deux jeux de métadonnées entrent, un score 0..100 sort, avec
 * un verdict et les raisons en clair. Il répond à la question que tout écran de
 * comparaison doit poser AVANT d'afficher un delta : ces deux séances
 * parlent-elles seulement de la même chose ?
 *
 * ---
 *
 * DEUX RÉGIMES, PAS UN SEUL
 *
 * Certaines différences se PONDÈRENT : quelques semaines d'écart, une météo
 * différente, une lecture de moindre qualité — la comparaison reste possible,
 * elle vaut juste moins. D'autres différences INTERDISENT : deux circuits
 * différents n'ont ni les mêmes virages ni les mêmes distances, et aucun cumul
 * de points ne rachète cela. Les incompatibilités dures rendent donc
 * `'non comparable'` quel que soit le reste du score.
 *
 * ---
 *
 * L'INCONNU N'EST PAS L'IDENTIQUE
 *
 * Un véhicule non renseigné n'est pas « le même véhicule » : c'est une
 * information absente. Elle coûte des points ET une raison, et elle abaisse la
 * `confiance` du score — le chiffre est calculé, mais sur des métadonnées
 * trouées. Jamais de zéro fabriqué : ce qui n'est pas su est `null` en entrée,
 * et devient une réserve en sortie, pas une valeur.
 */

import type { ConfidenceLevel } from '@/services/dataConfidenceLogic';

/** Version du score — à faire évoluer si les pondérations changent. */
export const VERSION_COMPARABILITE = 'comparabilite-v1';

// ---------------------------------------------------------------------------
// Pondérations. TOUTES « à valider » par le fondateur : elles ordonnent les cas
// de façon plausible, aucune séance réelle ne les a encore confrontées.
// ---------------------------------------------------------------------------

/** Circuit non renseigné d'un côté : rien ne prouve le même tracé. */
export const PENALITE_CIRCUIT_INCONNU = 25;
/** Autre véhicule : la comparaison change d'objet, sans devenir absurde. */
export const PENALITE_VEHICULE_DIFFERENT = 40;
/** Véhicule non renseigné d'un côté ou de l'autre. */
export const PENALITE_VEHICULE_INCONNU = 15;
/** Écart de date au-delà duquel la saison a probablement changé. */
export const ECART_DATE_LONG_JOURS = 180;
export const PENALITE_DATE_LONGUE = 20;
/** Écart de date au-delà duquel la piste et le pilote ont pu évoluer. */
export const ECART_DATE_MOYEN_JOURS = 30;
export const PENALITE_DATE_MOYENNE = 10;
/** Dates non renseignées : l'écart est inconnaissable. */
export const PENALITE_DATE_INCONNUE = 10;
/** Pluie d'un côté, sec de l'autre : l'adhérence n'est plus la même donnée. */
export const PENALITE_PLUIE_DIFFERENTE = 25;
/** Écart de température au-delà duquel la gomme travaille autrement. */
export const ECART_TEMPERATURE_C = 10;
export const PENALITE_TEMPERATURE = 10;
/** Météo non renseignée d'un côté ou de l'autre. */
export const PENALITE_METEO_INCONNUE = 5;
/** Une des lectures est 'limited' au sens du Data Confidence Score. */
export const PENALITE_LECTURE_REDUITE = 20;
/** Une des lectures est 'partial'. */
export const PENALITE_LECTURE_PARTIELLE = 10;
/** Qualité de mesure non renseignée. */
export const PENALITE_QUALITE_INCONNUE = 5;

/** Score minimal du verdict 'comparable'. — À VALIDER. */
export const SEUIL_COMPARABLE = 80;
/** Score minimal du verdict 'comparable avec réserves'. — À VALIDER. */
export const SEUIL_AVEC_RESERVES = 50;

/** Conditions météo telles que le service météo les résume. */
export interface MeteoSeance {
  /** Pluie observée pendant la séance. `null` = non su. */
  pluie: boolean | null;
  /** Température de l'air en °C. `null` = non mesurée. */
  temperatureC: number | null;
}

/**
 * Ce que le score consomme d'une séance ou d'une référence. Volontairement
 * étroit : ce module ne doit rien savoir des services ni des lignes Supabase.
 * `null` partout où l'information n'existe pas — jamais une valeur inventée.
 */
export interface MetadonneesSeance {
  /** Identifiant du circuit. `null` = non renseigné. */
  circuitId: string | null;
  /** Identifiant du véhicule. `null` = non renseigné. */
  vehiculeId: string | null;
  /** Date de la séance, ISO. `null` = non datée. */
  dateIso: string | null;
  /** Conditions météo, si le service les a. */
  meteo: MeteoSeance | null;
  /** Niveau du Data Confidence Score de la séance, si calculé. */
  qualiteMesure: ConfidenceLevel | null;
}

export type VerdictComparabilite = 'comparable' | 'comparable avec réserves' | 'non comparable';

export interface Comparabilite {
  version: string;
  confiance: 'haute' | 'moyenne' | 'faible';
  /** Score dérivé des métadonnées, 0..100. */
  score: number;
  verdict: VerdictComparabilite;
  /** Ce qui a pesé sur le score, en clair. Vide quand rien n'a pesé. */
  raisons: string[];
}

/** Une chaîne d'identifiant exploitable : non vide une fois taillée. */
function idConnu(v: string | null): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Écart en jours entre deux dates ISO, ou `null` si l'une est illisible. */
function ecartJours(aIso: string | null, bIso: string | null): number | null {
  if (typeof aIso !== 'string' || typeof bIso !== 'string') return null;
  const a = Date.parse(aIso);
  const b = Date.parse(bIso);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.abs(a - b) / 86_400_000;
}

/** Métadonnées inertes, pour tolérer un appelant qui passe n'importe quoi. */
const VIDE: MetadonneesSeance = {
  circuitId: null,
  vehiculeId: null,
  dateIso: null,
  meteo: null,
  qualiteMesure: null,
};

/**
 * Score de comparabilité entre deux séances (ou une séance et une référence).
 *
 * Les incompatibilités dures — circuits différents et CONNUS — rendent
 * `'non comparable'` d'emblée, score 0 : aucun cumul de points ne rachète deux
 * tracés différents. Tout le reste se pondère, et chaque retenue laisse une
 * raison lisible.
 */
export function litComparabilite(
  gauche: MetadonneesSeance | null | undefined,
  droite: MetadonneesSeance | null | undefined
): Comparabilite {
  const a = gauche && typeof gauche === 'object' ? gauche : VIDE;
  const b = droite && typeof droite === 'object' ? droite : VIDE;

  // ---- Incompatibilité dure : deux circuits connus et différents ----------
  if (idConnu(a.circuitId) && idConnu(b.circuitId) && a.circuitId.trim() !== b.circuitId.trim()) {
    return {
      version: VERSION_COMPARABILITE,
      confiance: 'haute',
      score: 0,
      verdict: 'non comparable',
      raisons: ['Circuits différents : ni les mêmes virages, ni les mêmes distances.'],
    };
  }

  const raisons: string[] = [];
  let score = 100;
  let inconnues = 0;

  // ---- Circuit inconnu : pas un blocage, mais rien ne prouve le même tracé
  if (!idConnu(a.circuitId) || !idConnu(b.circuitId)) {
    score -= PENALITE_CIRCUIT_INCONNU;
    inconnues += 1;
    raisons.push('Circuit non renseigné sur une des séances : même tracé non garanti.');
  }

  // ---- Véhicule -----------------------------------------------------------
  if (idConnu(a.vehiculeId) && idConnu(b.vehiculeId)) {
    if (a.vehiculeId.trim() !== b.vehiculeId.trim()) {
      score -= PENALITE_VEHICULE_DIFFERENT;
      raisons.push('Véhicules différents : la comparaison décrit deux machines, pas un pilote.');
    }
  } else {
    score -= PENALITE_VEHICULE_INCONNU;
    inconnues += 1;
    raisons.push('Véhicule non renseigné sur une des séances.');
  }

  // ---- Écart de date ------------------------------------------------------
  const jours = ecartJours(a.dateIso, b.dateIso);
  if (jours === null) {
    score -= PENALITE_DATE_INCONNUE;
    inconnues += 1;
    raisons.push('Écart de date inconnaissable : une des séances n’est pas datée.');
  } else if (jours > ECART_DATE_LONG_JOURS) {
    score -= PENALITE_DATE_LONGUE;
    raisons.push(`Plus de ${ECART_DATE_LONG_JOURS} jours d’écart : saison et pilote ont évolué.`);
  } else if (jours > ECART_DATE_MOYEN_JOURS) {
    score -= PENALITE_DATE_MOYENNE;
    raisons.push(`Plus de ${ECART_DATE_MOYEN_JOURS} jours d’écart entre les séances.`);
  }

  // ---- Météo --------------------------------------------------------------
  const ma = a.meteo;
  const mb = b.meteo;
  if (ma === null || mb === null) {
    score -= PENALITE_METEO_INCONNUE;
    inconnues += 1;
    raisons.push('Conditions météo non renseignées sur une des séances.');
  } else {
    if (typeof ma.pluie === 'boolean' && typeof mb.pluie === 'boolean') {
      if (ma.pluie !== mb.pluie) {
        score -= PENALITE_PLUIE_DIFFERENTE;
        raisons.push('Pluie sur une séance, piste sèche sur l’autre : adhérences différentes.');
      }
    } else {
      score -= PENALITE_METEO_INCONNUE;
      inconnues += 1;
      raisons.push('Présence de pluie non renseignée sur une des séances.');
    }
    if (
      typeof ma.temperatureC === 'number' &&
      Number.isFinite(ma.temperatureC) &&
      typeof mb.temperatureC === 'number' &&
      Number.isFinite(mb.temperatureC) &&
      Math.abs(ma.temperatureC - mb.temperatureC) > ECART_TEMPERATURE_C
    ) {
      score -= PENALITE_TEMPERATURE;
      raisons.push(`Plus de ${ECART_TEMPERATURE_C} °C d’écart : la gomme travaille autrement.`);
    }
  }

  // ---- Qualité de mesure --------------------------------------------------
  const qualites = [a.qualiteMesure, b.qualiteMesure];
  if (qualites.some((q) => q === null)) {
    score -= PENALITE_QUALITE_INCONNUE;
    inconnues += 1;
    raisons.push('Qualité de mesure non renseignée sur une des séances.');
  }
  if (qualites.some((q) => q === 'limited')) {
    score -= PENALITE_LECTURE_REDUITE;
    raisons.push('Une des lectures est réduite au sens du niveau de confiance des trames.');
  } else if (qualites.some((q) => q === 'partial')) {
    score -= PENALITE_LECTURE_PARTIELLE;
    raisons.push('Une des lectures est partielle au sens du niveau de confiance des trames.');
  }

  score = Math.max(0, Math.min(100, score));

  const verdict: VerdictComparabilite =
    score >= SEUIL_COMPARABLE
      ? 'comparable'
      : score >= SEUIL_AVEC_RESERVES
        ? 'comparable avec réserves'
        : 'non comparable';

  // La confiance dit la SOLIDITÉ du score, pas sa valeur : un 100 calculé sur
  // des métadonnées complètes est sûr ; un 85 troué d'inconnues l'est moins.
  const confiance: Comparabilite['confiance'] =
    inconnues === 0 ? 'haute' : inconnues <= 2 ? 'moyenne' : 'faible';

  return { version: VERSION_COMPARABILITE, confiance, score, verdict, raisons };
}

/** Ce que l'écran dit du verdict. Descriptif, jamais une consigne. */
export function libelleVerdict(verdict: VerdictComparabilite): string {
  switch (verdict) {
    case 'comparable':
      return 'Ces deux séances se lisent l’une contre l’autre.';
    case 'comparable avec réserves':
      return 'La comparaison se lit, en gardant ses réserves en tête.';
    case 'non comparable':
      return 'Ces deux séances ne parlent pas de la même chose.';
  }
}
