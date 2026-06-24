/**
 * ABTrace — superposition factuelle de deux tours (mode `ab` de TrackStage).
 *
 * Charge le meilleur tour de deux sessions et les superpose sur le tracé du
 * circuit : A en or (mise en avant), B en neutre (référence). Sert deux écrans :
 *   - Comparateur  : vos deux propres tours (« vous contre vous »).
 *   - Côte-à-côte  : votre tour vs celui d'un ami accepté.
 *
 * Doctrine : c'est un MIROIR, pas un verdict. On montre où les deux lignes
 * divergent ; on n'écrit jamais « mieux / moins bien », ni de gagnant. Toute
 * lecture causale reste à la bande coach, hors de ce composant.
 *
 * Honnêteté : tant que `telemetry_frames` n'est pas alimentée (avant Valence),
 * ou si la RLS ne donne pas accès aux frames d'un côté, on affiche un
 * EmptyState — jamais une fausse trajectoire.
 *
 * RLS (côté ami) : la lecture des frames d'un ami suppose la politique
 * `telemetry_frames_select_friend` (are_friends). Sans elle, le côté B revient
 * vide et l'EmptyState s'affiche.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { TrackStage } from '@/components/CircuitMap';
import { fetchSessionLaps } from '@/services/sessionsService';
import { loadLapFrames } from '@/services/sessionTelemetryService';
import { theme } from '@/theme/v2';

import { EmptyState } from './EmptyState';

/** Point projeté sur le tracé (forme attendue par TrackStage). */
type Pt = { lat: number; lon: number; speed: number };

/**
 * Charge le meilleur tour d'une session → trajectoire. Frames lat/lon/vitesse
 * nullables : on écarte les points sans position. Renvoie [] si la session n'a
 * pas de tour ou si la RLS refuse l'accès aux frames.
 */
export async function loadBestTrajectory(sessionId: string): Promise<Pt[]> {
  const laps = await fetchSessionLaps(sessionId);
  if (!laps.length) return [];
  const lapNumber = laps.find((l) => l.is_best_lap)?.lap_number ?? laps[0].lap_number;
  const rows = await loadLapFrames(sessionId, lapNumber);
  return rows
    .filter((f) => f.lat != null && f.lon != null)
    .map((f) => ({ lat: f.lat as number, lon: f.lon as number, speed: f.speedKmh ?? 0 }));
}

export interface ABTraceProps {
  /** Session A (mise en avant, or). */
  sessionA: string;
  /** Session B (référence, neutre). */
  sessionB: string;
  /** Étiquette de légende pour A. Défaut « Référence A ». */
  labelA?: string;
  /** Étiquette de légende pour B. Défaut « Référence B ». */
  labelB?: string;
  /** Bandeau de statut du tracé. Défaut « SUPERPOSITION · A vs B ». */
  statusLabel?: string;
  /** Note factuelle sous le tracé. Défaut neutre, sans verdict. */
  note?: string;
  /** Message de l'EmptyState quand les frames manquent. */
  emptyMessage?: string;
}

export function ABTrace({
  sessionA,
  sessionB,
  labelA = 'Référence A',
  labelB = 'Référence B',
  statusLabel = 'SUPERPOSITION · A vs B',
  note = 'Là où vos deux lignes divergent — sans verdict.',
  emptyMessage = 'La superposition des deux tours apparaîtra dès les premières frames réelles.',
}: ABTraceProps) {
  const [a, setA] = useState<Pt[]>([]);
  const [b, setB] = useState<Pt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([loadBestTrajectory(sessionA), loadBestTrajectory(sessionB)])
      .then(([ta, tb]) => {
        if (cancelled) return;
        setA(ta);
        setB(tb);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionA, sessionB]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.palette.creamMute} />
      </View>
    );
  }

  if (a.length < 2 || b.length < 2) {
    return (
      <EmptyState label="Tracés en attente" message={emptyMessage} source="telemetry_frames" />
    );
  }

  return (
    <View>
      <TrackStage
        mode="ab"
        trajectoryA={a}
        trajectoryB={b}
        height={300}
        statusLabel={statusLabel}
      />
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: theme.palette.gold }]} />
          <Text style={styles.legendText}>{labelA}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: theme.palette.creamMute }]} />
          <Text style={styles.legendText}>{labelB}</Text>
        </View>
      </View>
      <Text style={styles.note}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingVertical: theme.spacing.xl,
    alignItems: 'center',
  },
  legend: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    justifyContent: 'center',
    marginTop: theme.spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  swatch: {
    width: 16,
    height: 3,
    borderRadius: 2,
  },
  legendText: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
  },
  note: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.small,
    fontStyle: 'italic',
    color: theme.palette.creamMute,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
});
