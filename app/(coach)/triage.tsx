/**
 * Coach — Triage (smart flagging). Réintégration coach__triage.
 *
 * Les virages où le pilote a le moins de marge sur CETTE séance, classés — « où
 * regarder en premier ». Câble coachTriageService (déjà testé). Carte SVG
 * (PilotPreset) des virages flagués + liste FACTUELLE. Doctrine C3 : le triage
 * désigne, il ne dit pas la CAUSE ni quoi faire — au coach (ou à une suggestion
 * IA qu'il valide) de conclure. Rouge de marge neutralisé en ambre (canon).
 *
 * SVG, pas Skia : tourne en Expo Go et au build.
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { PilotPreset, type TrajectoryPoint } from '@/components/CircuitMap';
import { type TriageCorner } from '@/services/coachTriageLogic';
import { getSessionTriage } from '@/services/coachTriageService';
import { loadSessionTrajectory } from '@/services/sessionTelemetryService';
import type { MarginZone } from '@/types/domain';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

const { palette, spacing } = theme;

export default function CoachTriageScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const sessionId = params.sessionId;

  const [corners, setCorners] = useState<TriageCorner[]>([]);
  const [trajectory, setTrajectory] = useState<TrajectoryPoint[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    getSessionTriage(sessionId)
      .then((rows) => {
        if (!cancelled) {
          setCorners(rows);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    // Trajectoire pour la carte (best-effort : vide avant les trames boîtier).
    loadSessionTrajectory(sessionId)
      .then((pts) => {
        if (!cancelled && pts.length > 1) setTrajectory(pts);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [sessionId, reloadKey]);

  // Couleur des virages flagués sur la carte (zone de marge, rouge→ambre canon).
  const zoneByIndex = useMemo(() => {
    const out: Record<number, MarginZone> = {};
    for (const c of corners) {
      if (c.marginZone) out[c.segmentIndex] = c.marginZone as MarginZone;
    }
    return out;
  }, [corners]);

  const state: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : !sessionId || corners.length === 0
        ? 'empty'
        : 'nominal';

  return (
    <Screen>
      <AppBar title="TRIAGE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={{ marginBottom: spacing.md }}>
          <RoleBadge role="coach" />
        </View>
        <Text style={s.eyebrow}>Où regarder en premier</Text>
        <Text style={s.title} accessibilityRole="header">
          Les virages les plus serrés.
        </Text>

        <StateWrapper
          state={state}
          skeletonLines={5}
          emptyLabel="Triage en attente"
          emptyMessage={
            sessionId
              ? "Le classement suit l'analyse des marges de la séance."
              : 'Ouvrez le triage depuis une séance de votre file de lecture.'
          }
          emptySource="app_segment_analyses"
          errorCause="Le triage n'a pas pu être chargé."
          onRetry={() => setReloadKey((k) => k + 1)}
        >
          {/* Carte des virages flagués (SVG). Sans trames, la forme du circuit
              suffit à situer ; les couleurs de zone marquent où c'est serré. */}
          <View style={{ marginTop: spacing.lg }}>
            <PilotPreset
              animate
              trajectory={trajectory ?? undefined}
              zoneByIndex={zoneByIndex}
              selectedIndex={selected}
              height={300}
            />
          </View>

          <View style={{ gap: spacing.sm, marginTop: spacing.xl }}>
            {corners.map((c, i) => {
              const active = selected === c.segmentIndex;
              return (
                <Pressable
                  key={c.segmentIndex}
                  accessibilityRole="button"
                  accessibilityLabel={`${i + 1}. ${c.label}. ${c.fact}`}
                  onPress={() =>
                    setSelected((cur) => (cur === c.segmentIndex ? null : c.segmentIndex))
                  }
                  style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                >
                  <Card style={{ borderColor: active ? palette.edge : palette.line }}>
                    <View style={s.row}>
                      <Text style={s.rank}>{i + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.name}>{c.label}</Text>
                        <Text style={s.fact}>{c.fact}</Text>
                      </View>
                      <Text style={s.margin}>{Math.round(c.marginPercent)} %</Text>
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>

          <Text style={s.doctrine}>
            Le triage désigne où regarder. La cause, et la suite, restent à vous.
          </Text>
        </StateWrapper>
      </View>
    </Screen>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  rank: {
    fontFamily: theme.fonts.king,
    fontSize: 24,
    // Rang/ordre (pas un chrono) → neutre. L'or reste au chrono/record.
    color: palette.creamMute,
    width: 28,
    textAlign: 'center' as const,
  },
  name: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: palette.cream,
  },
  fact: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.creamMute,
    marginTop: 2,
    lineHeight: theme.fontSize.small * 1.4,
  },
  margin: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.h3,
    // Valeur de marge (pas un chrono) → neutre crème ; la zone de marge se code
    // via le dégradé §7.6, pas via l'or.
    color: palette.cream,
  },
  doctrine: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.small,
    fontStyle: 'italic' as const,
    color: palette.creamMute,
    textAlign: 'center' as const,
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.md,
    lineHeight: theme.fontSize.small * 1.5,
  },
};
