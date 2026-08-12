/**
 * Tests signatureLogic (lot V2-L1, écran SIGNATURE) — logique pure, node.
 *
 * Couvre (spec L1 + correctifs V2-L1) : mapping labels ↔ branches (verrou
 * SÉMANTIQUE — remplace l'ancien verrou positionnel, cf. TODO_ARBITRAGE),
 * lerpRadar (t = 0 / 1 / 0.5, branches nulles, bornage), measuredAxesCount +
 * mention, sélection fenêtre ↔ mois (défaut, toggle, branches, légende),
 * statut d'écran erreur ≠ vide (signatureStatusFromSources), gating
 * physiologique fail-closed (3 conditions).
 */

import type { QdiBranches } from '@/services/qdiLogic';
import { QDI_BRANCHES, QDI_BRANCH_LABELS } from '@/ui/v2/vizMath';

import {
  branchesEqual,
  branchesToRadarValues,
  defaultSelection,
  EMPTY_BRANCHES,
  formatMeasuredAxes,
  isMeasured,
  lerpRadar,
  measuredAxesCount,
  PHYSIO_MIN_SESSIONS,
  PHYSIO_PILLAR_LABEL,
  physioSectionVisible,
  selectionBranches,
  selectionCaption,
  SIGNATURE_LABEL_BY_BRANCH,
  SIGNATURE_LABELS,
  SIGNATURE_WINDOW_CAPTION,
  signatureStatusFromSources,
  toggleMonth,
  type MonthEntry,
} from '../signatureLogic';

/** Branches complètes avec surcharges — les absentes restent null. */
function mk(partial: Partial<QdiBranches> = {}): QdiBranches {
  return { ...EMPTY_BRANCHES, ...partial };
}

const FULL = mk({
  trajectoire: 80,
  fluidite: 60,
  freinage: 40,
  acceleration: 20,
  regularite: 100,
});

// ---------------------------------------------------------------------------
// Mapping labels ↔ branches
// ---------------------------------------------------------------------------

describe('SIGNATURE_LABEL_BY_BRANCH — verrou de l’ARBITRAGE FONDATEUR (19/07/2026)', () => {
  it('verrou du mapping arbitré : chaque branche porte le libellé tranché par le fondateur', () => {
    // Arbitrage fondateur du 19/07/2026 (message, mot à mot) : Cap = la
    // direction tenue (trajectoire) · Trajectoire = la constance du tracé
    // (regularite) · Visée = le point de corde se joue au freinage · Plongée =
    // l'engagement en sortie (acceleration) · Anticipation = enchaîner sans
    // rupture (fluidite). Tout changement se re-négocie mot à mot avec lui.
    expect(SIGNATURE_LABEL_BY_BRANCH).toEqual({
      trajectoire: 'Cap',
      regularite: 'Trajectoire',
      freinage: 'Visée',
      acceleration: 'Plongée',
      fluidite: 'Anticipation',
    });
  });

  it('registre Signature assumé : « Trajectoire » y désigne la régularité (choix fondateur)', () => {
    // Choix CONSCIENT du fondateur : le vocabulaire Signature est un registre
    // poétique à part — sur cet écran, « Trajectoire » = constance du tracé
    // (branche regularite), distinct de la légende télémétrique de l'accueil
    // et du Bilan (QDI_BRANCH_LABELS.trajectoire).
    expect(SIGNATURE_LABEL_BY_BRANCH.regularite).toBe('Trajectoire');
    expect(SIGNATURE_LABEL_BY_BRANCH.trajectoire).toBe('Cap');
    // La légende technique, elle, ne bouge pas.
    expect(QDI_BRANCH_LABELS.trajectoire).toBe('Trajectoire');
    // Et un seul sommet Signature porte chaque mot.
    QDI_BRANCHES.filter((b) => b !== 'regularite').forEach((b) => {
      expect(SIGNATURE_LABEL_BY_BRANCH[b]).not.toBe('Trajectoire');
    });
  });

  it('les 5 libellés du dossier maître sont tous présents, sans doublon', () => {
    expect([...SIGNATURE_LABELS].sort()).toEqual(
      ['Anticipation', 'Cap', 'Plongée', 'Trajectoire', 'Visée'].sort()
    );
    expect(new Set(SIGNATURE_LABELS).size).toBe(5);
  });

  it('SIGNATURE_LABELS est dérivé du mapping, dans l’ordre canonique des branches', () => {
    expect(SIGNATURE_LABELS).toEqual(QDI_BRANCHES.map((b) => SIGNATURE_LABEL_BY_BRANCH[b]));
  });
});

// ---------------------------------------------------------------------------
// Axes mesurés
// ---------------------------------------------------------------------------

describe('measuredAxesCount / formatMeasuredAxes', () => {
  it('compte 5 sur des branches complètes, 0 sur EMPTY_BRANCHES', () => {
    expect(measuredAxesCount(FULL)).toBe(5);
    expect(measuredAxesCount(EMPTY_BRANCHES)).toBe(0);
  });

  it('ne compte que les nombres finis (null et NaN écartés)', () => {
    expect(measuredAxesCount(mk({ trajectoire: 50, freinage: 0 }))).toBe(2);
    expect(measuredAxesCount(mk({ fluidite: Number.NaN, regularite: 70 }))).toBe(1);
  });

  it('formate « x/5 axes mesurés » et borne le compte', () => {
    expect(formatMeasuredAxes(3)).toBe('3/5 axes mesurés');
    expect(formatMeasuredAxes(0)).toBe('0/5 axes mesurés');
    expect(formatMeasuredAxes(7)).toBe('5/5 axes mesurés');
    expect(formatMeasuredAxes(-2)).toBe('0/5 axes mesurés');
    expect(formatMeasuredAxes(Number.NaN)).toBe('0/5 axes mesurés');
  });

  it('isMeasured : nombre fini uniquement', () => {
    expect(isMeasured(0)).toBe(true);
    expect(isMeasured(null)).toBe(false);
    expect(isMeasured(Number.NaN)).toBe(false);
    expect(isMeasured(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// lerpRadar — le morph mensuel
// ---------------------------------------------------------------------------

describe('lerpRadar', () => {
  const from = mk({ trajectoire: 20, fluidite: 40, regularite: 60 });
  const to = mk({ trajectoire: 80, fluidite: 40, freinage: 50 });

  it('t = 0 → valeurs de départ telles quelles', () => {
    expect(lerpRadar(from, to, 0)).toEqual(from);
  });

  it('t = 1 → valeurs cibles telles quelles', () => {
    expect(lerpRadar(from, to, 1)).toEqual(to);
  });

  it('t = 0.5 → milieu exact des branches mesurées des deux côtés', () => {
    const mid = lerpRadar(from, to, 0.5);
    expect(mid.trajectoire).toBe(50); // 20 → 80
    expect(mid.fluidite).toBe(40); // stable
  });

  it('branche mesurée d’un seul côté : masquée en vol, présente aux extrémités', () => {
    const mid = lerpRadar(from, to, 0.5);
    // regularite : mesurée au départ seulement — null en vol, absente à 1.
    expect(mid.regularite).toBeNull();
    expect(lerpRadar(from, to, 1).regularite).toBeNull();
    expect(lerpRadar(from, to, 0).regularite).toBe(60);
    // freinage : mesurée à l'arrivée seulement — null en vol, présente à 1.
    expect(mid.freinage).toBeNull();
    expect(lerpRadar(from, to, 0).freinage).toBeNull();
    expect(lerpRadar(from, to, 1).freinage).toBe(50);
  });

  it('branche nulle des deux côtés : null à tout t', () => {
    expect(lerpRadar(from, to, 0).acceleration).toBeNull();
    expect(lerpRadar(from, to, 0.5).acceleration).toBeNull();
    expect(lerpRadar(from, to, 1).acceleration).toBeNull();
  });

  it('t est borné : hors [0,1] → extrémités, jamais d’extrapolation', () => {
    expect(lerpRadar(from, to, -0.5)).toEqual(from);
    expect(lerpRadar(from, to, 1.5)).toEqual(to);
    expect(lerpRadar(from, to, Number.NaN)).toEqual(from);
  });
});

// ---------------------------------------------------------------------------
// Conversion et égalité
// ---------------------------------------------------------------------------

describe('branchesToRadarValues / branchesEqual', () => {
  it('ne garde que les branches mesurées (les nulles sont absentes, pas à 0)', () => {
    expect(branchesToRadarValues(mk({ trajectoire: 72, freinage: 0 }))).toEqual({
      trajectoire: 72,
      freinage: 0,
    });
    expect(branchesToRadarValues(EMPTY_BRANCHES)).toEqual({});
  });

  it('branchesEqual : égalité branche à branche, null ≡ null', () => {
    expect(branchesEqual(FULL, { ...FULL })).toBe(true);
    expect(branchesEqual(EMPTY_BRANCHES, mk())).toBe(true);
    expect(branchesEqual(FULL, mk({ ...FULL, freinage: null }))).toBe(false);
    expect(branchesEqual(FULL, mk({ ...FULL, freinage: 41 }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Sélection fenêtre ↔ mois
// ---------------------------------------------------------------------------

const MONTHS: MonthEntry[] = [
  { monthKey: '2026-05', monthLabel: 'MAI', branches: mk({ trajectoire: 30 }) },
  { monthKey: '2026-06', monthLabel: 'JUIN', branches: mk({ trajectoire: 55, fluidite: 45 }) },
];

describe('defaultSelection / toggleMonth', () => {
  it('historique par défaut quand il contient des données', () => {
    expect(defaultSelection(true, MONTHS)).toEqual({ kind: 'window' });
  });

  it('sans fenêtre mesurée : le mois le plus récent (dernier de la liste)', () => {
    expect(defaultSelection(false, MONTHS)).toEqual({ kind: 'month', monthKey: '2026-06' });
  });

  it('sans aucune donnée : fenêtre (l’écran rend l’état vide)', () => {
    expect(defaultSelection(false, [])).toEqual({ kind: 'window' });
  });

  it('toucher un mois → morph vers ce mois', () => {
    expect(toggleMonth({ kind: 'window' }, '2026-05', true)).toEqual({
      kind: 'month',
      monthKey: '2026-05',
    });
    expect(toggleMonth({ kind: 'month', monthKey: '2026-05' }, '2026-06', true)).toEqual({
      kind: 'month',
      monthKey: '2026-06',
    });
  });

  it('second toucher du même mois → retour à l’historique (s’il existe)', () => {
    expect(toggleMonth({ kind: 'month', monthKey: '2026-06' }, '2026-06', true)).toEqual({
      kind: 'window',
    });
  });

  it('second toucher sans fenêtre mesurée → reste sur le mois (rien de vide)', () => {
    expect(toggleMonth({ kind: 'month', monthKey: '2026-06' }, '2026-06', false)).toEqual({
      kind: 'month',
      monthKey: '2026-06',
    });
  });
});

describe('selectionBranches / selectionCaption', () => {
  const baseline = mk({ trajectoire: 66, regularite: 70 });

  it('fenêtre → baseline ; baseline absente → EMPTY_BRANCHES', () => {
    expect(selectionBranches({ kind: 'window' }, baseline, MONTHS)).toEqual(baseline);
    expect(selectionBranches({ kind: 'window' }, null, MONTHS)).toEqual(EMPTY_BRANCHES);
  });

  it('mois → branches du mois ; mois introuvable → EMPTY_BRANCHES', () => {
    expect(selectionBranches({ kind: 'month', monthKey: '2026-06' }, baseline, MONTHS)).toEqual(
      MONTHS[1].branches
    );
    expect(selectionBranches({ kind: 'month', monthKey: '1999-01' }, baseline, MONTHS)).toEqual(
      EMPTY_BRANCHES
    );
  });

  it('légende de repli, ou le mois affiché', () => {
    expect(selectionCaption({ kind: 'window' }, MONTHS)).toBe(SIGNATURE_WINDOW_CAPTION);
    expect(selectionCaption({ kind: 'window' }, MONTHS)).toBe('vous vs vous');
    expect(selectionCaption({ kind: 'month', monthKey: '2026-06' }, MONTHS)).toBe(
      'vous vs vous · JUIN'
    );
    expect(selectionCaption({ kind: 'month', monthKey: '1999-01' }, MONTHS)).toBe(
      SIGNATURE_WINDOW_CAPTION
    );
  });
});

// ---------------------------------------------------------------------------
// Statut d'écran — erreur ≠ vide (correctif V2-L1)
// ---------------------------------------------------------------------------

describe('signatureStatusFromSources (ABSENT ≠ ERREUR)', () => {
  const ok = { baselineFailed: false, monthlyFailed: false };

  it('les deux sources ont réussi → ready (contenu ou vide honnête)', () => {
    expect(signatureStatusFromSources({ ...ok, hasBaseline: true, hasMonthly: true })).toBe(
      'ready'
    );
    expect(signatureStatusFromSources({ ...ok, hasBaseline: false, hasMonthly: false })).toBe(
      'ready'
    );
  });

  it('une source a du contenu → ready, même si l’autre a échoué', () => {
    expect(
      signatureStatusFromSources({
        baselineFailed: true,
        hasBaseline: false,
        monthlyFailed: false,
        hasMonthly: true,
      })
    ).toBe('ready');
    expect(
      signatureStatusFromSources({
        baselineFailed: false,
        hasBaseline: true,
        monthlyFailed: true,
        hasMonthly: false,
      })
    ).toBe('ready');
  });

  it('panne totale (les deux rejettent) → error, jamais l’état vide', () => {
    expect(
      signatureStatusFromSources({
        baselineFailed: true,
        hasBaseline: false,
        monthlyFailed: true,
        hasMonthly: false,
      })
    ).toBe('error');
  });

  it('un échec + aucune source de contenu → error (le vide serait fabriqué)', () => {
    // monthly a échoué et la fenêtre 30 j est vide : on ne SAIT pas si le
    // pilote n'a rien roulé — affirmer « après votre premier roulage » serait
    // une fabrication.
    expect(
      signatureStatusFromSources({
        baselineFailed: false,
        hasBaseline: false,
        monthlyFailed: true,
        hasMonthly: false,
      })
    ).toBe('error');
    // baseline a échoué et l'Empreinte est vide : symétrique.
    expect(
      signatureStatusFromSources({
        baselineFailed: true,
        hasBaseline: false,
        monthlyFailed: false,
        hasMonthly: false,
      })
    ).toBe('error');
  });
});

// ---------------------------------------------------------------------------
// Gating physiologique BIO-4 — fail-closed
// ---------------------------------------------------------------------------

describe('physioSectionVisible (fail-closed, 3 conditions)', () => {
  const OPEN = { flagEnabled: true, captureConsent: true, sessionsWithData: 3 };

  it('libellé provisoire exporté (section OFF aujourd’hui)', () => {
    expect(PHYSIO_PILLAR_LABEL).toBe('Aplomb');
    expect(PHYSIO_MIN_SESSIONS).toBe(3);
  });

  it('ouvre uniquement quand les 3 conditions sont réunies', () => {
    expect(physioSectionVisible(OPEN)).toBe(true);
    expect(physioSectionVisible({ ...OPEN, sessionsWithData: 12 })).toBe(true);
  });

  it('drapeau OFF → fermé, quelles que soient les autres conditions', () => {
    expect(physioSectionVisible({ ...OPEN, flagEnabled: false })).toBe(false);
  });

  it('consentement absent → fermé', () => {
    expect(physioSectionVisible({ ...OPEN, captureConsent: false })).toBe(false);
  });

  it('moins de 3 séances avec données → fermé (2 ferme, 3 ouvre)', () => {
    expect(physioSectionVisible({ ...OPEN, sessionsWithData: 2 })).toBe(false);
    expect(physioSectionVisible({ ...OPEN, sessionsWithData: 0 })).toBe(false);
  });

  it('entrées douteuses → fermé (jamais ouvert par accident)', () => {
    expect(physioSectionVisible({ ...OPEN, sessionsWithData: Number.NaN })).toBe(false);
    expect(
      physioSectionVisible({
        flagEnabled: true as unknown as boolean,
        captureConsent: undefined as unknown as boolean,
        sessionsWithData: 5,
      })
    ).toBe(false);
  });
});
