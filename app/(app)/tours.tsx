/**
 * Écran #28 — Tour-par-tour (lap-by-lap).
 *
 * Liste chronologique des tours d'une session avec :
 *   - Numéro de tour
 *   - Temps au tour
 *   - Delta vs meilleur tour
 *   - Marqueur si meilleur tour
 *   - Marqueurs sobres si outlap / inlap (tours hors-référence)
 *
 * Mode SIMPLE (pilote particulier par défaut) :
 *   - Temps au tour en grand
 *   - Delta coloré (vert = meilleur, neutre sinon)
 *   - Label « Meilleur tour » plutôt qu'une étoile
 *
 * Mode DÉTAILLÉ (coach, admin, ou pilote curieux après toggle) :
 *   - Toutes les métriques : vitesse max, distance, G max
 *   - Affichage compact tabulaire
 *
 * Tap sur un tour → ouvre Télémétrie avec ce tour pré-sélectionné.
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { useDetailLevel } from '@/hooks/useDetailLevel';
import { fetchSessionLaps } from '@/services/sessionsService';
import type { Lap } from '@/types/telemetry';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';
import { formatLapTime } from '@/utils/format';

export default function ToursScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const [laps, setLaps] = useState<Lap[]>([]);
  const [loading, setLoading] = useState(true);
  const { level, toggle, canToggle } = useDetailLevel();

  useEffect(() => {
    if (!params.sessionId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchSessionLaps(params.sessionId)
      .then((rows) => {
        if (cancelled) return;
        setLaps(rows);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.sessionId]);

  const validLaps = useMemo(() => laps.filter((l) => !l.is_outlap && !l.is_inlap), [laps]);
  const bestLap = useMemo(
    () =>
      validLaps.reduce<Lap | null>(
        (best, l) => (best === null || l.duration_seconds < best.duration_seconds ? l : best),
        null
      ),
    [validLaps]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>TOUR PAR TOUR</Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.sm }]}>
          {laps.length > 0
            ? `${validLaps.length} tour${validLaps.length > 1 ? 's' : ''} valide${validLaps.length > 1 ? 's' : ''}`
            : 'Vos tours'}
        </Text>

        {/* Chiffre central : meilleur tour */}
        {bestLap ? (
          <View
            style={{
              alignItems: 'center',
              marginTop: spacing.xl,
              marginBottom: spacing.xxl,
              paddingVertical: spacing.lg,
            }}
          >
            <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>MEILLEUR TOUR</Text>
            <Text
              style={{
                color: colors.text.primary,
                fontSize: 56,
                fontWeight: fontWeight.light,
                fontFamily: 'Menlo',
                marginTop: spacing.sm,
              }}
            >
              {formatLapTime(bestLap.duration_seconds)}
            </Text>
            <Text
              style={[typography.caption, { color: colors.text.tertiary, marginTop: spacing.xs }]}
            >
              Tour {bestLap.lap_number}
            </Text>
          </View>
        ) : null}

        {/* Toggle simple/détaillé pour les pilotes curieux */}
        {canToggle && validLaps.length > 0 ? (
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

        {loading ? (
          <Text style={[typography.caption, { paddingVertical: spacing.lg }]}>Chargement…</Text>
        ) : laps.length === 0 ? (
          <EmptyState />
        ) : (
          <View style={{ gap: spacing.xs }}>
            {laps.map((lap) => (
              <LapRow
                key={lap.id}
                lap={lap}
                isBest={bestLap?.id === lap.id}
                bestSeconds={bestLap?.duration_seconds ?? null}
                level={level}
                onPress={() => {
                  if (!params.sessionId) return;
                  router.push({
                    pathname: '/(app)/telemetry',
                    params: {
                      sessionId: params.sessionId,
                      lapNumber: String(lap.lap_number),
                    },
                  } as never);
                }}
              />
            ))}
          </View>
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

function LapRow({
  lap,
  isBest,
  bestSeconds,
  level,
  onPress,
}: {
  lap: Lap;
  isBest: boolean;
  bestSeconds: number | null;
  level: 'simple' | 'detailed';
  onPress: () => void;
}) {
  const isExcluded = lap.is_outlap || lap.is_inlap;
  const delta =
    bestSeconds !== null && !isBest && !isExcluded ? lap.duration_seconds - bestSeconds : null;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: isBest ? 1 : 0.5,
        borderColor: isBest ? colors.margin.green : colors.border.subtle,
        backgroundColor: colors.background.secondary,
        opacity: pressed ? 0.85 : isExcluded ? 0.5 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
      })}
    >
      {/* Badge numéro tour */}
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: isBest ? colors.margin.green : colors.background.elevated,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: isBest ? colors.background.primary : colors.text.secondary,
            fontSize: 13,
            fontWeight: fontWeight.semibold,
          }}
        >
          {lap.lap_number}
        </Text>
      </View>

      {/* Temps au tour + label sobre */}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: colors.text.primary,
            fontSize: fontSize.title,
            fontWeight: fontWeight.light,
            fontFamily: 'Menlo',
          }}
        >
          {formatLapTime(lap.duration_seconds)}
        </Text>
        {isBest ? (
          <Text
            style={[
              typography.caption,
              { color: colors.margin.green, marginTop: 2, fontWeight: fontWeight.medium },
            ]}
          >
            Meilleur tour
          </Text>
        ) : isExcluded ? (
          <Text style={[typography.caption, { color: colors.text.tertiary, marginTop: 2 }]}>
            {lap.is_outlap ? 'Tour de sortie' : 'Tour de rentrée'}
          </Text>
        ) : delta !== null ? (
          <Text
            style={[
              typography.caption,
              { color: colors.text.tertiary, marginTop: 2, fontFamily: 'Menlo' },
            ]}
          >
            +{delta.toFixed(2)} s
          </Text>
        ) : null}

        {/* Détails techniques (mode détaillé) */}
        {level === 'detailed' && !isExcluded ? (
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs }}>
            {lap.max_speed_kmh != null ? (
              <Detail label="Vmax" value={`${Math.round(lap.max_speed_kmh)} km/h`} />
            ) : null}
            {lap.max_g_lateral != null ? (
              <Detail label="G lat" value={`${lap.max_g_lateral.toFixed(2)}`} />
            ) : null}
            {lap.max_g_braking != null ? (
              <Detail label="Frein" value={`${lap.max_g_braking.toFixed(2)}`} />
            ) : null}
          </View>
        ) : null}
      </View>

      <Text style={{ color: colors.text.tertiary, fontSize: fontSize.body }}>›</Text>
    </Pressable>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Text
      style={{
        fontSize: fontSize.eyebrow,
        color: colors.text.tertiary,
        letterSpacing: 1.5,
      }}
    >
      <Text style={{ color: colors.text.tertiary }}>{label} </Text>
      <Text style={{ color: colors.text.secondary, fontFamily: 'Menlo' }}>{value}</Text>
    </Text>
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
        Aucun tour enregistré.
      </Text>
      <Text
        style={[
          typography.caption,
          { color: colors.text.tertiary, textAlign: 'center', marginTop: spacing.md },
        ]}
      >
        Les tours apparaissent dès qu'une session complète a été analysée.
      </Text>
    </View>
  );
}
