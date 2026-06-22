/**
 * Écran Carte de chaleur — pilier §3.4 du cahier OXV Mirror.
 *
 * Visualisation PURE : la vitesse projetée en couleurs le long du tracé
 * réel. Gradient d'intensité, froid → chaud : faint (basse) → rouge (élevée).
 * Couleur de donnée, jamais un jugement. Zéro mot, zéro note : la donnée
 * rendue visible. « Le miroir le plus littéral. »
 *
 * Réutilise PilotPreset + TrajectoryLayer (mode speed-heatmap) déjà en
 * place. Charge les telemetry_frames de la session (RLS owner).
 *
 * Reskin V2 : Screen + AppBar + Card, typo/couleurs @/theme/v2. Le
 * composant carte (PilotPreset, SVG) est conservé tel quel.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { PilotPreset, type TrajectoryPoint } from '@/components/CircuitMap';
import { type BrakingMarker } from '@/components/CircuitMap';
import { supabase } from '@/lib/supabase';
import { detectBrakingPoints } from '@/services/brakingPointsService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

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
      <Screen scroll={false}>
        <AppBar title="CHALEUR" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.palette.creamMute} />
        </View>
      </Screen>
    );
  }

  const hasContent = trajectory && trajectory.length > 1;

  return (
    <Screen>
      <AppBar title="CHALEUR" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <SectionLabel>Carte de chaleur</SectionLabel>
        <Text style={s.title}>Votre vitesse, rendue visible.</Text>

        {!hasContent ? (
          <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.xxl }}>
            <Text style={s.emptyText}>Pas de trace GPS pour cette session.</Text>
          </Card>
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
                gap: theme.spacing.lg,
                marginTop: theme.spacing.lg,
              }}
            >
              <LegendDot color={theme.palette.faint} label="Vitesse basse" />
              <LegendDot color={theme.palette.gold} label="Vitesse moyenne" />
              <LegendDot color={theme.palette.red} label="Vitesse élevée" />
            </View>

            {/* Légende points de freinage */}
            {brakingPoints.length > 0 ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: theme.spacing.xs,
                  marginTop: theme.spacing.sm,
                }}
              >
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: theme.palette.red,
                    opacity: 0.7,
                  }}
                />
                <Text style={s.brakingLegend}>Cercles : zones de freinage marqué</Text>
              </View>
            ) : null}

            {stats ? (
              <Text style={s.stats}>
                {Math.round(stats.min)} – {Math.round(stats.max)} km/h
              </Text>
            ) : null}

            <Text style={s.manifest}>La donnée, sans un mot. À vous de la lire.</Text>
          </>
        )}

        <View style={{ marginTop: theme.spacing.xxl, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={s.backLink}>Retour</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
      <View style={{ width: 12, height: 4, borderRadius: 2, backgroundColor: color }} />
      <Text style={s.legendLabel}>{label}</Text>
    </View>
  );
}

const s = {
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  emptyText: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
  },
  legendLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamSoft,
  },
  brakingLegend: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamSoft,
  },
  stats: {
    textAlign: 'center' as const,
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.md,
  },
  manifest: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.small,
    fontStyle: 'italic' as const,
    textAlign: 'center' as const,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.md,
  },
  backLink: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
};
