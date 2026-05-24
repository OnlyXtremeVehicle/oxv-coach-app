/**
 * Écran #22 — Paddock entre runs.
 *
 * Pendant la session, entre deux runs (état S7 actif après un premier
 * roulage). Vue compacte du dernier run effectué + invitation à préparer
 * le suivant.
 *
 * Doctrine : *"À chaud, l'essentiel."* — pas le bilan complet, juste
 * l'indicateur principal pour ne pas surcharger entre deux tours.
 */

import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useSessionStore } from '@/store/useSessionStore';
import { marginZoneOf, marginLabelOf, type MarginZone } from '@/types/domain';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';
import { formatChronoMs } from '@/utils/time';

export default function EntreRunsScreen() {
  const lapCount = useSessionStore((s) => s.lapCount);
  const bestLapMs = useSessionStore((s) => s.bestLapMs);

  // Marge à chaud : pour V1, on prend une heuristique basée sur le
  // bestLapMs. À enrichir sem 12 avec la vraie marge live.
  const liveMargin = estimateLiveMargin(bestLapMs);
  const zone = marginZoneOf(liveMargin);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <View style={{ flex: 1, padding: spacing.xl }}>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>ENTRE RUNS</Text>
        <Text
          style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.xxxl }]}
        >
          À chaud, l'essentiel.
        </Text>

        <View
          style={{
            padding: spacing.xl,
            borderRadius: borderRadius.lg,
            borderWidth: 0.5,
            borderColor: colors.border.subtle,
            backgroundColor: colors.background.secondary,
            alignItems: 'center',
            marginBottom: spacing.xl,
          }}
        >
          <Text style={[typography.eyebrow, { marginBottom: spacing.md }]}>DERNIER RUN</Text>
          <Text
            style={{
              color: colorForZone(zone),
              fontSize: fontSize.hero,
              fontWeight: fontWeight.ultralight,
              marginBottom: spacing.sm,
            }}
          >
            {Math.round(liveMargin)}%
          </Text>
          <Text
            style={{
              color: colorForZone(zone),
              fontSize: fontSize.title,
              fontWeight: fontWeight.light,
            }}
          >
            {marginLabelOf(zone)}
          </Text>
        </View>

        <View
          style={{
            flexDirection: 'row',
            gap: spacing.md,
            marginBottom: spacing.xxxl,
          }}
        >
          <StatCard label="Tours" value={String(lapCount)} />
          <StatCard label="Meilleur" value={bestLapMs !== null ? formatChronoMs(bestLapMs) : '—'} />
        </View>

        <View style={{ flex: 1 }} />

        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/(app)/equipement')}
          style={({ pressed }) => ({
            height: 52,
            borderRadius: borderRadius.lg,
            backgroundColor: colors.accent.red,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text
            style={{
              color: colors.text.primary,
              fontSize: fontSize.body,
              fontWeight: fontWeight.medium,
              letterSpacing: 0.5,
            }}
          >
            Préparer le prochain run
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
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
          fontSize: fontSize.titleLarge,
          fontWeight: fontWeight.ultralight,
          marginBottom: spacing.xs,
        }}
      >
        {value}
      </Text>
      <Text style={[typography.caption, { textAlign: 'center' }]}>{label}</Text>
    </View>
  );
}

function colorForZone(zone: MarginZone): string {
  switch (zone) {
    case 'green':
      return colors.margin.green;
    case 'yellow':
      return colors.margin.yellow;
    case 'red':
      return colors.margin.red;
  }
}

/**
 * Estimation grossière de marge à chaud — V1 sans algo live. Une vraie
 * marge incrémentale viendra sem 12 quand le module trackviz alimentera
 * `useSessionStore` en stats live.
 */
function estimateLiveMargin(bestLapMs: number | null): number {
  if (bestLapMs === null) return 50;
  return 35;
}
