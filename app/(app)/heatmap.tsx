/**
 * Écran Carte de chaleur — pilier §3.4 du cahier OXV Mirror.
 *
 * Visualisation PURE : la vitesse projetée en couleurs le long du tracé
 * réel. Rouge = vitesse basse, jaune = moyenne, vert = élevée. Zéro mot,
 * zéro note : la donnée rendue visible. « Le miroir le plus littéral. »
 *
 * Réutilise PilotPreset + TrajectoryLayer (mode speed-heatmap) déjà en
 * place. Charge les telemetry_frames de la session (RLS owner).
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { PilotPreset, type TrajectoryPoint } from '@/components/CircuitMap';
import { type BrakingMarker } from '@/components/CircuitMap';
import { supabase } from '@/lib/supabase';
import { detectBrakingPoints } from '@/services/brakingPointsService';
import { useAuthStore } from '@/store/useAuthStore';
import { borderRadius, colors, fontSize, spacing, typography } from '@/theme/tokens';

export default function HeatmapScreen() {
  const profile = useAuthStore((s) => s.profile);
  const params = useLocalSearchParams<{ sessionId?: string }>();

  const [trajectory, setTrajectory] = useState<TrajectoryPoint[] | null>(null);
  const [brakingPoints, setBrakingPoints] = useState<BrakingMarker[]>([]);
  const [stats, setStats] = useState<{ min: number; max: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      let sessionId = params.sessionId;
      if (!sessionId) {
        const { data: row } = await supabase
          .from('telemetry_sessions')
          .select('id')
          .eq('user_id', profile.id)
          .eq('status', 'completed')
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        sessionId = (row as { id?: string } | null)?.id;
      }
      if (!sessionId || cancelled) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('telemetry_frames')
        .select('latitude, longitude, speed_kmh')
        .eq('session_id', sessionId)
        .order('elapsed_ms', { ascending: true })
        .limit(1000);
      if (cancelled || !data) {
        setLoading(false);
        return;
      }

      const points: TrajectoryPoint[] = (
        data as { latitude: number | null; longitude: number | null; speed_kmh: number | null }[]
      )
        .filter((p) => p.latitude !== null && p.longitude !== null)
        .map((p) => ({
          lat: Number(p.latitude),
          lon: Number(p.longitude),
          speed: p.speed_kmh !== null ? Number(p.speed_kmh) : null,
        }));

      if (points.length > 1) {
        setTrajectory(points);
        // Pilier §3.4 : points de freinage projetés sur le tracé.
        setBrakingPoints(
          detectBrakingPoints(points).map((bp) => ({
            lat: bp.lat,
            lon: bp.lon,
            intensity: bp.intensity,
          }))
        );
        const speeds = points
          .map((p) => p.speed)
          .filter((s): s is number => typeof s === 'number' && Number.isFinite(s));
        if (speeds.length > 0) {
          setStats({ min: Math.min(...speeds), max: Math.max(...speeds) });
        }
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [profile, params.sessionId]);

  if (loading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.background.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={colors.text.secondary} />
      </SafeAreaView>
    );
  }

  const hasContent = trajectory && trajectory.length > 1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>CARTE DE CHALEUR</Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.xl }]}>
          Votre vitesse, rendue visible.
        </Text>

        {!hasContent ? (
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
            <Text
              style={[
                typography.manifest,
                { color: colors.text.tertiary, textAlign: 'center', fontStyle: 'italic' },
              ]}
            >
              Pas de trace GPS pour cette session.
            </Text>
          </View>
        ) : (
          <>
            <PilotPreset
              animate
              trajectory={trajectory ?? undefined}
              trajectoryColorMode="speed-heatmap"
              brakingPoints={brakingPoints}
              height={400}
            />

            {/* Légende vitesse */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.lg,
                marginTop: spacing.lg,
              }}
            >
              <LegendDot color={colors.margin.red} label="Vitesse basse" />
              <LegendDot color={colors.margin.yellow} label="Vitesse moyenne" />
              <LegendDot color={colors.margin.green} label="Vitesse élevée" />
            </View>

            {/* Légende points de freinage */}
            {brakingPoints.length > 0 ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.xs,
                  marginTop: spacing.sm,
                }}
              >
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: colors.margin.red,
                    opacity: 0.7,
                  }}
                />
                <Text style={{ color: colors.text.secondary, fontSize: fontSize.caption }}>
                  Cercles : zones de freinage marqué
                </Text>
              </View>
            ) : null}

            {stats ? (
              <Text
                style={{
                  textAlign: 'center',
                  color: colors.text.tertiary,
                  fontSize: fontSize.caption,
                  fontFamily: 'Menlo',
                  marginTop: spacing.md,
                }}
              >
                {Math.round(stats.min)} – {Math.round(stats.max)} km/h
              </Text>
            ) : null}

            <Text
              style={[
                typography.caption,
                {
                  marginTop: spacing.xxl,
                  textAlign: 'center',
                  color: colors.text.tertiary,
                  fontStyle: 'italic',
                  paddingHorizontal: spacing.md,
                },
              ]}
            >
              La donnée, sans un mot. À vous de la lire.
            </Text>
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

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <View style={{ width: 12, height: 4, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ color: colors.text.secondary, fontSize: fontSize.caption }}>{label}</Text>
    </View>
  );
}
