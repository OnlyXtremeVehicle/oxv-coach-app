/**
 * signatureLogic — logique PURE de l'écran SIGNATURE (lot V2-L1, écran 3/3).
 *
 * Module .ts sans React ni react-native : testé sous ts-jest/node
 * (src/features/miroir/__tests__/signatureLogic.test.ts).
 *
 * MAPPING LABELS ↔ BRANCHES — ARBITRÉ PAR LE FONDATEUR (19/07/2026) :
 * // TODO_ARBITRAGE — marqueur conservé à la demande du fondateur : le mapping
 * // ci-dessous est SON arbitrage (message du 19/07), re-négociable mot à mot
 * // seulement. Sens retenu, dans ses termes :
 * //
 * //   trajectoire  → « Cap »          (la direction tenue, l'axe visé —
 * //                                    le sens premier de « cap »)
 * //   regularite   → « Trajectoire »  (ici le mot désigne la CONSTANCE du
 * //                                    tracé tour après tour)
 * //   freinage     → « Visée »        (la visée du point de corde se joue
 * //                                    au freinage, à l'entrée)
 * //   acceleration → « Plongée »      (l'engagement en sortie, la remise
 * //                                    des gaz — le plongeon vers l'avant)
 * //   fluidite     → « Anticipation » (anticiper = enchaîner sans rupture,
 * //                                    lire le virage suivant dans le présent)
 * //
 * // CONSÉQUENCE ASSUMÉE (choix conscient du fondateur) : sur CET écran,
 * // « Trajectoire » désigne la branche regularite — un sens Signature
 * // distinct de la légende technique de l'accueil/du Bilan
 * // (QDI_BRANCH_LABELS, où Trajectoire = branche trajectoire). Le vocabulaire
 * // Signature est un registre poétique à part, pas la légende télémétrique.
 *
 * Les couleurs QDI (colors.qdi) et les valeurs restent attachées aux branches
 * TECHNIQUES — seul le libellé de sommet change. Un test verrouille ce mapping
 * (signatureLogic.test.ts, verrou sémantique — remplace l'ancien verrou
 * positionnel).
 *
 * Règle données réelles (fondateur) : une branche absente reste absente —
 * masquée sur le radar, jamais tirée à zéro, jamais interpolée depuis rien.
 */

import type { QdiBranches } from '@/services/qdiLogic';
import { QDI_BRANCHES, type QdiBranch } from '@/ui/v2/vizMath';

// ---------------------------------------------------------------------------
// Labels de sommets
// ---------------------------------------------------------------------------

/**
 * Mapping branche technique → libellé de sommet — ARBITRAGE FONDATEUR du
 * 19/07/2026 (voir l'en-tête). Verrouillé par test : tout changement est un
 * choix explicite, re-négociable mot à mot avec le fondateur uniquement.
 */
export const SIGNATURE_LABEL_BY_BRANCH = {
  trajectoire: 'Cap',
  regularite: 'Trajectoire',
  freinage: 'Visée',
  acceleration: 'Plongée',
  fluidite: 'Anticipation',
} as const satisfies Record<QdiBranch, string>;

export type SignatureLabel = (typeof SIGNATURE_LABEL_BY_BRANCH)[QdiBranch];

/**
 * Les 5 libellés dans l'ordre des sommets du radar (= ordre canonique
 * QDI_BRANCHES), DÉRIVÉS du mapping sémantique — plus jamais une liste
 * positionnelle indépendante qui pourrait diverger du mapping.
 */
export const SIGNATURE_LABELS: readonly SignatureLabel[] = QDI_BRANCHES.map(
  (b) => SIGNATURE_LABEL_BY_BRANCH[b]
);

// ---------------------------------------------------------------------------
// Axes mesurés
// ---------------------------------------------------------------------------

/** Une valeur de branche est « mesurée » si c'est un nombre fini. */
export function isMeasured(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Nombre de branches mesurées (0..5) parmi les 5 canoniques. */
export function measuredAxesCount(branches: QdiBranches): number {
  return QDI_BRANCHES.reduce((n, b) => (isMeasured(branches[b]) ? n + 1 : n), 0);
}

/** Mention « x/5 axes mesurés » (compte borné à [0, 5], entier). */
export function formatMeasuredAxes(count: number): string {
  const n = Number.isFinite(count) ? Math.min(5, Math.max(0, Math.round(count))) : 0;
  return `${n}/5 axes mesurés`;
}

/** Les 5 branches à null — l'état « rien de mesuré », jamais des zéros. */
export const EMPTY_BRANCHES: QdiBranches = {
  trajectoire: null,
  fluidite: null,
  freinage: null,
  acceleration: null,
  regularite: null,
};

/**
 * Conversion vers la prop `values` de RadarQdi : seules les branches
 * mesurées sont présentes (le composant masque les absentes).
 */
export function branchesToRadarValues(branches: QdiBranches): Partial<Record<QdiBranch, number>> {
  const out: Partial<Record<QdiBranch, number>> = {};
  for (const b of QDI_BRANCHES) {
    const v = branches[b];
    if (isMeasured(v)) out[b] = v;
  }
  return out;
}

/** Égalité branche à branche (les non-mesurées comptent comme égales entre elles). */
export function branchesEqual(a: QdiBranches, b: QdiBranches): boolean {
  return QDI_BRANCHES.every((k) => {
    const va = a[k];
    const vb = b[k];
    const ma = isMeasured(va);
    const mb = isMeasured(vb);
    if (ma !== mb) return false;
    return !ma || va === vb;
  });
}

// ---------------------------------------------------------------------------
// Morph mensuel — interpolation des 5 sommets
// ---------------------------------------------------------------------------

/**
 * Interpolation du radar entre deux jeux de branches, pour le morph du grand
 * radar vers un mois de l'Empreinte. `t` est borné à [0, 1].
 *
 * Branches nulles (règle données réelles, documentée) :
 *   - t = 0 → valeurs de `from` telles quelles ; t = 1 → valeurs de `to` ;
 *   - entre les deux, une branche n'est interpolée QUE si elle est mesurée
 *     des deux côtés. Une branche mesurée d'un seul côté reste masquée
 *     pendant le vol et apparaît (ou disparaît) au claquement d'arrivée —
 *     elle ne « pousse » jamais depuis un zéro inventé.
 */
export function lerpRadar(from: QdiBranches, to: QdiBranches, t: number): QdiBranches {
  const tc = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  const pick = (branch: QdiBranch): number | null => {
    const a = from[branch];
    const b = to[branch];
    if (tc <= 0) return isMeasured(a) ? a : null;
    if (tc >= 1) return isMeasured(b) ? b : null;
    if (isMeasured(a) && isMeasured(b)) return a + (b - a) * tc;
    return null;
  };
  return {
    trajectoire: pick('trajectoire'),
    fluidite: pick('fluidite'),
    freinage: pick('freinage'),
    acceleration: pick('acceleration'),
    regularite: pick('regularite'),
  };
}

// ---------------------------------------------------------------------------
// Sélection — fenêtre 30 jours ↔ mois de l'Empreinte
// ---------------------------------------------------------------------------

/** Fenêtre par défaut du grand radar : les 30 derniers jours (vous vs vous). */
export const SIGNATURE_WINDOW_DAYS = 30;

/** Légende mono centrée sous le radar, état fenêtre. */
export const SIGNATURE_WINDOW_CAPTION = 'vous vs vous · 30 jours';

export type SignatureSelection = { kind: 'window' } | { kind: 'month'; monthKey: string };

/** Sous-ensemble structurel de MonthlyQdi (qdiService) utilisé par la logique. */
export interface MonthEntry {
  monthKey: string;
  monthLabel: string;
  branches: QdiBranches;
}

/**
 * Sélection initiale : la fenêtre 30 jours si elle contient des données ;
 * sinon le mois le plus récent de l'Empreinte (listMonthlyQdi rend les mois
 * en ordre croissant → le dernier est le plus récent) — on ne présente
 * JAMAIS une fenêtre vide comme si elle était mesurée.
 *
 * Validité de la bascule (V2-L1, correctif) : listMonthlyQdi filtre désormais
 * les QDI par algo_version côté service — un mois de l'Empreinte ne contient
 * QUE des QDI à l'algo courant. La bascule « baseline vide → mois le plus
 * récent » ne peut donc plus atterrir sur des médianes 1.0.x invalides
 * (axes G inversés) : un mois sans QDI valide n'existe pas dans `monthly`.
 */
export function defaultSelection(
  hasBaseline: boolean,
  monthly: readonly MonthEntry[]
): SignatureSelection {
  if (hasBaseline) return { kind: 'window' };
  const latest = monthly[monthly.length - 1];
  return latest ? { kind: 'month', monthKey: latest.monthKey } : { kind: 'window' };
}

/**
 * Toucher un mois de l'Empreinte : morph vers ce mois ; second toucher du
 * même mois : retour à la fenêtre 30 jours — seulement si elle existe
 * (sans fenêtre mesurée, la sélection reste sur le mois).
 */
export function toggleMonth(
  current: SignatureSelection,
  monthKey: string,
  hasBaseline: boolean
): SignatureSelection {
  if (current.kind === 'month' && current.monthKey === monthKey) {
    return hasBaseline ? { kind: 'window' } : current;
  }
  return { kind: 'month', monthKey };
}

/** Branches cibles de la sélection courante (EMPTY_BRANCHES si introuvable). */
export function selectionBranches(
  selection: SignatureSelection,
  baseline: QdiBranches | null,
  monthly: readonly MonthEntry[]
): QdiBranches {
  if (selection.kind === 'window') return baseline ?? EMPTY_BRANCHES;
  const month = monthly.find((m) => m.monthKey === selection.monthKey);
  return month ? month.branches : EMPTY_BRANCHES;
}

/** Légende sous le radar : fenêtre 30 jours, ou le mois affiché. */
export function selectionCaption(
  selection: SignatureSelection,
  monthly: readonly MonthEntry[]
): string {
  if (selection.kind === 'window') return SIGNATURE_WINDOW_CAPTION;
  const month = monthly.find((m) => m.monthKey === selection.monthKey);
  return month ? `vous vs vous · ${month.monthLabel}` : SIGNATURE_WINDOW_CAPTION;
}

// ---------------------------------------------------------------------------
// Statut d'écran — distinguer ERREUR (retry) et VIDE (constat honnête)
// ---------------------------------------------------------------------------

export interface SignatureSourcesOutcome {
  /** loadBaseline (fetchAllSessions strict) a REJETÉ — erreur réseau/DB. */
  baselineFailed: boolean;
  /** La fenêtre 30 jours a livré au moins une branche mesurée. */
  hasBaseline: boolean;
  /** listMonthlyQdi (strict) a REJETÉ — erreur réseau/DB. */
  monthlyFailed: boolean;
  /** L'Empreinte a livré au moins un mois avec QDI valide. */
  hasMonthly: boolean;
}

/**
 * Statut de l'écran Signature après règlement des deux sources de contenu
 * (règle fondateur : ABSENT ≠ ERREUR, jamais un « vide » fabriqué sur panne).
 *
 *   - au moins une source a du CONTENU → 'ready' : on rend ce qui est mesuré
 *     (une source honnête suffit à un radar honnête) ;
 *   - aucune source n'a de contenu ET au moins une a ÉCHOUÉ → 'error' + retry :
 *     l'état vide (« après votre premier roulage analysé ») serait une
 *     affirmation fabriquée — on ne sait PAS si le pilote n'a rien roulé ;
 *   - aucune source n'a de contenu et aucune n'a échoué → 'ready' : le vide
 *     est un constat réel, l'écran rend l'état empty en toute honnêteté.
 *
 * Atteignable en pratique (correctif V2-L1) : les deux sources sont lues en
 * mode strict (fetchAllSessions { strict } et listMonthlyQdi { strict }) —
 * elles REJETTENT sur erreur DB au lieu d'avaler en []/null. L'ancien état
 * 'error' exigeait un double rejet impossible (listMonthlyQdi ne rejetait
 * jamais) : hors connexion, l'écran affirmait « rien de roulé » à un pilote
 * qui a des mois de données.
 */
export function signatureStatusFromSources(o: SignatureSourcesOutcome): 'ready' | 'error' {
  const hasContent = o.hasBaseline || o.hasMonthly;
  const anyFailed = o.baselineFailed || o.monthlyFailed;
  return !hasContent && anyFailed ? 'error' : 'ready';
}

// ---------------------------------------------------------------------------
// Pilier physiologique (BIO-4) — section gatée, OFF aujourd'hui
// ---------------------------------------------------------------------------

// TODO_ARBITRAGE D2 : libellé provisoire du pilier physiologique (BIO-4),
// exporté dès maintenant pour figer le vocabulaire — la section reste OFF.
export const PHYSIO_PILLAR_LABEL = 'Aplomb';

/** Nombre minimal de séances AVEC données biométriques pour ouvrir la section. */
export const PHYSIO_MIN_SESSIONS = 3;

export interface PhysioGateInput {
  /** Drapeau 'biometry' (isFlagEnabled — déjà fail-closed côté service). */
  flagEnabled: boolean;
  /** Consentement de capture cardio (loadBiometryConsents().capture). */
  captureConsent: boolean;
  /** Séances comptées avec au moins un échantillon biométrique. */
  sessionsWithData: number;
}

/**
 * Gating de la section physiologique — FAIL-CLOSED sur les 3 conditions :
 * drapeau actif ET consentement capture ET ≥ PHYSIO_MIN_SESSIONS séances
 * avec données. Toute entrée douteuse (non-booléen strict, compte non fini)
 * ferme la section. OFF aujourd'hui : l'écran rend null, zéro teasing.
 */
export function physioSectionVisible(input: PhysioGateInput): boolean {
  if (input.flagEnabled !== true) return false;
  if (input.captureConsent !== true) return false;
  if (!Number.isFinite(input.sessionsWithData)) return false;
  return input.sessionsWithData >= PHYSIO_MIN_SESSIONS;
}
