/**
 * Le cumul de la JOURNÉE — jalon 3, lot 21g. Logique PURE.
 *
 * ===========================================================================
 * CE QUE L'ÉCRAN DE FIN MONTRAIT, ET CE QUE LE PLAN DEMANDE
 * ===========================================================================
 *
 * Le plan pose, pour l'étape 8 : *« incident à état suivi · **journée
 * résumée** · variable avec préséance pilote »*.
 *
 * L'écran affichait « 12 Tours · 34 Minutes » sans dire de quoi. Ce n'était pas
 * faux — c'était le RUN, et `useSessionStore` se remet à zéro à chaque
 * armement. Mais `rec/fin` est atteint **à la fin de chaque run**, pas à la fin
 * de la journée : un pilote qui a fait quatre sorties voyait quatre fois le
 * chiffre de la dernière, et jamais celui de sa journée.
 *
 * Un chiffre sans portée n'est pas un mensonge, c'est une ambiguïté — et sur un
 * écran dont le rôle est de résumer, l'ambiguïté revient au même.
 *
 * ===========================================================================
 * LE MÉCANISME DU JOUR EXISTAIT DÉJÀ, POUR UN SEUL CHIFFRE
 * ===========================================================================
 *
 * `entreRunsLogic` porte `localDayIso` et `dayBestKey` : le meilleur tour du
 * jour est déjà cumulé en MMKV, par date LOCALE. Ce module étend ce mécanisme,
 * il ne le double pas — même notion de jour, même stockage.
 *
 * **La date est locale, jamais UTC.** Le « jour » est celui du pilote : à
 * Valence en juillet, un run de 23 h 30 appartient à la journée qu'il vient de
 * vivre, pas à celle du lendemain que le fuseau lui donnerait.
 *
 * ===========================================================================
 * COMPTER UNE FOIS, ET UNE SEULE
 * ===========================================================================
 *
 * `rec/fin` peut se remonter — retour arrière, reprise d'application, rendu
 * React qui se rejoue. Un cumul naïf compterait le même run deux fois, et le
 * chiffre de la journée gonflerait tout seul.
 *
 * La garde est la même que celle de la célébration du record du jour, et elle
 * est empruntée exprès : une clé par SÉANCE marque que ce run a déjà été
 * compté. C'est le sessionId qui borne, pas un booléen de composant.
 */

import { dayBestKey, localDayIso } from './entreRunsLogic';

/** Ce que la journée a accumulé. Aucun champ n'est optionnel : zéro est zéro. */
export interface CumulJournee {
  /** Nombre de runs bouclés aujourd'hui. */
  runs: number;
  /** Tours cumulés. */
  tours: number;
  /** Minutes de piste cumulées. */
  minutes: number;
}

export const CUMUL_VIDE: CumulJournee = { runs: 0, tours: 0, minutes: 0 };

/** Préfixe MMKV du cumul du jour (clé par date locale YYYY-MM-DD). */
export const DAY_CUMUL_PREFIX = 'day-cumul:';
/** Préfixe MMKV de la garde « ce run est déjà compté » (clé par séance). */
export const DAY_COMPTE_PREFIX = 'day-compte:';

export function dayCumulKey(dateIso: string): string {
  return `${DAY_CUMUL_PREFIX}${dateIso}`;
}

export function dayCompteKey(sessionId: string): string {
  return `${DAY_COMPTE_PREFIX}${sessionId}`;
}

/**
 * Relit un cumul depuis sa forme stockée.
 *
 * DÉFENSIF PAR CONSTRUCTION : le stockage local survit aux mises à jour de
 * l'application, et une forme d'hier n'est pas garantie. Toute valeur qui n'est
 * pas un entier fini et positif retombe à zéro plutôt que de propager un `NaN`
 * jusqu'à l'écran — un « NaN Tours » serait pire que rien.
 */
export function lireCumul(brut: string | null | undefined): CumulJournee {
  if (typeof brut !== 'string' || brut.length === 0) return CUMUL_VIDE;
  try {
    const o = JSON.parse(brut) as Record<string, unknown>;
    const entier = (v: unknown): number => {
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
    };
    return { runs: entier(o.runs), tours: entier(o.tours), minutes: entier(o.minutes) };
  } catch {
    return CUMUL_VIDE;
  }
}

/**
 * Ajoute un run au cumul.
 *
 * Fonction PURE : elle ne lit ni n'écrit le stockage, elle calcule. Les tours
 * ou les minutes absents n'ajoutent rien — jamais un zéro fabriqué, et jamais
 * un run fantôme : `runs` n'augmente que si le run a réellement duré.
 */
export function ajouterRun(
  courant: CumulJournee,
  run: { tours: number | null; dureeMs: number | null }
): CumulJournee {
  const tours =
    typeof run.tours === 'number' && Number.isFinite(run.tours) && run.tours > 0
      ? Math.floor(run.tours)
      : 0;
  const minutes =
    typeof run.dureeMs === 'number' && Number.isFinite(run.dureeMs) && run.dureeMs > 0
      ? Math.round(run.dureeMs / 60_000)
      : 0;

  // Un run sans durée ET sans tour n'est pas un run : ne pas l'incrémenter
  // évite qu'un montage accidentel de l'écran ne gonfle le compteur.
  if (tours === 0 && minutes === 0) return courant;

  return {
    runs: courant.runs + 1,
    tours: courant.tours + tours,
    minutes: courant.minutes + minutes,
  };
}

/**
 * Les faits de la journée, prêts à afficher. Un fait absent est ABSENT.
 *
 * Même règle que `buildFinSummary` pour le run : on ne rend pas « 0 tour »,
 * on ne rend rien. Le premier run d'une journée qui n'a bouclé aucun tour
 * n'affiche donc que ses minutes.
 */
export interface FaitJournee {
  cle: 'runs' | 'tours' | 'minutes';
  label: string;
  valeur: string;
}

export function faitsJournee(c: CumulJournee): FaitJournee[] {
  const faits: FaitJournee[] = [];
  if (c.runs > 0) {
    faits.push({ cle: 'runs', label: c.runs > 1 ? 'Sorties' : 'Sortie', valeur: String(c.runs) });
  }
  if (c.tours > 0) {
    faits.push({ cle: 'tours', label: c.tours > 1 ? 'Tours' : 'Tour', valeur: String(c.tours) });
  }
  if (c.minutes > 0) {
    faits.push({ cle: 'minutes', label: 'Minutes', valeur: String(c.minutes) });
  }
  return faits;
}

/**
 * La journée compte-t-elle plus d'un run ?
 *
 * L'écran s'en sert pour choisir ce qu'il montre : sur la première sortie,
 * cumul et run disent la même chose, et afficher deux fois le même chiffre
 * sous deux titres différents ferait douter des deux.
 */
export function journeeAPlusieursRuns(c: CumulJournee): boolean {
  return c.runs > 1;
}

// Ré-exports de commodité : l'appelant n'a pas à connaître deux modules pour
// une seule notion de « jour ».
export { dayBestKey, localDayIso };
