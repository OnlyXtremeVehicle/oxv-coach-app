/**
 * Écran #15 — Zoom virage.
 *
 * Vue détaillée d'un virage avec 3 éclairages doctrine :
 *   1. Trajectoire — votre tracé vs idéal (placeholder V1)
 *   2. Physique   — vitesse entrée, G_lat max, vitesse sortie (placeholder)
 *   3. Question   — une seule question ouverte, jamais d'instruction
 *
 * Navigation : boutons précédent/suivant entre les 14 virages. Le swipe
 * gestuel viendra en V1.1 (gesture-handler + reanimated, plus complexe).
 *
 * V1 : contenu placeholder — les vraies métriques par virage arrivent
 * sem 7-8 quand `margin_breakdown` portera les données par virage.
 */

import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { useEffect, useState } from 'react';

import { getCorner, nextCornerIndex, previousCornerIndex } from '@/lib/circuitTopology';
import { type SegmentAnalysisRow, getSegmentAnalysis } from '@/services/segmentAnalysesService';
import { type MarginZone, marginLabelOf, marginZoneOf } from '@/types/domain';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

export default function VirageScreen() {
  const params = useLocalSearchParams<{ index?: string; sessionId?: string }>();
  const cornerIndex = Number(params.index ?? '1');
  const corner = getCorner(cornerIndex);

  const [stats, setStats] = useState<SegmentAnalysisRow | null>(null);

  useEffect(() => {
    if (!params.sessionId || !corner) return;
    let cancelled = false;
    getSegmentAnalysis(params.sessionId, corner.index).then((s) => {
      if (!cancelled) setStats(s);
    });
    return () => {
      cancelled = true;
    };
  }, [params.sessionId, corner]);

  if (!corner) {
    return <VirageNotFound />;
  }

  const onPrev = () => {
    router.replace({
      pathname: '/(app)/virage',
      params: {
        index: String(previousCornerIndex(cornerIndex)),
        sessionId: params.sessionId ?? '',
      },
    });
  };

  const onNext = () => {
    router.replace({
      pathname: '/(app)/virage',
      params: {
        index: String(nextCornerIndex(cornerIndex)),
        sessionId: params.sessionId ?? '',
      },
    });
  };

  const zone: MarginZone =
    stats?.marginZone ??
    (stats?.marginPercent !== null && stats?.marginPercent !== undefined
      ? marginZoneOf(stats.marginPercent)
      : 'yellow');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>
          ZOOM VIRAGE {String(corner.index).padStart(2, '0')}
        </Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.md }]}>{corner.name}</Text>
        <Text
          style={[
            typography.caption,
            {
              color: colorForZone(zone),
              marginTop: spacing.sm,
              marginBottom: spacing.xxl,
            },
          ]}
        >
          {marginLabelOf(zone)}
          {stats?.marginPercent !== null && stats?.marginPercent !== undefined
            ? ` · ${Math.round(stats.marginPercent)}%`
            : ''}
        </Text>

        <Section eyebrow="TRAJECTOIRE" title="Votre tracé contre l'optimum">
          {stats?.avgLateralErrorM !== null && stats?.avgLateralErrorM !== undefined ? (
            <Text style={typography.body}>
              Écart latéral moyen au tracé de référence : {stats.avgLateralErrorM.toFixed(1)} m (max{' '}
              {stats.maxLateralErrorM?.toFixed(1) ?? '—'} m).
            </Text>
          ) : (
            <Text style={typography.body}>
              La trajectoire détaillée apparaîtra après votre première session enregistrée.
            </Text>
          )}
        </Section>

        <Section eyebrow="PHYSIQUE" title="Ce que la voiture a vécu">
          <StatRow
            label="Vitesse à l'entrée"
            value={stats?.entrySpeedKmh != null ? `${Math.round(stats.entrySpeedKmh)} km/h` : '—'}
          />
          <StatRow
            label="G latéral max"
            value={stats?.maxGLateral != null ? `${stats.maxGLateral.toFixed(2)} g` : '—'}
          />
          <StatRow
            label="Vitesse à la sortie"
            value={stats?.exitSpeedKmh != null ? `${Math.round(stats.exitSpeedKmh)} km/h` : '—'}
          />
          {!stats ? (
            <Text style={[typography.caption, { marginTop: spacing.md }]}>
              Stats disponibles après votre première session analysée.
            </Text>
          ) : null}
        </Section>

        <Section eyebrow="QUESTION" title="">
          <Text style={[typography.manifest, { textAlign: 'center', marginVertical: spacing.lg }]}>
            Était-ce volontaire&nbsp;?
          </Text>
        </Section>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: spacing.xxxl,
            gap: spacing.md,
          }}
        >
          <NavBtn label="‹ Précédent" onPress={onPrev} />
          <NavBtn label="Suivant ›" onPress={onNext} />
        </View>

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>
              Retour à la carte
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: spacing.xxxl }}>
      <Text style={[typography.eyebrow, { marginBottom: spacing.sm }]}>{eyebrow}</Text>
      {title ? (
        <Text
          style={{
            color: colors.text.primary,
            fontSize: fontSize.title,
            fontWeight: fontWeight.light,
            marginBottom: spacing.lg,
          }}
        >
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.border.subtle,
      }}
    >
      <Text style={{ color: colors.text.secondary, fontSize: fontSize.body }}>{label}</Text>
      <Text
        style={{
          color: colors.text.primary,
          fontSize: fontSize.body,
          fontWeight: fontWeight.regular,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function NavBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border.medium,
        alignItems: 'center',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color: colors.text.primary, fontSize: fontSize.caption }}>{label}</Text>
    </Pressable>
  );
}

function VirageNotFound() {
  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
      }}
    >
      <Text style={[typography.eyebrow, { marginBottom: spacing.md }]}>VIRAGE</Text>
      <Text style={[typography.screenTitle, { textAlign: 'center' }]}>Ce virage n'existe pas.</Text>
      <Pressable onPress={() => router.back()} style={{ marginTop: spacing.xxxl }}>
        <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>Retour</Text>
      </Pressable>
    </SafeAreaView>
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
