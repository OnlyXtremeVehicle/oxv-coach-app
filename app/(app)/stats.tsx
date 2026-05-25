/**
 * Écran #29 — Stats consolidées.
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
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useDetailLevel } from '@/hooks/useDetailLevel';
import { type PilotStats, loadPilotStats } from '@/services/statsService';
import { useAuthStore } from '@/store/useAuthStore';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

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
    loadPilotStats(profile.id).then((s) => {
      if (cancelled) return;
      setStats(s);
      setLoading(false);
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>VOS STATISTIQUES</Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.sm }]}>
          L'ensemble de votre histoire.
        </Text>
        <Text
          style={[typography.manifest, { color: colors.text.secondary, marginBottom: spacing.xxl }]}
        >
          Toutes vos sessions agrégées.
        </Text>

        {/* Toggle simple / détaillé */}
        {canToggle ? (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              marginBottom: spacing.md,
            }}
          >
            <Pressable accessibilityRole="button" onPress={toggle}>
              <Text
                style={{
                  color: colors.text.tertiary,
                  fontSize: fontSize.caption,
                  textDecorationLine: 'underline',
                }}
              >
                {level === 'simple' ? 'Voir les détails techniques' : 'Vue simplifiée'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {loading ? (
          <Text style={[typography.caption, { paddingVertical: spacing.lg }]}>Chargement…</Text>
        ) : !stats || stats.totalSessions === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* 3 chiffres centraux */}
            <View
              style={{
                flexDirection: 'row',
                gap: spacing.md,
                marginBottom: spacing.xxl,
              }}
            >
              <BigStat
                value={Math.round(stats.totalDistanceKm).toString()}
                unit="km"
                label="parcourus"
              />
              <BigStat
                value={stats.totalSessions.toString()}
                label={stats.totalSessions > 1 ? 'sessions' : 'session'}
              />
              <BigStat value={stats.totalLaps.toString()} label="tours" />
            </View>

            {/* Records */}
            <Section eyebrow="VOS RECORDS">
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
                />
              ) : null}
            </Section>

            {/* Par circuit */}
            {circuitList.length > 0 ? (
              <Section eyebrow="PAR CIRCUIT">
                <View style={{ gap: spacing.xs }}>
                  {circuitList.map((c) => (
                    <View
                      key={c.circuitName}
                      style={{
                        padding: spacing.md,
                        borderRadius: borderRadius.md,
                        borderWidth: 0.5,
                        borderColor: colors.border.subtle,
                        backgroundColor: colors.background.secondary,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.text.primary,
                          fontSize: fontSize.body,
                          fontWeight: fontWeight.regular,
                          marginBottom: spacing.xs,
                        }}
                      >
                        {c.circuitName}
                      </Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          gap: spacing.lg,
                        }}
                      >
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
                    </View>
                  ))}
                </View>
              </Section>
            ) : null}
          </>
        )}

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>Retour</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function BigStat({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <View
      style={{
        flex: 1,
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        borderWidth: 0.5,
        borderColor: colors.border.subtle,
        backgroundColor: colors.background.secondary,
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          color: colors.text.primary,
          fontSize: 32,
          fontWeight: fontWeight.light,
          fontFamily: 'Menlo',
        }}
      >
        {value}
        {unit ? (
          <Text
            style={{
              fontSize: fontSize.caption,
              color: colors.text.secondary,
              fontFamily: 'Menlo',
            }}
          >
            {' '}
            {unit}
          </Text>
        ) : null}
      </Text>
      <Text style={[typography.eyebrow, { color: colors.text.tertiary, marginTop: spacing.xs }]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

function Section({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.xxl }}>
      <Text style={[typography.eyebrow, { marginBottom: spacing.md }]}>{eyebrow}</Text>
      {children}
    </View>
  );
}

function Row({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.border.subtle,
      }}
    >
      <View>
        <Text style={{ color: colors.text.secondary, fontSize: fontSize.body }}>{label}</Text>
        {sublabel ? (
          <Text style={[typography.caption, { color: colors.text.tertiary, marginTop: 2 }]}>
            {sublabel}
          </Text>
        ) : null}
      </View>
      <Text
        style={{
          color: colors.text.primary,
          fontSize: fontSize.body,
          fontWeight: fontWeight.medium,
          fontFamily: 'Menlo',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function Inline({ label, value }: { label: string; value: string }) {
  return (
    <Text style={{ fontSize: fontSize.caption }}>
      <Text style={{ color: colors.text.primary, fontFamily: 'Menlo' }}>{value}</Text>
      <Text style={{ color: colors.text.tertiary }}> {label}</Text>
    </Text>
  );
}

function EmptyState() {
  return (
    <View
      style={{
        padding: spacing.xxl,
        borderRadius: borderRadius.lg,
        borderWidth: 0.5,
        borderColor: colors.border.subtle,
        backgroundColor: colors.background.secondary,
        alignItems: 'center',
      }}
    >
      <Text style={[typography.manifest, { color: colors.text.secondary, textAlign: 'center' }]}>
        Pas encore d'historique.
      </Text>
      <Text
        style={[
          typography.caption,
          { color: colors.text.tertiary, textAlign: 'center', marginTop: spacing.md },
        ]}
      >
        Vos statistiques s'enrichiront à chaque session sur piste.
      </Text>
    </View>
  );
}

function formatLapTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds - mins * 60;
  if (mins > 0) return `${mins}'${secs.toFixed(2).padStart(5, '0')}`;
  return `${secs.toFixed(2)} s`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours} h ${mins} min`;
  return `${mins} min`;
}
