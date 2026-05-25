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
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { LapScrubber, type ScrubFrame } from '@/components/LapScrubber';
import { useDetailLevel } from '@/hooks/useDetailLevel';
import { fetchSessionLaps } from '@/services/sessionsService';
import { loadLapFrames } from '@/services/sessionTelemetryService';
import type { Lap } from '@/types/telemetry';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';
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
    fetchSessionLaps(params.sessionId).then((rows) => {
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>REJOUER</Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.sm }]}>
          {currentLap
            ? `Tour ${currentLap.lap_number}${currentLap.is_best_lap ? ' · meilleur tour' : ''}`
            : 'Sélectionnez un tour'}
        </Text>
        {currentLap ? (
          <Text
            style={[typography.caption, { color: colors.text.tertiary, marginBottom: spacing.xl }]}
          >
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
            style={{ marginBottom: spacing.lg }}
            contentContainerStyle={{ gap: spacing.xs, paddingHorizontal: 2 }}
          >
            {laps.map((l) => (
              <Pressable
                accessibilityRole="button"
                key={l.id}
                onPress={() => setSelectedLap(l.lap_number)}
                style={({ pressed }) => ({
                  paddingVertical: spacing.xs,
                  paddingHorizontal: spacing.md,
                  borderRadius: borderRadius.md,
                  borderWidth: selectedLap === l.lap_number ? 1 : 0.5,
                  borderColor:
                    selectedLap === l.lap_number
                      ? l.is_best_lap
                        ? colors.margin.green
                        : colors.text.primary
                      : colors.border.subtle,
                  backgroundColor:
                    selectedLap === l.lap_number
                      ? colors.background.elevated
                      : colors.background.secondary,
                  opacity: pressed ? 0.85 : l.is_outlap || l.is_inlap ? 0.6 : 1,
                })}
              >
                <Text
                  style={{
                    color: colors.text.primary,
                    fontSize: fontSize.caption,
                    fontWeight: fontWeight.medium,
                    fontFamily: 'Menlo',
                  }}
                >
                  {l.lap_number}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {/* Toggle détails */}
        {canToggle ? (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              marginBottom: spacing.md,
            }}
          >
            <Pressable accessibilityRole="button" onPress={toggle}>
              <Text
                style={{
                  color: colors.text.tertiary,
                  fontSize: fontSize.caption,
                  textDecorationLine: 'underline',
                }}
              >
                {level === 'simple' ? 'Voir les détails techniques' : 'Vue simplifiée'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Scrubber */}
        {loadingLaps ? (
          <Text style={[typography.caption, { paddingVertical: spacing.lg }]}>Chargement…</Text>
        ) : laps.length === 0 ? (
          <EmptyState />
        ) : loadingFrames ? (
          <Text style={[typography.caption, { paddingVertical: spacing.lg }]}>
            Chargement des frames…
          </Text>
        ) : (
          <LapScrubber frames={frames} showGs={level === 'detailed'} mapHeight={280} />
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

function EmptyState() {
  return (
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
      <Text style={[typography.manifest, { color: colors.text.secondary, textAlign: 'center' }]}>
        Aucun tour à rejouer.
      </Text>
      <Text
        style={[
          typography.caption,
          { color: colors.text.tertiary, textAlign: 'center', marginTop: spacing.md },
        ]}
      >
        Le replay arrive dès qu'une session contient au moins un tour complet.
      </Text>
    </View>
  );
}
