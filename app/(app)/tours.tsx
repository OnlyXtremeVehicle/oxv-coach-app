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
 *
 * Reskin V2 : Screen + AppBar, Card du kit, styles via @/theme/v2. Logique,
 * données, navigation, useDetailLevel + toggle et états inchangés.
 */

import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { TrackStage } from '@/components/CircuitMap';
import { EmptyState as DataEmptyState } from '@/components/instruments';
import { useDetailLevel } from '@/hooks/useDetailLevel';
import { fetchSessionLaps } from '@/services/sessionsService';
import { loadLapFrames } from '@/services/sessionTelemetryService';
import type { Lap } from '@/types/telemetry';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
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
    <Screen>
      <AppBar title="TOURS" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>TOUR PAR TOUR</Text>
        <Text style={s.title} accessibilityRole="header">
          {laps.length > 0
            ? `${validLaps.length} tour${validLaps.length > 1 ? 's' : ''} valide${validLaps.length > 1 ? 's' : ''}`
            : 'Vos tours'}
        </Text>

        {/* Chiffre central : meilleur tour */}
        {bestLap ? (
          <View
            style={{
              alignItems: 'center',
              marginTop: theme.spacing.xl,
              marginBottom: theme.spacing.xxl,
              paddingVertical: theme.spacing.lg,
            }}
          >
            <Text
              style={[
                s.eyebrow,
                { color: theme.palette.creamMute, marginBottom: theme.spacing.sm },
              ]}
            >
              MEILLEUR TOUR
            </Text>
            <Text
              style={s.heroNumber}
              accessibilityRole="text"
              accessibilityLabel={`Meilleur tour : ${formatLapTime(bestLap.duration_seconds)}, tour ${bestLap.lap_number}`}
            >
              {formatLapTime(bestLap.duration_seconds)}
            </Text>
            <Text
              style={[s.meta, { marginTop: theme.spacing.xs }]}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              Tour {bestLap.lap_number}
            </Text>
          </View>
        ) : null}

        {/* Faisceau : tous vos tours valides superposés sur le tracé (mode beam).
            La dispersion des lignes = votre régularité de trajectoire, vue d'en
            haut. Constat spatial, aucun jugement. */}
        {params.sessionId && validLaps.length > 0 ? (
          <View style={{ marginBottom: theme.spacing.xxl }}>
            <LapsBeam sessionId={params.sessionId} laps={validLaps} />
          </View>
        ) : null}

        {/* Toggle simple/détaillé pour les pilotes curieux */}
        {canToggle && validLaps.length > 0 ? (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              marginBottom: theme.spacing.md,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: level === 'detailed' }}
              hitSlop={theme.hitSlop}
              onPress={toggle}
              style={s.toggleHit}
            >
              <Text style={s.toggle}>
                {level === 'simple' ? 'Voir les détails techniques' : 'Vue simplifiée'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {loading ? (
          <Text style={[s.meta, { paddingVertical: theme.spacing.lg }]}>Chargement…</Text>
        ) : laps.length === 0 ? (
          <EmptyState />
        ) : (
          <View style={{ gap: theme.spacing.xs }}>
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

        <View style={{ marginTop: theme.spacing.xxl * 1.5, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            hitSlop={theme.hitSlop}
            onPress={() => router.back()}
            style={s.backHit}
          >
            <Text style={s.back}>Retour</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
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

  const noteForA11y = isBest
    ? 'meilleur tour'
    : isExcluded
      ? lap.is_outlap
        ? 'tour de sortie'
        : 'tour de rentrée'
      : delta !== null
        ? `plus ${delta.toFixed(2)} seconde${delta >= 2 ? 's' : ''}`
        : '';
  const a11yLabel = `Tour ${lap.lap_number}, ${formatLapTime(lap.duration_seconds)}${
    noteForA11y ? `, ${noteForA11y}` : ''
  }`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint="Ouvre la télémétrie de ce tour"
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : isExcluded ? 0.5 : 1 })}
    >
      <Card
        style={{
          borderColor: isBest ? theme.dataColors.accel : theme.palette.line,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
        }}
      >
        {/* Badge numéro tour */}
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: isBest ? theme.dataColors.accel : theme.palette.card2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: theme.fonts.mono,
              color: isBest ? theme.palette.night : theme.palette.creamSoft,
              fontSize: 13,
            }}
          >
            {lap.lap_number}
          </Text>
        </View>

        {/* Temps au tour + label sobre */}
        <View style={{ flex: 1 }}>
          <Text style={s.lapTime}>{formatLapTime(lap.duration_seconds)}</Text>
          {isBest ? (
            <Text style={[s.lapNote, { color: theme.dataColors.accel }]}>Meilleur tour</Text>
          ) : isExcluded ? (
            <Text style={s.lapNote}>{lap.is_outlap ? 'Tour de sortie' : 'Tour de rentrée'}</Text>
          ) : delta !== null ? (
            <Text style={[s.lapNote, { fontFamily: theme.fonts.mono }]}>+{delta.toFixed(2)} s</Text>
          ) : null}

          {/* Détails techniques (mode détaillé) */}
          {level === 'detailed' && !isExcluded ? (
            <View
              style={{ flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.xs }}
            >
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

        <Text style={s.chevron} accessibilityElementsHidden importantForAccessibility="no">
          ›
        </Text>
      </Card>
    </Pressable>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Text style={s.detail}>
      <Text style={s.detailLabel}>{label} </Text>
      <Text style={s.detailValue}>{value}</Text>
    </Text>
  );
}

function EmptyState() {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.xxl }}>
      <Text style={s.emptyTitle}>Aucun tour enregistré.</Text>
      <Text style={s.emptyHint}>
        Les tours apparaissent dès qu'une session complète a été analysée.
      </Text>
    </Card>
  );
}

/** Point projeté (forme attendue par TrackStage). */
type Pt = { lat: number; lon: number; speed: number };

/** Faisceau de tous les tours valides superposés (mode `beam`). Charge les
 *  frames de chaque tour en parallèle ; on écarte les tours sans position.
 *  Vide tant que telemetry_frames n'est pas alimentée (avant Valence). */
function LapsBeam({ sessionId, laps }: { sessionId: string; laps: Lap[] }) {
  const [beam, setBeam] = useState<Pt[][]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(
      laps.map(async (l) => {
        const rows = await loadLapFrames(sessionId, l.lap_number);
        return rows
          .filter((f) => f.lat != null && f.lon != null)
          .map((f) => ({ lat: f.lat as number, lon: f.lon as number, speed: f.speedKmh ?? 0 }));
      })
    )
      .then((all) => {
        if (cancelled) return;
        setBeam(all.filter((t) => t.length >= 2));
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, laps]);

  if (loading) {
    return (
      <View style={{ paddingVertical: theme.spacing.xl, alignItems: 'center' }}>
        <ActivityIndicator color={theme.palette.creamMute} />
      </View>
    );
  }

  if (beam.length === 0) {
    return (
      <DataEmptyState
        label="Faisceau en attente"
        message="Vos tours superposés apparaîtront dès vos premières frames réelles."
        source="telemetry_frames"
      />
    );
  }

  return (
    <TrackStage
      mode="beam"
      laps={beam}
      height={300}
      statusLabel={`FAISCEAU · ${beam.length} TOUR${beam.length > 1 ? 'S' : ''}`}
    />
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
  heroNumber: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.hud,
    letterSpacing: -1,
    color: theme.palette.cream,
    textShadowColor: 'rgba(255,183,3,0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
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
  // Cible tactile confortable pour le lien-toggle (texte seul).
  toggleHit: {
    minHeight: 44,
    justifyContent: 'center' as const,
  },
  lapTime: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.h3,
    color: theme.palette.cream,
  },
  lapNote: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: 2,
  },
  detail: {
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1.5,
  },
  detailLabel: {
    fontFamily: theme.fonts.mono,
    color: theme.palette.creamMute,
  },
  detailValue: {
    fontFamily: theme.fonts.mono,
    color: theme.palette.creamSoft,
  },
  chevron: {
    color: theme.palette.creamMute,
    fontSize: 18,
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
  // Cible tactile confortable pour le lien « Retour » (texte seul).
  backHit: {
    minHeight: 44,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
};
