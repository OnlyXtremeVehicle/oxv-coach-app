/**
 * Empreinte saison — zone Miroir, complément (maquette refonte-v2 §7bis `#5d`,
 * `17-empreinte-saison.png`).
 *
 * CONSTATS JUXTAPOSÉS par mois — JAMAIS une courbe d'évolution : chaque ligne
 * = mini-radar QDI du mois (médiane self-only, listMonthlyQdi) + label mois +
 * un fait court RÉEL (branche médiane la plus haute, nombre de séances lues).
 * Le dernier mois est accentué en violet ; un mois sans donnée est absent.
 *
 * L'héritage utile (PR-65b : résumé factuel de la saison, cadence, jalons) est
 * conservé DESSOUS, retravaillé au langage v2. Identité, pas performance :
 * aucun record, aucun rang. Sobre, vouvoiement, pas d'emoji.
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { EmptyState, Fact } from '@/components/instruments';
import { MiniQdiRadar } from '@/components/MiniQdiRadar';
import { FadeInSection } from '@/components/motion';
import { StoryMilestone } from '@/components/StoryMilestone';
import { type QdiBranches } from '@/services/qdiLogic';
import { listMonthlyQdi, type MonthlyQdi } from '@/services/qdiService';
import { buildSeasonStory } from '@/services/seasonStoryLogic';
import { fetchAllSessions } from '@/services/sessionsService';
import { useAuthStore } from '@/store/useAuthStore';
import { type TelemetrySession } from '@/types/telemetry';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { formatDateShort } from '@/utils/format';

const { palette, dataColors, fonts, fontSize, spacing, radius } = theme;

const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_NAMES = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

// Libellés des branches QDI (mêmes clés que qdiLogic — une couleur, une donnée).
const BRANCH_LABELS: { key: keyof QdiBranches; label: string }[] = [
  { key: 'trajectoire', label: 'Trajectoire' },
  { key: 'fluidite', label: 'Fluidité' },
  { key: 'freinage', label: 'Freinage' },
  { key: 'acceleration', label: 'Accélération' },
  { key: 'regularite', label: 'Régularité' },
];

/**
 * Fait court du mois : la branche dont la MÉDIANE mesurée est la plus haute
 * (self-only — la forme du radar, dite en mots). Null si aucune branche chiffrée.
 */
function monthHeadline(branches: QdiBranches): string | null {
  let best: string | null = null;
  let bestValue = -Infinity;
  for (const { key, label } of BRANCH_LABELS) {
    const v = branches[key];
    if (typeof v === 'number' && v > bestValue) {
      bestValue = v;
      best = label;
    }
  }
  return best ? `${best} au premier plan` : null;
}

interface SeasonMoment {
  dateLabel: string;
  circuit: string | null;
}

interface SeasonSummary {
  year: number;
  sessions: number;
  circuits: number;
  vehicles: number;
  laps: number;
  distanceKm: number;
  perMonth: number[]; // 12 entrées, index 0 = janvier
  firstSession: SeasonMoment | null;
  lastSession: SeasonMoment | null;
  busiestMonth: { monthLabel: string; count: number } | null;
}

function summarize(rows: TelemetrySession[], year: number): SeasonSummary {
  const perMonth = new Array(12).fill(0) as number[];
  const circuitNames = new Set<string>();
  const vehicleIds = new Set<string>();
  let laps = 0;
  let distanceKm = 0;
  for (const r of rows) {
    const d = new Date(r.started_at);
    if (!Number.isNaN(d.getTime())) perMonth[d.getMonth()] += 1;
    if (r.circuit_name) circuitNames.add(r.circuit_name);
    if (r.vehicle_id) vehicleIds.add(r.vehicle_id);
    laps += r.lap_count ?? 0;
    distanceKm += r.distance_km ?? 0;
  }

  // Fil chronologique : première et dernière séance datées de la saison.
  const dated = rows
    .filter((r) => !Number.isNaN(new Date(r.started_at).getTime()))
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
  const first = dated[0] ?? null;
  const last = dated.length > 0 ? dated[dated.length - 1] : null;
  const moment = (r: TelemetrySession | null): SeasonMoment | null =>
    r ? { dateLabel: formatDateShort(r.started_at), circuit: r.circuit_name || null } : null;

  // Mois le plus dense (mesure de soi, pas un rang).
  const maxCount = Math.max(0, ...perMonth);
  const busiestMonth =
    maxCount > 0 ? { monthLabel: MONTH_NAMES[perMonth.indexOf(maxCount)], count: maxCount } : null;

  return {
    year,
    sessions: rows.length,
    circuits: circuitNames.size,
    vehicles: vehicleIds.size,
    laps,
    distanceKm,
    perMonth,
    firstSession: moment(first),
    lastSession: moment(last),
    busiestMonth,
  };
}

export default function EmpreinteSaisonScreen() {
  const userId = useAuthStore((s) => s.profile?.id);
  const [summary, setSummary] = useState<SeasonSummary | null>(null);
  const [monthly, setMonthly] = useState<MonthlyQdi[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const now = new Date();
    const year = now.getFullYear();
    const yearStart = new Date(year, 0, 1).toISOString();
    Promise.all([
      fetchAllSessions(userId, { fromDate: yearStart, limit: 500 }),
      // Best-effort : les constats mensuels manquants ne cassent pas la saison.
      listMonthlyQdi(userId, 3).catch(() => [] as MonthlyQdi[]),
    ])
      .then(([rows, months]) => {
        if (cancelled) return;
        setSummary(summarize(rows, year));
        setMonthly(months);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useFocusEffect(reload);

  const sum = summary;
  const hasSeason = (sum?.sessions ?? 0) > 0;
  const maxMonth = sum ? Math.max(1, ...sum.perMonth) : 1;
  const story = sum
    ? buildSeasonStory({
        sessions: sum.sessions,
        circuits: sum.circuits,
        vehicles: sum.vehicles,
        firstSession: sum.firstSession,
        lastSession: sum.lastSession,
        busiestMonth: sum.busiestMonth,
      })
    : [];

  return (
    <Screen>
      <AppBar title="Empreinte saison" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        {/* Intro — transposée de la maquette (vouvoiement, jamais une courbe). */}
        <Text style={s.intro}>
          Chaque séance, posée à côté des autres. On ne trace pas de courbe — on regarde comment
          votre style se répète.
        </Text>

        {loading ? (
          <View style={{ paddingVertical: spacing.xxl, alignItems: 'center' }}>
            <ActivityIndicator color={palette.creamMute} accessibilityLabel="Chargement" />
          </View>
        ) : !hasSeason && monthly.length === 0 ? (
          <View style={{ marginTop: spacing.xl }}>
            <EmptyState
              label="Saison à écrire"
              message="Vos séances composeront ici votre empreinte — des lectures posées côte à côte."
              source="telemetry_sessions · app_session_analyses.qdi"
            />
          </View>
        ) : (
          <>
            {/* CONSTATS JUXTAPOSÉS — un mois par ligne : mini-radar (médiane
                réelle du mois) + fait court réel. Mois sans donnée : absent.
                Le dernier mois porte l'accent violet (maquette #5d). */}
            {monthly.length > 0 ? (
              <FadeInSection>
                <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
                  {monthly.map((m, i) => {
                    const isLast = i === monthly.length - 1;
                    const headline = monthHeadline(m.branches);
                    const fact = `${m.sessions} séance${m.sessions > 1 ? 's' : ''} lue${m.sessions > 1 ? 's' : ''}`;
                    return (
                      <View
                        key={m.monthKey}
                        style={[s.monthCard, isLast && s.monthCardLast]}
                        accessible
                        accessibilityLabel={`${m.monthLabel} : ${headline ? `${headline}, ` : ''}${fact}`}
                      >
                        {/* Libellé du mois en colonne à gauche du pentagone nu
                            (maquette #5d), surligné violet sur le dernier mois. */}
                        <Text style={[s.monthLabel, isLast && { color: dataColors.regularity }]}>
                          {m.monthLabel}
                        </Text>
                        <MiniQdiRadar
                          label={m.monthLabel}
                          branches={m.branches}
                          highlighted={isLast}
                          bare
                          accentColor={isLast ? dataColors.regularity : undefined}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={s.monthTitle}>{headline ?? fact}</Text>
                          {headline ? (
                            <Text style={[s.monthFact, isLast && { color: dataColors.regularity }]}>
                              {fact}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
                <Text style={s.caption}>
                  {monthly.length > 1
                    ? `${monthly.length} lectures côte à côte — jamais une note qui monte ou descend.`
                    : 'Une lecture posée — jamais une note qui monte ou descend.'}
                </Text>
              </FadeInSection>
            ) : null}

            {/* ── L'héritage utile, retravaillé v2 : la saison en faits. ──── */}
            <View style={s.separator} />
            <Text style={s.eyebrow}>VOTRE SAISON {sum?.year ?? new Date().getFullYear()}</Text>
            <Text style={s.title} accessibilityRole="header">
              L&apos;année, en faits.
            </Text>

            {sum && sum.sessions > 0 ? (
              <>
                {/* Chiffre dominant : les séances de la saison. */}
                <View
                  style={s.heroRow}
                  accessible
                  accessibilityLabel={`${sum.sessions} séance${sum.sessions > 1 ? 's' : ''} cette saison`}
                >
                  <Text style={s.hero}>{sum.sessions}</Text>
                  <Text style={s.heroLabel}>séance{sum.sessions > 1 ? 's' : ''} cette saison</Text>
                </View>

                <View style={[s.factRow, { marginTop: spacing.xl }]}>
                  <Fact label="Circuits" value={String(sum.circuits)} />
                  <Fact label="Tours" value={String(sum.laps)} />
                </View>
                <View style={[s.factRow, { marginTop: spacing.sm }]}>
                  <Fact
                    label="Distance"
                    value={sum.distanceKm > 0 ? String(Math.round(sum.distanceKm)) : '—'}
                    unit="km"
                  />
                  <Fact
                    label="Mois actifs"
                    value={String(sum.perMonth.filter((n) => n > 0).length)}
                  />
                </View>

                {/* Cadence mois par mois — des comptes de séances (densité),
                    pas une note qui monte ou descend. Crème neutre : l'or
                    reste au chrono/record. */}
                <View style={{ marginTop: spacing.xxl }}>
                  <SectionLabel>Votre cadence</SectionLabel>
                  <View
                    style={s.chart}
                    accessibilityRole="image"
                    accessibilityLabel={`Séances par mois : ${sum.perMonth
                      .map((n, i) => `${MONTH_INITIALS[i]} ${n}`)
                      .join(', ')}`}
                  >
                    {sum.perMonth.map((n, i) => (
                      <View key={i} style={s.col}>
                        <View style={s.track}>
                          <View
                            style={[
                              s.bar,
                              { height: n > 0 ? Math.max(3, (n / maxMonth) * 56) : 0 },
                            ]}
                          />
                        </View>
                        <Text style={s.colLabel}>{MONTH_INITIALS[i]}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Les jalons — les moments qui marquent le fil de la saison.
                    Des faits situés (soi contre soi), jamais un palmarès. */}
                {story.length > 0 ? (
                  <View style={{ marginTop: spacing.xxl }}>
                    <SectionLabel>Les jalons</SectionLabel>
                    <View style={{ marginTop: spacing.lg }}>
                      {story.map((m, i) => (
                        <StoryMilestone key={m.key} milestone={m} last={i === story.length - 1} />
                      ))}
                    </View>
                  </View>
                ) : null}

                <Text style={s.doctrine}>Votre saison, telle que mesurée. Pas un palmarès.</Text>
              </>
            ) : (
              /* Des constats mensuels existent (fenêtre glissante) mais l'année
                 civile en cours n'a pas encore de séance : on le dit. */
              <View style={{ marginTop: spacing.lg }}>
                <EmptyState
                  label="Saison à écrire"
                  message="Vos séances de l'année composeront ici votre empreinte de saison."
                  source="telemetry_sessions"
                />
              </View>
            )}
          </>
        )}
      </View>
    </Screen>
  );
}

const s = {
  intro: {
    fontFamily: fonts.body,
    fontSize: fontSize.bodyLg,
    lineHeight: fontSize.bodyLg * 1.5,
    color: palette.secondary,
    marginTop: spacing.sm,
  },
  // Carte d'un mois : surface card, hairline, accent gauche 2 px (violet sur
  // le dernier mois — maquette #5d).
  monthCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.lg,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
    borderLeftWidth: 2,
    borderLeftColor: palette.line,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
  },
  monthCardLast: {
    borderLeftColor: dataColors.regularity,
    backgroundColor: palette.card2,
  },
  // Libellé du mois en colonne gauche (mono, aligné) — pentagone nu à sa droite.
  monthLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
    width: 40,
  },
  monthTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: fontSize.bodyLg,
    letterSpacing: 0.2,
    color: palette.cream,
  },
  monthFact: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: 2,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.legend,
    textAlign: 'center' as const,
    marginTop: spacing.lg,
  },
  separator: {
    height: 1,
    backgroundColor: palette.separator,
    marginTop: spacing.xxl,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.eyebrow,
    marginTop: spacing.xxl,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.3,
    color: palette.cream,
    lineHeight: fontSize.h2 * 1.25,
    marginTop: spacing.md,
  },
  heroRow: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  hero: {
    fontFamily: fonts.king, // chiffre roi : mono, tabular (canon v2)
    fontSize: fontSize.hud,
    letterSpacing: -1,
    color: palette.cream,
  },
  heroLabel: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.creamMute,
    flex: 1,
  },
  factRow: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
  },
  chart: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  col: {
    flex: 1,
    alignItems: 'center' as const,
    gap: spacing.xs,
  },
  track: {
    height: 56,
    width: '100%' as const,
    justifyContent: 'flex-end' as const,
    alignItems: 'center' as const,
  },
  bar: {
    width: '70%' as const,
    borderRadius: 3,
    // Fréquence de séances (activité), pas un chrono → crème neutre.
    // L'or reste réservé au chrono/record (canon V3).
    backgroundColor: palette.creamMute,
  },
  colLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.4,
    color: palette.faint,
  },
  doctrine: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.small,
    fontStyle: 'italic' as const,
    color: palette.creamMute,
    textAlign: 'center' as const,
    marginTop: spacing.xxl,
  },
};
