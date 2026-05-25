/**
 * Écran #14 — Carte du circuit (bilan post-session).
 *
 * Refactor sem 16 : utilise CircuitMap PilotPreset avec animation
 * d'entrée + trajectoire GPS réelle du pilote superposée au tracé
 * officiel + 7 virages coloriés par sa marge.
 *
 * Tap sur un virage → écran #15 Zoom virage.
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { PilotPreset, type TrajectoryPoint } from '@/components/CircuitMap';
import { supabase } from '@/lib/supabase';
import { BELTOISE_CORNERS, mockCornerMargins } from '@/lib/circuitTopology';
import { type Circuit, getDefaultCircuit } from '@/services/circuitsService';
import { getCornerMarginsZones } from '@/services/segmentAnalysesService';
import { type MarginZone } from '@/types/domain';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

export default function CarteScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const [circuit, setCircuit] = useState<Circuit | null>(null);
  const [liveMargins, setLiveMargins] = useState<Record<number, MarginZone> | null>(null);
  const [trajectory, setTrajectory] = useState<TrajectoryPoint[] | null>(null);
  const [selectedCorner, setSelectedCorner] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDefaultCircuit().then((c) => {
      if (!cancelled) setCircuit(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Charge les vraies marges + la trajectoire GPS si on a un sessionId
  useEffect(() => {
    if (!params.sessionId) return;
    const sessionId = params.sessionId; // narrow avant closures async
    let cancelled = false;

    getCornerMarginsZones(sessionId).then((res) => {
      if (!cancelled && res) setLiveMargins(res.zones);
    });

    // Charge les premiers 1000 frames de la session pour la trajectoire
    // (downsampling implicite : sufficient pour rendu SVG fluide)
    (async () => {
      const { data } = await supabase
        .from('telemetry_frames')
        .select('latitude, longitude, speed_kmh')
        .eq('session_id', sessionId)
        .order('elapsed_ms', { ascending: true })
        .limit(1000);
      if (cancelled || !data) return;
      const points: TrajectoryPoint[] = (
        data as { latitude: number | null; longitude: number | null; speed_kmh: number | null }[]
      )
        .filter((p) => p.latitude !== null && p.longitude !== null)
        .map((p) => ({
          lat: Number(p.latitude),
          lon: Number(p.longitude),
          speed: p.speed_kmh !== null ? Number(p.speed_kmh) : null,
        }));
      if (points.length > 1) setTrajectory(points);
    })();

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

        <PilotPreset
          animate
          trajectory={trajectory ?? undefined}
          trajectoryColorMode="uniform"
          zoneByIndex={margins}
          selectedIndex={selectedCorner}
          height={360}
        />

        <Text style={[typography.caption, { marginTop: spacing.lg, marginBottom: spacing.lg }]}>
          {BELTOISE_CORNERS.length} virages — tap pour zoomer
        </Text>

        {/* Liste tappable des virages */}
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
                <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>›</Text>
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
