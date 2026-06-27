/**
 * Écran #29 — Stats consolidées. Design V2 (charte oxv-mirror-app).
 *
 * Agrégation de toutes les sessions du pilote :
 *   - 3 chiffres centraux : km totaux, sessions, meilleur tour all-time
 *   - Liste par circuit (sessions, tours, meilleur tour)
 *
 * Mode SIMPLE (pilote particulier) :
 *   - 3 grands chiffres avec unités
 *   - Liste circuits compacte
 *
 * Mode DÉTAILLÉ (coach / admin / pilote curieux) :
 *   - Stats supplémentaires : temps total piste, vitesse max all-time,
 *     marge moyenne par circuit
 *
 * Doctrine : pas de classement entre pilotes, juste ses propres stats.
 *
 * Reskin V2 : Screen + AppBar, Card/SectionLabel/Fact du kit.
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { useDetailLevel } from '@/hooks/useDetailLevel';
import { type PilotStats, loadPilotStats } from '@/services/statsService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Fact } from '@/ui/Fact';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { formatDuration, formatLapTime } from '@/utils/format';

export default function StatsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const [stats, setStats] = useState<PilotStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { level, toggle, canToggle } = useDetailLevel();

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    loadPilotStats(profile.id)
      .then((s) => {
        if (cancelled) return;
        setStats(s);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const circuitList = useMemo(() => {
    if (!stats) return [];
    return Object.values(stats.byCircuit).sort((a, b) => b.sessionCount - a.sessionCount);
  }, [stats]);

  return (
    <Screen>
      <AppBar title="STATISTIQUES" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.title}>L&apos;ensemble de votre histoire.</Text>
        <Text style={s.manifest}>Toutes vos sessions agrégées.</Text>

        {/* Toggle simple / détaillé */}
        {canToggle ? (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              marginBottom: theme.spacing.md,
            }}
          >
            <Pressable accessibilityRole="button" onPress={toggle}>
              <Text style={s.link}>
                {level === 'simple' ? 'Voir les détails techniques' : 'Vue simplifiée'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {loading ? (
          <Text style={s.loading}>Chargement…</Text>
        ) : !stats || stats.totalSessions === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* 3 chiffres centraux */}
            <View
              style={{
                flexDirection: 'row',
                gap: theme.spacing.sm,
                marginBottom: theme.spacing.xl,
              }}
            >
              <Fact
                value={Math.round(stats.totalDistanceKm).toString()}
                unit="km"
                label="parcourus"
              />
              <Fact
                value={stats.totalSessions.toString()}
                label={stats.totalSessions > 1 ? 'sessions' : 'session'}
              />
              <Fact value={stats.totalLaps.toString()} label="tours" />
            </View>

            {/* Records */}
            <View style={{ marginBottom: theme.spacing.xl, gap: theme.spacing.sm }}>
              <SectionLabel>Vos records</SectionLabel>
              <Card>
                <Row
                  label="Meilleur tour"
                  value={stats.bestLapSeconds !== null ? formatLapTime(stats.bestLapSeconds) : '—'}
                  sublabel={stats.bestLapCircuitName ?? undefined}
                />
                {stats.maxSpeedKmh !== null ? (
                  <Row label="Vitesse max" value={`${Math.round(stats.maxSpeedKmh)} km/h`} />
                ) : null}
                {level === 'detailed' && stats.totalDurationSeconds > 0 ? (
                  <Row
                    label="Temps total en piste"
                    value={formatDuration(stats.totalDurationSeconds)}
                    last
                  />
                ) : null}
              </Card>
            </View>

            {/* Par circuit */}
            {circuitList.length > 0 ? (
              <View style={{ marginBottom: theme.spacing.xl, gap: theme.spacing.sm }}>
                <SectionLabel>Par circuit</SectionLabel>
                {circuitList.map((c) => (
                  <Card key={c.circuitName}>
                    <Text style={s.circuitName}>{c.circuitName}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.lg }}>
                      <Inline
                        label={c.sessionCount > 1 ? 'sessions' : 'session'}
                        value={c.sessionCount.toString()}
                      />
                      <Inline label="tours" value={c.lapCount.toString()} />
                      <Inline label="km" value={Math.round(c.distanceKm).toString()} />
                      {c.bestLapSeconds !== null ? (
                        <Inline label="meilleur" value={formatLapTime(c.bestLapSeconds)} />
                      ) : null}
                      {level === 'detailed' && c.avgMarginPercent !== null ? (
                        <Inline label="marge moy" value={`${Math.round(c.avgMarginPercent)} %`} />
                      ) : null}
                    </View>
                  </Card>
                ))}
              </View>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}

function Row({
  label,
  value,
  sublabel,
  last,
}: {
  label: string;
  value: string;
  sublabel?: string;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: theme.spacing.sm,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.palette.line,
      }}
    >
      <View>
        <Text style={s.rowLabel}>{label}</Text>
        {sublabel ? <Text style={s.rowSub}>{sublabel}</Text> : null}
      </View>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

function Inline({ label, value }: { label: string; value: string }) {
  return (
    <Text style={s.inline}>
      <Text style={s.inlineValue}>{value}</Text>
      <Text style={s.inlineLabel}> {label}</Text>
    </Text>
  );
}

function EmptyState() {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.xxl }}>
      <Text style={s.emptyTitle}>Pas encore d&apos;historique.</Text>
      <Text style={s.emptyHint}>
        Vos statistiques s&apos;enrichiront à chaque session sur piste.
      </Text>
    </Card>
  );
}

const s = {
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  manifest: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    color: theme.palette.creamSoft,
    marginBottom: theme.spacing.xl,
  },
  link: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.palette.creamMute,
    textDecorationLine: 'underline' as const,
  },
  loading: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    paddingVertical: theme.spacing.lg,
  },
  circuitName: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
    marginBottom: theme.spacing.sm,
  },
  rowLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamSoft,
  },
  rowSub: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginTop: 2,
  },
  rowValue: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  inline: { fontSize: theme.fontSize.small },
  inlineValue: { fontFamily: theme.fonts.mono, color: theme.palette.cream },
  inlineLabel: { fontFamily: theme.fonts.body, color: theme.palette.creamMute },
  emptyTitle: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    color: theme.palette.creamSoft,
    textAlign: 'center' as const,
  },
  emptyHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.sm,
  },
};
