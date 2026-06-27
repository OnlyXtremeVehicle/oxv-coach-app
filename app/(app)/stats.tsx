/**
 * Écran #29 — Stats consolidées. Transposition gaming (cockpit factuel).
 *
 * Agrégation de toutes les sessions du pilote :
 *   - 3 chiffres centraux : km totaux, sessions, tours (cellules cockpit,
 *     valeurs à lueur dorée)
 *   - Records (meilleur tour, vitesse max) + liste par circuit
 *
 * Mode SIMPLE (pilote particulier) : 3 grands chiffres + liste compacte.
 * Mode DÉTAILLÉ (coach / admin / curieux) : temps total piste, marge moyenne.
 *
 * Gaming : barre de statut (point posé — tout-temps, pas live), agrégats à
 * lueur dorée, meilleurs tours en or, boîtiers cockpit. L'or = la donnée,
 * jamais le jugement.
 *
 * Doctrine : pas de classement entre pilotes, juste ses propres stats.
 */

import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { cockpitPanel } from '@/components/insights/vizChrome';
import { useDetailLevel } from '@/hooks/useDetailLevel';
import { type PilotStats, loadPilotStats } from '@/services/statsService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { AppBar } from '@/ui/AppBar';
import { formatDuration, formatLapTime } from '@/utils/format';

const GOLD = theme.palette.gold;

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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                level === 'simple' ? 'Voir les détails techniques' : 'Revenir à la vue simplifiée'
              }
              accessibilityState={{ expanded: level === 'detailed' }}
              hitSlop={theme.hitSlop}
              onPress={toggle}
              style={({ pressed }) => [s.linkPress, pressed && { opacity: 0.6 }]}
            >
              <Text style={s.link}>
                {level === 'simple' ? 'Voir les détails techniques' : 'Vue simplifiée'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {loading ? (
          <View style={s.loading}>
            <ActivityIndicator color={theme.palette.creamMute} />
          </View>
        ) : !stats || stats.totalSessions === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Panneau cockpit : statut + 3 agrégats à lueur dorée */}
            <View style={[s.panel, { marginBottom: theme.spacing.xl }]}>
              <View style={s.status}>
                <View style={s.dot} />
                <Text style={s.statusLabel}>Votre histoire · tout temps</Text>
              </View>
              <View style={s.statRow}>
                <StatCell
                  value={Math.round(stats.totalDistanceKm).toString()}
                  unit="km"
                  label="parcourus"
                />
                <StatCell
                  value={stats.totalSessions.toString()}
                  label={stats.totalSessions > 1 ? 'sessions' : 'session'}
                />
                <StatCell value={stats.totalLaps.toString()} label="tours" />
              </View>
            </View>

            {/* Records */}
            <View style={{ marginBottom: theme.spacing.xl, gap: theme.spacing.sm }}>
              <SectionLabel>Vos records</SectionLabel>
              <View style={s.panel}>
                <Row
                  label="Meilleur tour"
                  value={stats.bestLapSeconds !== null ? formatLapTime(stats.bestLapSeconds) : '—'}
                  sublabel={stats.bestLapCircuitName ?? undefined}
                  accent
                />
                {stats.maxSpeedKmh !== null ? (
                  <Row
                    label="Vitesse max"
                    value={`${Math.round(stats.maxSpeedKmh)} km/h`}
                    last={!(level === 'detailed' && stats.totalDurationSeconds > 0)}
                  />
                ) : null}
                {level === 'detailed' && stats.totalDurationSeconds > 0 ? (
                  <Row
                    label="Temps total en piste"
                    value={formatDuration(stats.totalDurationSeconds)}
                    last
                  />
                ) : null}
              </View>
            </View>

            {/* Par circuit */}
            {circuitList.length > 0 ? (
              <View style={{ marginBottom: theme.spacing.xl, gap: theme.spacing.sm }}>
                <SectionLabel>Par circuit</SectionLabel>
                {circuitList.map((c) => (
                  <View key={c.circuitName} style={s.circuitCard}>
                    <Text style={s.circuitName}>{c.circuitName}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.lg }}>
                      <Inline
                        label={c.sessionCount > 1 ? 'sessions' : 'session'}
                        value={c.sessionCount.toString()}
                      />
                      <Inline label="tours" value={c.lapCount.toString()} />
                      <Inline label="km" value={Math.round(c.distanceKm).toString()} />
                      {c.bestLapSeconds !== null ? (
                        <Inline label="meilleur" value={formatLapTime(c.bestLapSeconds)} accent />
                      ) : null}
                      {level === 'detailed' && c.avgMarginPercent !== null ? (
                        <Inline label="marge moy" value={`${Math.round(c.avgMarginPercent)} %`} />
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}

function StatCell({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <View style={s.cell}>
      <Text style={s.cellValue}>
        {value}
        {unit ? <Text style={s.cellUnit}> {unit}</Text> : null}
      </Text>
      <Text style={s.cellLabel}>{label}</Text>
    </View>
  );
}

function Row({
  label,
  value,
  sublabel,
  last,
  accent,
}: {
  label: string;
  value: string;
  sublabel?: string;
  last?: boolean;
  accent?: boolean;
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
      <Text style={[s.rowValue, accent ? { color: GOLD } : null]}>{value}</Text>
    </View>
  );
}

function Inline({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Text style={s.inline}>
      <Text style={[s.inlineValue, accent ? { color: GOLD } : null]}>{value}</Text>
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
  linkPress: {
    minHeight: 44,
    justifyContent: 'center' as const,
    paddingHorizontal: theme.spacing.sm,
  },
  link: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.palette.creamMute,
    textDecorationLine: 'underline' as const,
  },
  loading: {
    alignItems: 'center' as const,
    paddingVertical: theme.spacing.xxl,
  },
  panel: {
    ...cockpitPanel,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
  },
  status: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GOLD,
    shadowColor: GOLD,
    shadowOpacity: 0.8,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  statusLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
    color: GOLD,
  },
  statRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
  },
  cell: {
    flex: 1,
    alignItems: 'center' as const,
  },
  cellValue: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.display,
    letterSpacing: -0.5,
    color: theme.palette.cream,
    textShadowColor: 'rgba(255,183,3,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  cellUnit: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.bodyLg,
    color: GOLD,
  },
  cellLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  circuitCard: {
    backgroundColor: theme.palette.card2,
    borderColor: theme.palette.line,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  circuitName: {
    fontFamily: theme.fonts.display,
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
