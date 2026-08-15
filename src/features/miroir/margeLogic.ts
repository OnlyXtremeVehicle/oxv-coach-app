/**
 * margeLogic — ce que le bilan PUBLIE de la marge (décision fondateur, QCM du
 * 15/08/2026 : « marge pilote seule »).
 *
 * ===========================================================================
 * POURQUOI LA MARGE GLOBALE NE S'AFFICHE PAS
 * ===========================================================================
 *
 * `margin_global` valait 0,4 × véhicule + 0,6 × pilote. Or la marge véhicule
 * était calculée contre `DEFAULT_VEHICLE = 1,0 g` — une CONSTANTE : le g
 * latéral maximal d'aucune voiture n'est mesuré nulle part (table `vehicles`
 * relue le 14/08 : dix-sept colonnes, aucune grandeur d'adhérence). 40 % du
 * chiffre roi était donc fabriqué. Sur Bouteville : 51,4 contre la constante,
 * 59,1 contre une GT3 réelle — 7,7 points d'écart dus au véhicule inventé.
 *
 * LA CONSTANTE A ÉTÉ RETIRÉE LE 14/08 AU SOIR (commit `d04024e`), et le moteur
 * serveur redéployé en `cron-v3.0` : `margin_vehicle` vaut désormais `null`
 * partout, et le balayage a repris les onze lignes de la base. Ce module ne
 * corrige donc plus une fabrication — il PUBLIE ce qui reste, et le dit.
 *
 * Tant que le véhicule n'est pas caractérisé PAR LA MESURE (le maximum observé
 * sur plusieurs séances closes — même critère que le socle T1bis : trois
 * séances sur circuit fermé), le bilan publie la marge PILOTE, entièrement
 * mesurée, avec sa décomposition — et DIT l'exclusion du véhicule au lieu de
 * la combler. Le jour où `margin_vehicle` redevient une mesure (non nul, non
 * issu de la constante), le modèle `complete` réapparaît de lui-même.
 *
 * Pur, sans React — testé en node (margeLogic.test.ts).
 */

import type { SessionAnalysis } from '@/services/analysesService';

/** Une composante de la décomposition : valeur 0..100 et poids dans la somme. */
export interface MargeComposante {
  cle: 'consistency' | 'smoothness';
  label: string;
  valeur: number;
  poids: number;
}

export type MargeBilan =
  /** Rien de mesurable — la section marge ne se rend pas. */
  | { kind: 'absente' }
  /** Marge pilote seule : le véhicule n'est pas caractérisé, on le DIT. */
  | { kind: 'pilote'; pilote: number; composantes: MargeComposante[] }
  /** Véhicule ET pilote mesurés : la globale redevient publiable. */
  | { kind: 'complete'; globale: number; pilote: number; vehicule: number };

const LABELS: Record<MargeComposante['cle'], string> = {
  consistency: 'Constance',
  smoothness: 'Fluidité',
};
const POIDS: Record<MargeComposante['cle'], number> = {
  consistency: 0.6,
  smoothness: 0.4,
};

function composantes(breakdown: Record<string, number> | null): MargeComposante[] {
  if (!breakdown) return [];
  return (['consistency', 'smoothness'] as const)
    .filter((cle) => Number.isFinite(breakdown[cle]))
    .map((cle) => ({ cle, label: LABELS[cle], valeur: breakdown[cle], poids: POIDS[cle] }));
}

export function margeModel(analysis: SessionAnalysis | null): MargeBilan {
  if (!analysis) return { kind: 'absente' };
  const { marginPilot, marginVehicle, marginGlobalMeasured } = analysis;
  if (marginPilot === null || !Number.isFinite(marginPilot)) return { kind: 'absente' };
  if (
    marginVehicle !== null &&
    Number.isFinite(marginVehicle) &&
    marginGlobalMeasured !== null &&
    Number.isFinite(marginGlobalMeasured)
  ) {
    return {
      kind: 'complete',
      globale: marginGlobalMeasured,
      pilote: marginPilot,
      vehicule: marginVehicle,
    };
  }
  return { kind: 'pilote', pilote: marginPilot, composantes: composantes(analysis.breakdown) };
}

// ---------------------------------------------------------------------------
// Le virage à creuser — la phrase existait, le LIEU manquait
// ---------------------------------------------------------------------------

/**
 * `next_focus_corner_index` est persisté à chaque analyse et n'atteint AUCUN
 * écran : le pilote recevait un conseil sans carte.
 *
 * Précision de la mesure du 15/08 — un fichier le lit, `DebriefMirror.tsx:549`,
 * et ce composant n'est monté nulle part. Le champ avait donc un lecteur, et ce
 * lecteur était lui-même mort. La conclusion tient, par un chemin de plus : ce
 * dépôt superpose volontiers deux couches d'inertie, et n'en constater qu'une
 * suffit à croire le reste vivant. Résout l'index en abscisse curviligne 0..1 sur les segments réels —
 * mêmes bornes que les pastilles de marge : si le segment n'a pas de
 * position, PAS de marqueur (jamais une position devinée).
 */
export interface SegmentPositionLite {
  segmentIndex: number;
  startProgress: number | null;
  endProgress: number | null;
}

export function focusVirage(
  nextFocusCornerIndex: number | null,
  segments: readonly SegmentPositionLite[]
): { t: number; index: number } | null {
  if (nextFocusCornerIndex === null) return null;
  const seg = segments.find((s) => s.segmentIndex === nextFocusCornerIndex);
  if (!seg || seg.startProgress === null || seg.endProgress === null) return null;
  const t = (seg.startProgress + seg.endProgress) / 2;
  if (!Number.isFinite(t) || t < 0 || t > 1) return null;
  return { t, index: nextFocusCornerIndex };
}

// ---------------------------------------------------------------------------
// Le virage à creuser — CHOISI sur les segments réels
// ---------------------------------------------------------------------------

/**
 * LA COLONNE ÉTAIT VIDE DEPUIS LE 24/05/2026. Mesuré le 15/08 : sur les
 * quatorze lignes d'`app_session_analyses` en production, **zéro** portent
 * `next_focus_corner_index`, zéro portent `next_focus_phrase`.
 *
 * Le champ était déclaré dans la migration `0009`, relu par trois requêtes,
 * typé côté application, et lu par `DebriefMirror` — un composant monté nulle
 * part. Écrit par PERSONNE. Le marqueur de trace posé le 15/08 au soir aurait
 * donc été inerte lui aussi : la sélection existait, la lecture existait,
 * l'affichage existait, et il manquait l'écriture au milieu.
 *
 * ---------------------------------------------------------------------------
 * POURQUOI PAS `focusCorner.ts`, QUI EXISTE POURTANT
 * ---------------------------------------------------------------------------
 *
 * Parce qu'il choisit parmi `BELTOISE_CORNERS` — une topologie de circuit
 * codée en dur, que la politique multi-circuit a précisément retirée du reste
 * de l'application. Le brancher tel quel nommerait un virage de Beltoise sur
 * une séance roulée ailleurs. Un orphelin ne se branche pas parce qu'il est
 * orphelin : il se branche s'il dit vrai.
 *
 * Ici on n'a besoin d'aucune topologie. Le marqueur veut un INDEX de segment,
 * et les segments de la séance portent déjà leur marge et leur zone, mesurées.
 *
 * ---------------------------------------------------------------------------
 * LA RÈGLE, ET SON SILENCE
 * ---------------------------------------------------------------------------
 *
 * Doctrine : UNE seule zone à explorer, jamais une liste à hiérarchiser. On
 * prend le rouge de plus faible marge ; à défaut le jaune de plus faible
 * marge ; à défaut **rien** — tout est confortable, il n'y a rien à désigner,
 * et désigner quand même serait fabriquer un souci.
 */
export interface SegmentMargeLite {
  segmentIndex: number;
  marginPercent: number | null;
  marginZone: 'green' | 'yellow' | 'red' | null;
}

export function virageACreuser(segments: readonly SegmentMargeLite[]): number | null {
  const parZone = (zone: 'red' | 'yellow'): SegmentMargeLite[] =>
    segments.filter((s) => s.marginZone === zone && s.marginPercent !== null);

  for (const zone of ['red', 'yellow'] as const) {
    const candidats = parZone(zone);
    if (candidats.length === 0) continue;
    const pire = candidats.reduce((min, s) =>
      (s.marginPercent as number) < (min.marginPercent as number) ? s : min
    );
    return pire.segmentIndex;
  }
  return null;
}
