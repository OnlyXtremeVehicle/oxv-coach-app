/**
 * Écran #14 — Carte du circuit.
 *
 * Trace SVG du circuit Beltoise + 14 pastilles colorées sur les virages.
 * V1 : marges par virage = mock reproductible (basé sur sessionId), faute
 * d'avoir `margin_breakdown` par virage en base. Sem 7+ : vraie data.
 *
 * Les pastilles sont des Pressables RN superposées au SVG via positionnement
 * absolu (pourcentages calculés depuis svgX/svgY et le viewBox connu).
 * Plus robuste que `onPress` direct sur `<Circle>` qui est capricieux sur
 * Android.
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { router, useLocalSearchParams } from 'expo-router';

import {
  BELTOISE_CORNERS,
  BELTOISE_SVG_VIEWBOX,
  type CornerTopology,
  mockCornerMargins,
} from '@/lib/circuitTopology';
import { type Circuit, getDefaultCircuit } from '@/services/circuitsService';
import { type MarginZone } from '@/types/domain';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

export default function CarteScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const [circuit, setCircuit] = useState<Circuit | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getDefaultCircuit().then((c) => {
      if (!cancelled) {
        setCircuit(c);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const margins = mockCornerMargins(params.sessionId ?? 'demo');

  const onCornerTap = (index: number) => {
    router.push({
      pathname: '/(app)/virage',
      params: {
        index: String(index),
        sessionId: params.sessionId ?? '',
      },
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>CARTE DU CIRCUIT</Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.xl }]}>
          {circuit?.name ?? 'Haute Saintonge'}
        </Text>

        <View
          style={{
            width: '100%',
            aspectRatio: BELTOISE_SVG_VIEWBOX.width / BELTOISE_SVG_VIEWBOX.height,
            backgroundColor: colors.background.secondary,
            borderRadius: borderRadius.lg,
            borderWidth: 0.5,
            borderColor: colors.border.subtle,
            overflow: 'hidden',
            marginBottom: spacing.xl,
          }}
        >
          {circuit?.trackSvgPath ? (
            <Svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${BELTOISE_SVG_VIEWBOX.width} ${BELTOISE_SVG_VIEWBOX.height}`}
            >
              <Path
                d={circuit.trackSvgPath}
                stroke={colors.text.secondary}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          ) : loading ? null : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={typography.caption}>Tracé indisponible</Text>
            </View>
          )}

          {/* Pastilles superposées via positionnement absolu en % du viewBox */}
          {BELTOISE_CORNERS.map((corner) => (
            <CornerPin
              key={corner.index}
              corner={corner}
              zone={margins[corner.index]}
              onPress={() => onCornerTap(corner.index)}
            />
          ))}
        </View>

        <Text style={[typography.caption, { marginBottom: spacing.lg }]}>
          14 virages — tap pour zoomer
        </Text>

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>
              Retour au bilan
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CornerPin({
  corner,
  zone,
  onPress,
}: {
  corner: CornerTopology;
  zone: MarginZone | undefined;
  onPress: () => void;
}) {
  const xPct = (corner.svgX / BELTOISE_SVG_VIEWBOX.width) * 100;
  const yPct = (corner.svgY / BELTOISE_SVG_VIEWBOX.height) * 100;
  const color = colorForZone(zone ?? 'green');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        position: 'absolute',
        left: `${xPct}%`,
        top: `${yPct}%`,
        marginLeft: -18,
        marginTop: -18,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: color,
        borderWidth: 2,
        borderColor: colors.background.primary,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale: pressed ? 0.92 : 1 }],
      })}
    >
      <Text
        style={{
          color: colors.background.primary,
          fontSize: 11,
          fontWeight: fontWeight.semibold,
        }}
      >
        {corner.index}
      </Text>
    </Pressable>
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
