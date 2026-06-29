/**
 * Empreinte de saison (PR-65b, maquette 70.3) — zone Progression.
 *
 * Le résumé FACTUEL de votre saison en cours (année civile) : séances, circuits,
 * tours, distance, et la cadence mois par mois. Dérivé des séances de l'année —
 * zéro schéma, aucune table saisonnière. Identité, pas performance : aucun record,
 * aucun rang, aucun palmarès. Sobre, vouvoiement, pas d'emoji.
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { EmptyState, Fact } from '@/components/instruments';
import { fetchAllSessions } from '@/services/sessionsService';
import { useAuthStore } from '@/store/useAuthStore';
import { type TelemetrySession } from '@/types/telemetry';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

interface SeasonSummary {
  year: number;
  sessions: number;
  circuits: number;
  laps: number;
  distanceKm: number;
  perMonth: number[]; // 12 entrées, index 0 = janvier
}

function summarize(rows: TelemetrySession[], year: number): SeasonSummary {
  const perMonth = new Array(12).fill(0) as number[];
  const circuitNames = new Set<string>();
  let laps = 0;
  let distanceKm = 0;
  for (const r of rows) {
    const d = new Date(r.started_at);
    if (!Number.isNaN(d.getTime())) perMonth[d.getMonth()] += 1;
    if (r.circuit_name) circuitNames.add(r.circuit_name);
    laps += r.lap_count ?? 0;
    distanceKm += r.distance_km ?? 0;
  }
  return {
    year,
    sessions: rows.length,
    circuits: circuitNames.size,
    laps,
    distanceKm,
    perMonth,
  };
}

export default function EmpreinteSaisonScreen() {
  const userId = useAuthStore((s) => s.profile?.id);
  const [summary, setSummary] = useState<SeasonSummary | null>(null);
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
    fetchAllSessions(userId, { fromDate: yearStart, limit: 500 })
      .then((rows) => {
        if (!cancelled) {
          setSummary(summarize(rows, year));
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useFocusEffect(reload);

  const hasData = (summary?.sessions ?? 0) > 0;
  const maxMonth = summary ? Math.max(1, ...summary.perMonth) : 1;

  return (
    <Screen>
      <AppBar title="EMPREINTE DE SAISON" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>VOTRE SAISON {summary?.year ?? new Date().getFullYear()}</Text>
        <Text style={s.title} accessibilityRole="header">
          L&apos;année, en faits.
        </Text>

        {loading ? (
          <View style={{ paddingVertical: theme.spacing.xxl, alignItems: 'center' }}>
            <ActivityIndicator color={theme.palette.creamMute} accessibilityLabel="Chargement" />
          </View>
        ) : !hasData ? (
          <View style={{ marginTop: theme.spacing.xl }}>
            <EmptyState
              label="Saison à écrire"
              message="Vos séances de l'année composeront ici votre empreinte de saison."
            />
          </View>
        ) : (
          <>
            {/* Chiffre dominant : les séances de la saison. */}
            <View style={s.heroRow}>
              <Text style={s.hero}>{summary!.sessions}</Text>
              <Text style={s.heroLabel}>séance{summary!.sessions > 1 ? 's' : ''} cette saison</Text>
            </View>

            <View style={[s.factRow, { marginTop: theme.spacing.xl }]}>
              <Fact label="Circuits" value={String(summary!.circuits)} />
              <Fact label="Tours" value={String(summary!.laps)} />
            </View>
            <View style={[s.factRow, { marginTop: theme.spacing.sm }]}>
              <Fact
                label="Distance"
                value={summary!.distanceKm > 0 ? String(Math.round(summary!.distanceKm)) : '—'}
                unit="km"
              />
              <Fact
                label="Mois actifs"
                value={String(summary!.perMonth.filter((n) => n > 0).length)}
              />
            </View>

            {/* Cadence mois par mois — un rythme, jamais une course. */}
            <View style={{ marginTop: theme.spacing.xxl }}>
              <SectionLabel>Votre cadence</SectionLabel>
              <View
                style={s.chart}
                accessibilityRole="image"
                accessibilityLabel={`Séances par mois : ${summary!.perMonth
                  .map((n, i) => `${MONTH_INITIALS[i]} ${n}`)
                  .join(', ')}`}
              >
                {summary!.perMonth.map((n, i) => (
                  <View key={i} style={s.col}>
                    <View style={s.track}>
                      <View
                        style={[s.bar, { height: n > 0 ? Math.max(3, (n / maxMonth) * 56) : 0 }]}
                      />
                    </View>
                    <Text style={s.colLabel}>{MONTH_INITIALS[i]}</Text>
                  </View>
                ))}
              </View>
            </View>

            <Text style={s.doctrine}>Votre saison, telle que mesurée. Pas un palmarès.</Text>
          </>
        )}
      </View>
    </Screen>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
    marginTop: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
    marginTop: theme.spacing.md,
  },
  heroRow: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
  },
  hero: {
    fontFamily: theme.fonts.display,
    fontSize: 56,
    letterSpacing: -1,
    color: theme.palette.cream,
  },
  heroLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamMute,
    flex: 1,
  },
  factRow: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
  },
  chart: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.xs,
    marginTop: theme.spacing.md,
  },
  col: {
    flex: 1,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
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
    backgroundColor: theme.palette.gold, // or = donnée
  },
  colLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.4,
    color: theme.palette.faint,
  },
  doctrine: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.small,
    fontStyle: 'italic' as const,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.xxl,
  },
};
