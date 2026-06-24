/**
 * Écran #30 — Rejouer un tour.
 *
 * Carte de tracé `TrackStage` (mode `replay`, **contrôlé**) + scrubber tactile
 * manuel : le pilote balaie la fenêtre temporelle du tour à son rythme et lit
 * l'instant exact — « qu'est-ce qui s'est passé ici ? ».
 *
 * Mode SIMPLE : vitesse + position le long du tracé.
 * Mode DÉTAILLÉ : ajoute G latéral / G longitudinal instantanés.
 *
 * Doctrine : pas de jugement, **pas de playback automatique** (sobriété). On
 * pilote `TrackStage` par `progress` (autoplay coupé) — jamais en lecture auto.
 *
 * Gaming : `TrackStage` (tracé à halo or, tête de lecture) remplace l'ancien
 * `LapScrubber` (carte + tokens legacy). Relevés en `Fact`. Le chargement des
 * tours et des frames (`fetchSessionLaps` / `loadLapFrames` + `useDetailLevel`)
 * reste inchangé.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { TrackStage } from '@/components/CircuitMap';
import { Fact } from '@/components/instruments';
import { useDetailLevel } from '@/hooks/useDetailLevel';
import { fetchSessionLaps } from '@/services/sessionsService';
import { loadLapFrames } from '@/services/sessionTelemetryService';
import type { Lap } from '@/types/telemetry';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { formatLapTime } from '@/utils/format';

/** Frame de rejeu (forme renvoyée par loadLapFrames). */
interface Frame {
  lat: number;
  lon: number;
  speedKmh: number;
  gLat: number;
  gLong: number;
  elapsedMs: number;
}

export default function ReplayScreen() {
  const params = useLocalSearchParams<{ sessionId?: string; lapNumber?: string }>();
  const [laps, setLaps] = useState<Lap[]>([]);
  const [selectedLap, setSelectedLap] = useState<number | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [loadingLaps, setLoadingLaps] = useState(true);
  const [loadingFrames, setLoadingFrames] = useState(false);
  const { level, toggle, canToggle } = useDetailLevel();

  // Charge la liste des tours
  useEffect(() => {
    if (!params.sessionId) {
      setLoadingLaps(false);
      return;
    }
    let cancelled = false;
    fetchSessionLaps(params.sessionId)
      .then((rows) => {
        if (cancelled) return;
        setLaps(rows);
        const initial = params.lapNumber
          ? Number(params.lapNumber)
          : (rows.find((l) => l.is_best_lap)?.lap_number ??
            rows.find((l) => !l.is_outlap && !l.is_inlap)?.lap_number ??
            rows[0]?.lap_number ??
            null);
        setSelectedLap(initial);
        setLoadingLaps(false);
      })
      .catch(() => {
        if (!cancelled) setLoadingLaps(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.sessionId, params.lapNumber]);

  // Charge les frames du tour sélectionné
  useEffect(() => {
    if (!params.sessionId || selectedLap === null) return;
    const sessionId = params.sessionId;
    const lapNumber = selectedLap;
    let cancelled = false;
    setLoadingFrames(true);
    loadLapFrames(sessionId, lapNumber).then((rows) => {
      if (cancelled) return;
      setFrames(
        rows.map((f) => ({
          lat: f.lat ?? 0,
          lon: f.lon ?? 0,
          speedKmh: f.speedKmh ?? 0,
          gLat: f.gLat ?? 0,
          gLong: f.gLong ?? 0,
          elapsedMs: f.elapsedMs,
        }))
      );
      setLoadingFrames(false);
    });
    return () => {
      cancelled = true;
    };
  }, [params.sessionId, selectedLap]);

  const currentLap = useMemo(
    () => laps.find((l) => l.lap_number === selectedLap) ?? null,
    [laps, selectedLap]
  );

  return (
    <Screen>
      <AppBar title="REJOUER" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>REJOUER</Text>
        <Text style={s.title}>
          {currentLap
            ? `Tour ${currentLap.lap_number}${currentLap.is_best_lap ? ' · meilleur tour' : ''}`
            : 'Sélectionnez un tour'}
        </Text>
        {currentLap ? (
          <Text style={[s.meta, { marginBottom: theme.spacing.xl }]}>
            {formatLapTime(currentLap.duration_seconds)} ·{' '}
            {currentLap.is_outlap
              ? 'Tour de sortie'
              : currentLap.is_inlap
                ? 'Tour de rentrée'
                : 'Tour valide'}
          </Text>
        ) : null}

        {/* Sélecteur de tour (chips horizontales) */}
        {laps.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: theme.spacing.lg }}
            contentContainerStyle={{ gap: theme.spacing.xs, paddingHorizontal: 2 }}
          >
            {laps.map((l) => {
              const on = selectedLap === l.lap_number;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  key={l.id}
                  onPress={() => setSelectedLap(l.lap_number)}
                  style={({ pressed }) => ({
                    paddingVertical: theme.spacing.xs,
                    paddingHorizontal: theme.spacing.md,
                    borderRadius: theme.radius.sm,
                    borderWidth: 1,
                    borderColor: on
                      ? l.is_best_lap
                        ? theme.dataColors.accel
                        : theme.palette.edge
                      : theme.palette.line,
                    backgroundColor: on ? 'rgba(255,255,255,0.07)' : theme.palette.card2,
                    opacity: pressed ? 0.85 : l.is_outlap || l.is_inlap ? 0.6 : 1,
                  })}
                >
                  <Text
                    style={{
                      fontFamily: theme.fonts.mono,
                      color: on ? theme.palette.cream : theme.palette.creamMute,
                      fontSize: theme.fontSize.small,
                    }}
                  >
                    {l.lap_number}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {/* Toggle détails */}
        {canToggle ? (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              marginBottom: theme.spacing.md,
            }}
          >
            <Pressable accessibilityRole="button" onPress={toggle}>
              <Text style={s.toggle}>
                {level === 'simple' ? 'Voir les détails techniques' : 'Vue simplifiée'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Scène de rejeu */}
        {loadingLaps ? (
          <Text style={[s.meta, { paddingVertical: theme.spacing.lg }]}>Chargement…</Text>
        ) : laps.length === 0 ? (
          <EmptyState />
        ) : loadingFrames ? (
          <Text style={[s.meta, { paddingVertical: theme.spacing.lg }]}>
            Chargement des frames…
          </Text>
        ) : (
          <ReplayStage frames={frames} showGs={level === 'detailed'} />
        )}

        <View style={{ marginTop: theme.spacing.xxl * 1.5, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={s.back}>Retour</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

/**
 * Scène de rejeu : `TrackStage` mode `replay` **contrôlé** (autoplay coupé) +
 * scrubber tactile manuel qui pilote `progress`. Relevés instantanés en `Fact`.
 */
function ReplayStage({ frames, showGs }: { frames: Frame[]; showGs: boolean }) {
  const [progress, setProgress] = useState(0);
  const widthRef = useRef(1);
  const total = frames.length;

  // Réinitialise le curseur quand on change de tour.
  useEffect(() => {
    setProgress(0);
  }, [frames]);

  const trajectory = useMemo(
    () => frames.map((f) => ({ lat: f.lat, lon: f.lon, speed: f.speedKmh })),
    [frames]
  );

  const index = total > 1 ? Math.round(progress * (total - 1)) : 0;
  const cur: Frame | undefined = frames[index];

  const setFromX = (x: number) => {
    const w = widthRef.current || 1;
    setProgress(Math.max(0, Math.min(1, x / w)));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setFromX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => setFromX(e.nativeEvent.locationX),
    })
  ).current;

  if (total === 0) {
    return (
      <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.xl }}>
        <Text style={s.emptyTitle}>Pas de frames sur ce tour.</Text>
        <Text style={s.emptyHint}>Choisissez un tour complet pour le rejouer.</Text>
      </Card>
    );
  }

  return (
    <View>
      {/* Tracé : TrackStage contrôlé par le scrubber (pas d'autoplay). */}
      <TrackStage
        mode="replay"
        trajectory={trajectory}
        progress={progress}
        autoplay={false}
        height={300}
      />

      {/* Relevés instantanés au point balayé. */}
      <View style={s.readouts}>
        <Fact
          label="Vitesse"
          value={cur ? String(Math.round(cur.speedKmh)) : '—'}
          unit="km/h"
          accent
        />
        {showGs ? (
          <Fact label="G latéral" value={cur ? cur.gLat.toFixed(2) : '—'} unit="g" />
        ) : null}
        {showGs ? <Fact label="G long." value={cur ? cur.gLong.toFixed(2) : '—'} unit="g" /> : null}
        <Fact label="Position" value={String(Math.round(progress * 100))} unit="%" />
      </View>

      {/* Scrubber tactile manuel. */}
      <View
        style={s.track}
        onLayout={(e: LayoutChangeEvent) => {
          widthRef.current = e.nativeEvent.layout.width;
        }}
        {...pan.panHandlers}
      >
        <View style={[s.trackFill, { width: `${progress * 100}%` }]} />
        <View style={[s.trackHead, { left: `${progress * 100}%` }]} />
      </View>
      <Text style={s.scrubHint}>Balayez pour parcourir le tour</Text>
    </View>
  );
}

function EmptyState() {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.xxl }}>
      <Text style={s.emptyTitle}>Aucun tour à rejouer.</Text>
      <Text style={s.emptyHint}>
        Le replay arrive dès qu'une session contient au moins un tour complet.
      </Text>
    </Card>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2.4,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  meta: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.5,
    color: theme.palette.creamMute,
  },
  toggle: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.5,
    color: theme.palette.creamMute,
    textDecorationLine: 'underline' as const,
  },
  readouts: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  track: {
    height: 36,
    marginTop: theme.spacing.lg,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.palette.card2,
    borderWidth: 1,
    borderColor: theme.palette.line,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  },
  trackFill: {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,183,3,0.14)',
  },
  trackHead: {
    position: 'absolute' as const,
    top: 4,
    bottom: 4,
    width: 3,
    marginLeft: -1.5,
    borderRadius: 2,
    backgroundColor: theme.palette.gold,
    shadowColor: theme.palette.gold,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  scrubHint: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
    textAlign: 'center' as const,
    marginTop: theme.spacing.sm,
  },
  emptyTitle: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    color: theme.palette.creamSoft,
    textAlign: 'center' as const,
  },
  emptyHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.md,
    lineHeight: theme.fontSize.small * 1.5,
  },
  back: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
};
