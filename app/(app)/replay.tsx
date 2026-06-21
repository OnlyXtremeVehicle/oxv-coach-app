/**
 * Écran #30 — Rejouer un tour.
 *
 * Sélecteur de tour + scrubber tactile qui balaie la fenêtre temporelle
 * du tour. Permet au pilote ou son coach d'analyser un moment précis :
 * « qu'est-ce qui s'est passé ici ? ».
 *
 * Mode SIMPLE : vitesse + position
 * Mode DÉTAILLÉ : ajoute G latéral / G longitudinal instantanés
 *
 * Doctrine : pas de jugement, pas de playback automatique (sobriété).
 * Le pilote scrubbe à son rythme.
 *
 * Reskin V2 : Screen + AppBar, Card du kit, styles via @/theme/v2. Le
 * LapScrubber (carte SVG + scrubber tactile) et toute la logique
 * (chargement des frames, useDetailLevel + toggle) restent inchangés.
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { LapScrubber, type ScrubFrame } from '@/components/LapScrubber';
import { useDetailLevel } from '@/hooks/useDetailLevel';
import { fetchSessionLaps } from '@/services/sessionsService';
import { loadLapFrames } from '@/services/sessionTelemetryService';
import type { Lap } from '@/types/telemetry';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { formatLapTime } from '@/utils/format';

export default function ReplayScreen() {
  const params = useLocalSearchParams<{ sessionId?: string; lapNumber?: string }>();
  const [laps, setLaps] = useState<Lap[]>([]);
  const [selectedLap, setSelectedLap] = useState<number | null>(null);
  const [frames, setFrames] = useState<ScrubFrame[]>([]);
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
        // Pré-sélectionne le tour du param ou le meilleur tour
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
    const sessionId = params.sessionId; // narrow
    const lapNumber = selectedLap;
    let cancelled = false;
    setLoadingFrames(true);
    loadLapFrames(sessionId, lapNumber).then((rows) => {
      if (cancelled) return;
      setFrames(
        rows.map((f) => ({
          lat: f.lat,
          lon: f.lon,
          speedKmh: f.speedKmh,
          gLat: f.gLat,
          gLong: f.gLong,
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

        {/* Scrubber */}
        {loadingLaps ? (
          <Text style={[s.meta, { paddingVertical: theme.spacing.lg }]}>Chargement…</Text>
        ) : laps.length === 0 ? (
          <EmptyState />
        ) : loadingFrames ? (
          <Text style={[s.meta, { paddingVertical: theme.spacing.lg }]}>
            Chargement des frames…
          </Text>
        ) : (
          <LapScrubber frames={frames} showGs={level === 'detailed'} mapHeight={280} />
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
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
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
