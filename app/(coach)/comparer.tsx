/**
 * Écran Coach — Comparer DEUX séances d'un même pilote (handoff §12 ·
 * coach/16-comparer-seances). Reskin refonte-v2 RESPONSIVE DEUX FORMATS
 * (décision fondateur 2026-07-13) :
 *   - CONSOLE (largeur ≥ COACH_CONSOLE_MIN_WIDTH) : fidèle à la maquette —
 *     en-tête « COMPARER · {pilote} » + « {mois A} vs {mois B} » + tag
 *     « deux faits, aucun gagnant », deux cartes-colonnes (A or / B bleu) et un
 *     TABLEAU FACTUEL (valeur A · libellé · valeur B).
 *   - COMPAGNON téléphone : la même matière en UNE colonne compacte.
 *
 * Doctrine (garde-fous §12) : deux LECTURES côte à côte, JAMAIS un gagnant — ni
 * vert/rouge de jugement, ni delta interprété. L'app décrit, le coach interprète.
 * Lecture seule ; chaque consultation journalisée (logCoachView, RLS coach).
 *
 * Convention de série verrouillée « A or / B bleu » (cf. comparateur pilote) :
 * l'OR (#FFB703) et le BLEU trajectoire (#4F9DF7) sont ici des ÉTIQUETTES de
 * colonne, pas un verdict. La régularité garde sa couleur QDI fixe (violet) sur
 * les deux colonnes. Marge & tours restent neutres (aucune hiérarchie).
 *
 * Données réelles uniquement (les chiffres du PNG sont des exemples) :
 *   - meilleur tour · marge globale · tours → loadSessionSnapshot
 *     (telemetry_sessions + app_session_analyses, RLS coach) ;
 *   - régularité → écart-type des tours réels (`laps` via fetchSessionLaps →
 *     computeRegularity, mêmes filtres outlap/inlap que l'écran Régularité),
 *     best-effort, sans bloquer l'écran.
 *   Valeur absente → « — ». Aucune table ni colonne nouvelle. La maquette montre
 *   une ligne « sorties » : non tracée dans le modèle → retirée (pas de contrôle
 *   mort). Le nom du pilote pour l'eyebrow vient de listMyPilots (best-effort).
 */

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { COACH_CONSOLE_MIN_WIDTH } from '@/lib/coachNav';
import {
  type SessionSnapshot,
  listMyPilots,
  loadSessionSnapshot,
  logCoachView,
} from '@/services/coachService';
import { computeRegularity } from '@/services/regularityService';
import { fetchSessionLaps } from '@/services/sessionsService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';
import { formatChronoTenths } from '@/utils/format';

const { palette, dataColors, spacing } = theme;

// Étiquettes de série (convention verrouillée « A or / B bleu ; aucun gagnant »).
const SERIES_A = palette.gold; // #FFB703 — étiquette de la colonne A (pas un record)
const SERIES_B = dataColors.trajectory; // #4F9DF7 — étiquette de la colonne B
const REGUL = dataColors.regularity; // #A783F2 — couleur QDI fixe de la régularité

export default function CoachComparerScreen() {
  const params = useLocalSearchParams<{
    pilotId?: string;
    sessionA?: string;
    sessionB?: string;
  }>();
  const { width } = useWindowDimensions();
  const isConsole = width >= COACH_CONSOLE_MIN_WIDTH;

  const [snapA, setSnapA] = useState<SessionSnapshot | null>(null);
  const [snapB, setSnapB] = useState<SessionSnapshot | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  // Écart-type des tours par côté : null = non mesurable / pas encore calculé
  // (affiché « — »). N'influence pas l'état de l'écran (best-effort).
  const [stdA, setStdA] = useState<number | null>(null);
  const [stdB, setStdB] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Chargement des deux snapshots (pilote source des états). Inchangé : audit
  // RGPD (un accès à 2 séances = 2 events « coach_view_compare »).
  useEffect(() => {
    if (!params.sessionA || !params.sessionB) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);

    if (params.pilotId) {
      logCoachView(params.pilotId, {
        subtype: 'coach_view_compare',
        sessionId: params.sessionA,
      });
      logCoachView(params.pilotId, {
        subtype: 'coach_view_compare',
        sessionId: params.sessionB,
      });
    }

    Promise.all([loadSessionSnapshot(params.sessionA), loadSessionSnapshot(params.sessionB)])
      .then(([a, b]) => {
        if (cancelled) return;
        setSnapA(a);
        setSnapB(b);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[OXV][coach] comparer :', err);
        setError(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [params.sessionA, params.sessionB, params.pilotId, reloadKey]);

  // Nom du pilote pour l'eyebrow « COMPARER · {prénom} » — best-effort, RLS
  // coach_pilots_view (jamais de coordonnées). N'affecte pas l'état de l'écran.
  useEffect(() => {
    if (!params.pilotId) return;
    let cancelled = false;
    listMyPilots()
      .then((rows) => {
        if (cancelled) return;
        const found = rows.find((p) => p.pilotId === params.pilotId);
        if (found) setFirstName(found.firstName?.trim() || null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [params.pilotId]);

  // Régularité réelle (écart-type des tours volants) — best-effort, mêmes filtres
  // que l'écran Régularité. Ne conditionne pas l'état (violet si mesuré, « — » sinon).
  useEffect(() => {
    const a = params.sessionA;
    const b = params.sessionB;
    if (!a || !b) return;
    let cancelled = false;
    setStdA(null);
    setStdB(null);
    const load = (sessionId: string, setter: (v: number | null) => void) =>
      fetchSessionLaps(sessionId)
        .then((laps) => {
          if (cancelled) return;
          const reg = computeRegularity(
            laps
              .filter((l) => !l.is_outlap && !l.is_inlap)
              .map((l) => ({ lapNumber: l.lap_number, durationSeconds: l.duration_seconds }))
          );
          setter(reg.stdDevSeconds);
        })
        .catch(() => undefined);
    load(a, setStdA);
    load(b, setStdB);
    return () => {
      cancelled = true;
    };
  }, [params.sessionA, params.sessionB, reloadKey]);

  const state: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : !snapA || !snapB
        ? 'empty'
        : 'nominal';

  return (
    <Screen>
      <AppBar title="COMPARATIF" onBack={() => router.back()} />
      <View
        style={[
          { paddingHorizontal: isConsole ? spacing.xl : spacing.lg, paddingBottom: spacing.xxl },
          isConsole ? s.consoleWidth : null,
        ]}
      >
        <View style={{ marginBottom: spacing.md }}>
          <RoleBadge role="coach" />
        </View>

        <StateWrapper
          state={state}
          skeletonLines={5}
          emptyLabel="Sélection incomplète."
          emptyMessage="Le comparatif requiert deux séances analysées. Revenez à la fiche du pilote pour les choisir."
          errorCause="Le comparatif n'a pas pu être chargé."
          onRetry={() => setReloadKey((k) => k + 1)}
        >
          {snapA && snapB ? (
            <ComparerBody
              snapA={snapA}
              snapB={snapB}
              firstName={firstName}
              stdA={stdA}
              stdB={stdB}
              isConsole={isConsole}
            />
          ) : null}
        </StateWrapper>
      </View>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Corps — en-tête + cartes-colonnes + tableau factuel, arrangés par format
// ─────────────────────────────────────────────────────────────────────────────

function ComparerBody({
  snapA,
  snapB,
  firstName,
  stdA,
  stdB,
  isConsole,
}: {
  snapA: SessionSnapshot;
  snapB: SessionSnapshot;
  firstName: string | null;
  stdA: number | null;
  stdB: number | null;
  isConsole: boolean;
}) {
  const eyebrow = `COMPARER${firstName ? ` · ${firstName.toUpperCase()}` : ''}`;
  const title = periodTitle(snapA.startedAt, snapB.startedAt);

  const header = isConsole ? (
    <View style={s.headerRow}>
      <View style={{ flexShrink: 1 }}>
        <Text style={s.eyebrow}>{eyebrow}</Text>
        <Text style={s.title} accessibilityRole="header">
          {title}
        </Text>
      </View>
      <Text style={s.tag}>deux faits, aucun gagnant</Text>
    </View>
  ) : (
    <View>
      <Text style={s.eyebrow}>{eyebrow}</Text>
      <Text style={s.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={[s.tag, { marginTop: spacing.xs }]}>deux faits, aucun gagnant</Text>
    </View>
  );

  const headCards = (
    <View style={s.headCards}>
      <ColumnHead slot="A" color={SERIES_A} snap={snapA} />
      <ColumnHead slot="B" color={SERIES_B} snap={snapB} />
    </View>
  );

  const table = (
    <View style={s.table}>
      <MetricRow
        label="meilleur tour"
        valueA={chronoText(snapA)}
        valueB={chronoText(snapB)}
        colorA={SERIES_A}
        colorB={SERIES_B}
        a11y={`Meilleur tour. Séance A : ${spoken(chronoText(snapA))} ; séance B : ${spoken(
          chronoText(snapB)
        )}.`}
      />
      <MetricRow
        label="régularité"
        valueA={stdText(stdA)}
        valueB={stdText(stdB)}
        colorA={REGUL}
        colorB={REGUL}
        a11y={`Régularité, écart-type des tours. Séance A : ${stdSpoken(
          stdA
        )} ; séance B : ${stdSpoken(stdB)}.`}
      />
      <MetricRow
        label="marge globale"
        valueA={margeText(snapA)}
        valueB={margeText(snapB)}
        colorA={palette.cream}
        colorB={palette.cream}
        a11y={`Marge globale. Séance A : ${spoken(margeText(snapA))} ; séance B : ${spoken(
          margeText(snapB)
        )}.`}
      />
      <MetricRow
        label="tours"
        valueA={toursText(snapA)}
        valueB={toursText(snapB)}
        colorA={palette.cream}
        colorB={palette.cream}
        last
        a11y={`Tours bouclés. Séance A : ${spoken(toursText(snapA))} ; séance B : ${spoken(
          toursText(snapB)
        )}.`}
      />
    </View>
  );

  const closing = (
    <Text style={s.closing}>
      Les chiffres sont là. Le sens, vous le posez avec {firstName ? firstName : 'ce pilote'}.
    </Text>
  );

  return (
    <View style={{ gap: isConsole ? spacing.xl : spacing.lg, marginTop: spacing.md }}>
      {header}
      {headCards}
      {table}
      {closing}
    </View>
  );
}

// ── Carte-colonne : date de la séance + badge de série (A or / B bleu) ────────

function ColumnHead({
  slot,
  color,
  snap,
}: {
  slot: 'A' | 'B';
  color: string;
  snap: SessionSnapshot;
}) {
  const day = dayNumber(snap.startedAt);
  const month = monthName(snap.startedAt);
  return (
    <Card style={s.headCard}>
      <View style={s.headRow} accessible accessibilityLabel={`Séance ${slot} : ${day} ${month}.`}>
        <View style={{ flex: 1 }}>
          <Text style={s.headDay}>{day}</Text>
          <Text style={s.headMonth}>{month}</Text>
        </View>
        <View style={[s.badge, { backgroundColor: color }]}>
          <Text style={s.badgeTxt}>{slot}</Text>
        </View>
      </View>
    </Card>
  );
}

// ── Ligne du tableau : valeur A · libellé centré · valeur B ───────────────────

function MetricRow({
  label,
  valueA,
  valueB,
  colorA,
  colorB,
  last,
  a11y,
}: {
  label: string;
  valueA: string;
  valueB: string;
  colorA: string;
  colorB: string;
  last?: boolean;
  a11y: string;
}) {
  // Une valeur absente reste neutre (jamais colorée sur un tiret).
  const cA = valueA === '—' ? palette.creamMute : colorA;
  const cB = valueB === '—' ? palette.creamMute : colorB;
  return (
    <View accessible accessibilityLabel={a11y} style={[s.row, !last && s.rowBorder]}>
      <Text style={[s.rowValue, { color: cA, textAlign: 'left' }]}>{valueA}</Text>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, { color: cB, textAlign: 'right' }]}>{valueB}</Text>
    </View>
  );
}

// ============================================================================
// Formatage — chaque valeur trace vers une donnée réelle, « — » sinon
// ============================================================================

function chronoText(snap: SessionSnapshot): string {
  return snap.bestLapSeconds !== null && snap.bestLapSeconds > 0
    ? formatChronoTenths(snap.bestLapSeconds)
    : '—';
}

function margeText(snap: SessionSnapshot): string {
  return snap.marginGlobal !== null ? `${Math.round(snap.marginGlobal)} %` : '—';
}

function toursText(snap: SessionSnapshot): string {
  return snap.lapCount !== null ? String(snap.lapCount) : '—';
}

/** Écart-type « ±0,42 » (fr virgule), « — » si non mesuré. */
function stdText(sd: number | null): string {
  return sd === null ? '—' : `±${sd.toFixed(2).replace('.', ',')}`;
}

/** Énoncé lecteur d'écran de l'écart-type. */
function stdSpoken(sd: number | null): string {
  return sd === null ? 'non mesurée' : `${sd.toFixed(2).replace('.', ',')} seconde`;
}

/** Valeur absente → énoncé neutre pour lecteur d'écran. */
function spoken(value: string): string {
  return value === '—' ? 'non mesuré' : value;
}

function dayNumber(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : String(d.getDate());
}

function monthName(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { month: 'long' });
}

function capitalize(value: string): string {
  return value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

/**
 * Titre « {mois A} vs {mois B} » (maquette). Si les deux séances tombent le même
 * mois, on précise le jour pour rester lisible (« 4 juillet vs 18 juillet »).
 */
function periodTitle(isoA: string, isoB: string): string {
  const mA = monthName(isoA);
  const mB = monthName(isoB);
  if (mA === '—' || mB === '—') return 'Deux séances';
  if (mA !== mB) return `${capitalize(mA)} vs ${capitalize(mB)}`;
  return `${capitalize(`${dayNumber(isoA)} ${mA}`)} vs ${dayNumber(isoB)} ${mB}`;
}

const s = StyleSheet.create({
  // Console : largeur de lecture confortable, centrée (le rail est à gauche).
  consoleWidth: { width: '100%', maxWidth: 820, alignSelf: 'center' },

  // En-tête
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.creamMute,
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: palette.cream,
  },
  tag: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.eyebrow,
  },

  // Cartes-colonnes A / B
  headCards: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  headCard: { flex: 1 },
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headDay: {
    fontFamily: theme.fonts.king,
    fontSize: 26,
    letterSpacing: -0.5,
    color: palette.cream,
    fontVariant: ['tabular-nums'],
  },
  headMonth: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.4,
    color: palette.creamMute,
    marginTop: spacing.xs,
  },
  badge: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTxt: {
    fontFamily: theme.fonts.monoSemi,
    fontSize: 12,
    letterSpacing: 0.5,
    color: palette.night,
  },

  // Tableau factuel
  table: {
    borderTopWidth: 1,
    borderTopColor: palette.separator,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingVertical: spacing.lg,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: palette.separator,
  },
  rowValue: {
    flex: 1,
    fontFamily: theme.fonts.monoSemi,
    fontSize: 16,
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
  },
  rowLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1,
    color: palette.eyebrow,
  },

  closing: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    lineHeight: theme.fontSize.small * 1.6,
    color: palette.creamMute,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
});
