/**
 * Écran #14 — Carte du circuit (bilan post-session).
 *
 * Refactor sem 16 : utilise CircuitMap PilotPreset avec animation
 * d'entrée + trajectoire GPS réelle du pilote superposée au tracé
 * officiel + 7 virages coloriés par sa marge.
 *
 * Tap sur un virage → écran #15 Zoom virage.
 *
 * Reskin V2 : Screen + AppBar + Card/SectionLabel, typo/couleurs @/theme/v2.
 * Le composant carte (PilotPreset, SVG) est conservé tel quel.
 */

import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { PilotPreset, type TrajectoryPoint } from '@/components/CircuitMap';
import { supabase } from '@/lib/supabase';
import { BELTOISE_CORNERS } from '@/lib/circuitTopology';
import { type Circuit, getDefaultCircuit } from '@/services/circuitsService';
import { getCornerMarginsZones } from '@/services/segmentAnalysesService';
import { type MarginZone } from '@/types/domain';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

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

  // Doctrine : jamais de fausse donnée. Sans marges réelles (pas de session
  // analysée), on n'invente rien — les virages restent neutres.
  const margins = liveMargins ?? {};
  const hasMargins = Object.keys(margins).length > 0;

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
    <Screen>
      <AppBar title="CARTE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <SectionLabel>Carte du circuit</SectionLabel>
        <Text style={s.title}>{circuit?.name ?? 'Haute Saintonge'}</Text>

        <PilotPreset
          animate
          trajectory={trajectory ?? undefined}
          trajectoryColorMode="uniform"
          zoneByIndex={margins}
          selectedIndex={selectedCorner}
          height={360}
        />

        <Text style={s.caption}>
          {hasMargins
            ? `${BELTOISE_CORNERS.length} virages — zoom au toucher`
            : `${BELTOISE_CORNERS.length} virages — marges par virage indisponibles pour cette session`}
        </Text>

        {/* Liste tappable des virages */}
        <View style={{ gap: theme.spacing.xs }}>
          {BELTOISE_CORNERS.map((corner) => {
            const zone = margins[corner.index] ?? null;
            return (
              <Pressable
                accessibilityRole="button"
                key={corner.index}
                onPress={() => onCornerTap(corner.index)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.md,
                  padding: theme.spacing.md,
                  borderRadius: theme.radius.md,
                  borderWidth: 1,
                  borderColor: theme.palette.line,
                  backgroundColor: theme.palette.card2,
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
                  <Text style={s.cornerIndex}>{corner.index}</Text>
                </View>
                <Text style={s.cornerName}>{corner.name}</Text>
                <Text style={s.chevron}>›</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ marginTop: theme.spacing.xxl, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={s.backLink}>Retour au bilan</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

function colorForZone(zone: MarginZone | null | undefined): string {
  switch (zone) {
    case 'green':
      return theme.dataColors.accel;
    case 'yellow':
      return theme.palette.gold;
    case 'red':
      return theme.palette.red;
    default:
      // Pas de donnée pour ce virage : neutre, jamais une couleur de verdict.
      return theme.palette.creamMute;
  }
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
  caption: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.4,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  cornerIndex: {
    fontFamily: theme.fonts.mono,
    color: theme.palette.night,
    fontSize: 13,
  },
  cornerName: {
    flex: 1,
    fontFamily: theme.fonts.body,
    color: theme.palette.cream,
    fontSize: theme.fontSize.body,
  },
  chevron: {
    color: theme.palette.creamMute,
    fontSize: 18,
  },
  backLink: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
};
