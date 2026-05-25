/**
 * Écran #14 — Carte du circuit.
 *
 * Affiche le tracé réel du circuit Beltoise (depuis OSM, sem 16) avec
 * les 7 virages coloriés selon la marge du pilote sur la session
 * courante. Utilise le composant CircuitInspector partagé (sem 12)
 * qui projette les coordonnées GPS réelles en SVG.
 *
 * Tap sur un virage → écran #15 Zoom virage.
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { CircuitInspector } from '@/components/CircuitInspector';
import { BELTOISE_CORNERS } from '@/lib/circuitTopology';
import { type Circuit, getDefaultCircuit } from '@/services/circuitsService';
import { getCornerMarginsZones } from '@/services/segmentAnalysesService';
import { mockCornerMargins } from '@/lib/circuitTopology';
import { type MarginZone } from '@/types/domain';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

export default function CarteScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const [circuit, setCircuit] = useState<Circuit | null>(null);
  const [, setLoading] = useState(true);
  const [liveMargins, setLiveMargins] = useState<Record<number, MarginZone> | null>(null);
  const [selectedCorner, setSelectedCorner] = useState<number | null>(null);

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

  // Si on a un sessionId réel, on tente de charger les vraies marges
  // par virage depuis app_segment_analyses. Sinon, fallback sur le mock.
  useEffect(() => {
    if (!params.sessionId) return;
    let cancelled = false;
    getCornerMarginsZones(params.sessionId).then((res) => {
      if (!cancelled && res) setLiveMargins(res.zones);
    });
    return () => {
      cancelled = true;
    };
  }, [params.sessionId]);

  const margins = liveMargins ?? mockCornerMargins(params.sessionId ?? 'demo');

  const onCornerTap = (index: number) => {
    setSelectedCorner(index);
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

        <CircuitInspector
          selectedIndex={selectedCorner}
          colorMode="zone"
          zoneByIndex={margins}
          height={360}
        />

        <Text style={[typography.caption, { marginTop: spacing.lg, marginBottom: spacing.lg }]}>
          {BELTOISE_CORNERS.length} virages — tap pour zoomer
        </Text>

        {/* Liste des virages avec tap direct (alternative au SVG pour
            l'accessibilité des écrans tactiles plus petits) */}
        <View style={{ gap: spacing.xs }}>
          {BELTOISE_CORNERS.map((corner) => {
            const zone = margins[corner.index] ?? 'green';
            return (
              <Pressable
                accessibilityRole="button"
                key={corner.index}
                onPress={() => onCornerTap(corner.index)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  padding: spacing.md,
                  borderRadius: borderRadius.md,
                  borderWidth: 0.5,
                  borderColor: colors.border.subtle,
                  backgroundColor: colors.background.secondary,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: colorForZone(zone),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: colors.background.primary,
                      fontSize: 13,
                      fontWeight: fontWeight.semibold,
                    }}
                  >
                    {corner.index}
                  </Text>
                </View>
                <Text
                  style={{
                    flex: 1,
                    color: colors.text.primary,
                    fontSize: fontSize.body,
                    fontWeight: fontWeight.regular,
                  }}
                >
                  {corner.name}
                </Text>
                <Text
                  style={{
                    color: colors.text.tertiary,
                    fontSize: fontSize.caption,
                  }}
                >
                  ›
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>
              Retour au bilan
            </Text>
          </Pressable>
        </View>
      </ScrollView>
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
