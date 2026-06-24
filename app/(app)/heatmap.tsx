/**
 * Écran Carte de chaleur — pilier §3.4 du cahier OXV Mirror.
 * Refonte gaming « cockpit factuel » (charte v2).
 *
 * Branche TrackStage (mode 'heatmap'), le composant maître de tracé : la
 * vitesse du roulage devient une chaleur le long du circuit, froid → chaud
 * (faint → or Heritage → or), JAMAIS de rouge (réservé marque + coach).
 * Deux faits encadrent la carte : le virage le plus lent, la ligne la plus
 * rapide. Conforme à la maquette `maquette_heatmap_gaming.html`.
 *
 * Source : telemetry_frames de la session (RLS owner). Les points de
 * freinage de l'ancienne version sont retirés (la maquette ne les montre
 * pas — la carte se concentre sur la vitesse). Tant que les frames sont
 * absentes, `EmptyState` honnête : aucune fausse donnée.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import {
  TrackStage,
  type TrackStageHeatPoint,
  type TrajectoryPoint,
} from '@/components/CircuitMap';
import { EmptyState, Fact } from '@/components/instruments';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Screen } from '@/ui/Screen';

const { palette, fonts, fontSize, spacing, radius } = theme;

export default function HeatmapScreen() {
  const profile = useAuthStore((s) => s.profile);
  const params = useLocalSearchParams<{ sessionId?: string }>();

  const [trajectory, setTrajectory] = useState<TrajectoryPoint[] | null>(null);
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
        const speeds = points
          .map((p) => p.speed)
          .filter((sp): sp is number => typeof sp === 'number' && Number.isFinite(sp));
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
      <Screen scroll={false}>
        <AppBar title="CHALEUR" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.creamMute} />
        </View>
      </Screen>
    );
  }

  const hasContent = trajectory && trajectory.length > 1;

  // Vitesse → intensité de chaleur (TrackStage normalise en interne).
  const heatPoints: TrackStageHeatPoint[] = (trajectory ?? []).map((p) => ({
    lat: p.lat,
    lon: p.lon,
    intensity: p.speed,
  }));

  return (
    <Screen>
      <AppBar title="CHALEUR" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        <Text style={s.eyebrow}>Carte de chaleur · tracé</Text>
        <Text style={s.title}>Votre vitesse, rendue visible.</Text>

        {!hasContent ? (
          <EmptyState
            message="La carte de chaleur se dessine à partir de la trace GPS de vos tours. Elle apparaîtra après votre premier roulage."
            source="telemetry_frames"
          />
        ) : (
          <>
            <TrackStage mode="heatmap" heatPoints={heatPoints} height={400} />

            {/* Légende — Lent → Rapide (froid → chaud, jamais de rouge) */}
            <View style={s.legendRow}>
              <Text style={s.gradLabel}>Lent</Text>
              <View style={s.gradientBar}>
                <View style={[s.gradSeg, { backgroundColor: palette.faint }]} />
                <View style={[s.gradSeg, { backgroundColor: palette.heritageGold }]} />
                <View style={[s.gradSeg, { backgroundColor: palette.gold }]} />
              </View>
              <Text style={s.gradLabel}>Rapide</Text>
            </View>

            {/* Deux faits de vitesse (cf. maquette) */}
            {stats ? (
              <View style={s.factsRow}>
                <Fact
                  label="Virage le plus lent"
                  value={String(Math.round(stats.min))}
                  unit="km/h"
                />
                <Fact
                  label="Ligne la plus rapide"
                  value={String(Math.round(stats.max))}
                  unit="km/h"
                  accent
                />
              </View>
            ) : null}

            <Text style={s.manifest}>La donnée, sans un mot. À vous de la lire.</Text>
          </>
        )}

        <View style={{ marginTop: spacing.xxl, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={s.backLink}>Retour</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const s = {
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
    marginTop: spacing.sm,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.5,
    color: palette.cream,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  legendRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  gradientBar: {
    flexDirection: 'row' as const,
    width: 140,
    height: 6,
    borderRadius: radius.pill,
    overflow: 'hidden' as const,
  },
  gradSeg: {
    flex: 1,
    height: 6,
  },
  gradLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },
  factsRow: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  manifest: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.small,
    fontStyle: 'italic' as const,
    textAlign: 'center' as const,
    color: palette.creamMute,
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.md,
  },
  backLink: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: palette.creamMute,
  },
};
