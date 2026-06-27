/**
 * Écran #17 — Progression. Refonte gaming « cockpit factuel » (charte v2).
 *
 * Trajectoire FACTUELLE du meilleur tour (best_lap_seconds) séance après
 * séance. Convention sport auto : l'axe vertical porte le temps, le rapide
 * en bas — quand le chrono descend, la courbe descend. Soi vs soi, jamais
 * une note : la marge globale % (ancien score) est abandonnée côté pilote.
 *
 * Doctrine : aucune comparaison avec d'autres pilotes, aucune zone de
 * performance colorée (pas de vert/jaune/rouge). Or = donnée. Phrase
 * manifeste sobre « Vous avancez. ».
 *
 * État vide pédagogique sous 3 séances : on n'affiche pas la courbe pour
 * éviter une lecture trompeuse.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { router } from 'expo-router';

import { EmptyState, Fact } from '@/components/instruments';
import { fetchAllSessions } from '@/services/sessionsService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Screen } from '@/ui/Screen';
import { Segmented } from '@/ui/Segmented';
import { formatLapTime } from '@/utils/format';

const { palette, fonts, fontSize, spacing, radius, hitSlop } = theme;
const AnimatedPath = Animated.createAnimatedComponent(Path);

type Granularity = 'week' | 'month' | 'all';

const GRAN_OPTIONS: { id: Granularity; label: string }[] = [
  { id: 'week', label: 'Semaine' },
  { id: 'month', label: 'Mois' },
  { id: 'all', label: 'Tout' },
];

/** Un point factuel : le meilleur tour d'une séance. */
type SessionPoint = {
  sessionId: string;
  startedAt: string;
  circuitName: string;
  bestSeconds: number;
};

/** Delta chrono signé, en secondes (négatif = plus rapide). */
function formatDeltaSeconds(d: number): string {
  const sign = d > 0 ? '+' : d < 0 ? '−' : '±';
  return `${sign}${Math.abs(d).toFixed(1).replace('.', ',')} s`;
}

export default function ProgressionScreen() {
  const profile = useAuthStore((s) => s.profile);
  const [sessions, setSessions] = useState<SessionPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState<Granularity>('all');

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchAllSessions(profile.id, { limit: 100 })
      .then((rows) => {
        if (cancelled) return;
        // Source factuelle : sessions complétées dotées d'un meilleur tour.
        const pts: SessionPoint[] = rows
          .filter((r) => r.best_lap_seconds != null && Number.isFinite(r.best_lap_seconds))
          .map((r) => ({
            sessionId: r.id,
            startedAt: r.started_at,
            circuitName: r.circuit_name,
            bestSeconds: r.best_lap_seconds as number,
          }));
        setSessions(pts); // déjà trié par started_at décroissant
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const filtered = useMemo(() => {
    if (granularity === 'all') return sessions;
    const cutoffDays = granularity === 'week' ? 7 : 30;
    const cutoff = Date.now() - cutoffDays * 24 * 60 * 60 * 1000;
    return sessions.filter((p) => new Date(p.startedAt).getTime() >= cutoff);
  }, [sessions, granularity]);

  // Points ordonnés chronologiquement croissants pour la courbe.
  const points = useMemo(() => [...filtered].reverse(), [filtered]);

  const stats = useMemo(() => computeStats(sessions), [sessions]);

  // Cœur du pilier Évolution : cette séance VS la précédente (chrono réel).
  // sessions est trié décroissant (plus récente en tête).
  const lastDelta = useMemo(() => {
    if (sessions.length < 2) return null;
    const current = sessions[0].bestSeconds;
    const previous = sessions[1].bestSeconds;
    if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
    return { current, previous, delta: current - previous };
  }, [sessions]);

  if (loading) {
    return (
      <Screen scroll={false}>
        <AppBar title="PROGRESSION" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.creamMute} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="PROGRESSION" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        <Text style={s.eyebrow}>Meilleur tour · séance après séance</Text>
        <Text style={s.title}>Vous avancez.</Text>

        {/* Depuis la dernière séance — constat neutre, vs soi */}
        {lastDelta ? <LastSessionDelta {...lastDelta} /> : null}

        {sessions.length < 3 ? (
          <EmptyState
            message={`Votre trajectoire apparaîtra après 3 séances complètes. ${sessions.length} enregistrée${sessions.length > 1 ? 's' : ''} pour l'instant.`}
          />
        ) : (
          <>
            <View style={{ marginBottom: spacing.xl }}>
              <Segmented
                options={GRAN_OPTIONS.map((o) => o.label)}
                value={GRAN_OPTIONS.find((o) => o.id === granularity)!.label}
                onChange={(label) => {
                  const opt = GRAN_OPTIONS.find((o) => o.label === label);
                  if (opt) setGranularity(opt.id);
                }}
              />
            </View>

            {points.length < 2 ? (
              <View style={{ marginBottom: spacing.xl }}>
                <EmptyState
                  label="Période trop courte"
                  message="Aucune séance sur la période sélectionnée. Une fenêtre plus large fait réapparaître la trajectoire."
                />
              </View>
            ) : (
              <ProgressionChart points={points} />
            )}

            <StatsGrid stats={stats} />
          </>
        )}

        <View style={{ marginTop: spacing.xxl, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Voir vos statistiques agrégées"
            hitSlop={hitSlop}
            onPress={() => router.push('/(app)/stats' as never)}
            style={({ pressed }) => [s.linkPress, pressed && { opacity: 0.6 }]}
          >
            <Text style={s.link}>Voir vos statistiques agrégées</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

/**
 * Courbe du meilleur tour par séance. Axe Y = temps (le rapide en bas) :
 * une suite de chronos décroissants fait descendre la ligne. Ligne or à
 * halo, points or, dernière séance accentuée. Aucune bande de performance.
 */
function ProgressionChart({ points }: { points: SessionPoint[] }) {
  const W = 320;
  const H = 180;

  // Domaine vertical dérivé des données, avec marge de respiration.
  const values = points.map((p) => p.bestSeconds);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pad = span * 0.18;
  const yHi = hi + pad; // borne haute = plus lent (en haut)
  const yLo = Math.max(0, lo - pad); // borne basse = plus rapide (en bas)
  const yFor = (t: number) => ((yHi - t) / (yHi - yLo)) * H;

  const xStep = points.length > 1 ? W / (points.length - 1) : 0;
  const xy = points.map((p, i) => ({ x: i * xStep, y: yFor(p.bestSeconds) }));

  const pathD =
    xy.length === 0
      ? ''
      : `M ${xy[0].x.toFixed(1)},${xy[0].y.toFixed(1)} ` +
        xy
          .slice(1)
          .map((p) => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`)
          .join(' ');

  // Animation draw-on de la courbe (~1.2s ease-out)
  const dashOffset = useRef(new Animated.Value(1)).current;
  const pathLength = useMemo(() => {
    let total = 0;
    for (let i = 1; i < xy.length; i++) {
      const dx = xy[i].x - xy[i - 1].x;
      const dy = xy[i].y - xy[i - 1].y;
      total += Math.sqrt(dx * dx + dy * dy);
    }
    return total;
  }, [xy]);
  useEffect(() => {
    dashOffset.setValue(1);
    Animated.timing(dashOffset, {
      toValue: 0,
      duration: 1200,
      delay: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [dashOffset, pathD]);
  const interpolatedOffset = dashOffset.interpolate({
    inputRange: [0, 1],
    outputRange: [0, pathLength],
  });

  const lastIdx = xy.length - 1;

  // Résumé textuel pour lecteur d'écran : un fait, pas une courbe à deviner.
  const a11ySummary = `Meilleur tour sur ${points.length} séances, de ${formatLapTime(
    points[0].bestSeconds
  )} à ${formatLapTime(points[lastIdx].bestSeconds)}.`;

  return (
    <View
      style={s.chartPanel}
      accessible
      accessibilityRole="image"
      accessibilityLabel={a11ySummary}
    >
      <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
        {/* Halo de la courbe (glow or, faible opacité) */}
        <AnimatedPath
          d={pathD}
          stroke={palette.gold}
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={0.16}
          strokeDasharray={`${pathLength}`}
          strokeDashoffset={interpolatedOffset}
        />
        {/* Courbe nette — draw-on progressif (~1.2s) */}
        <AnimatedPath
          d={pathD}
          stroke={palette.gold}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray={`${pathLength}`}
          strokeDashoffset={interpolatedOffset}
        />

        {/* Points — dernière séance accentuée (« vous êtes ici ») */}
        {xy.map((p, i) =>
          i === lastIdx ? (
            <Circle key={i} cx={p.x} cy={p.y} r={9} fill={palette.gold} opacity={0.18} />
          ) : (
            <Circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={3}
              fill={palette.night}
              stroke={palette.gold}
              strokeWidth={1.5}
            />
          )
        )}
        {xy[lastIdx] ? (
          <Circle cx={xy[lastIdx].x} cy={xy[lastIdx].y} r={5} fill={palette.gold} />
        ) : null}
      </Svg>

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: spacing.sm,
        }}
      >
        <Text style={s.axis}>
          {points[0]?.startedAt
            ? new Date(points[0].startedAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
              })
            : ''}
        </Text>
        <Text style={s.axis}>
          {points[points.length - 1]?.startedAt
            ? new Date(points[points.length - 1].startedAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
              })
            : ''}
        </Text>
      </View>
    </View>
  );
}

function StatsGrid({ stats }: { stats: { count: number; best: number; median: number } }) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      <Fact label="Séances" value={String(stats.count)} />
      <Fact label="Meilleur tour" value={formatLapTime(stats.best)} accent />
      <Fact label="Tour médian" value={formatLapTime(stats.median)} />
    </View>
  );
}

/**
 * Encart « depuis la dernière séance » — cœur du pilier Évolution.
 * Constat factuel : le delta du meilleur tour vs la séance précédente.
 * Jamais un jugement (« mieux »/« moins bien ») — le signe, la valeur en
 * secondes, et une formulation descriptive (« plus rapide »/« plus lent »).
 * Aucun rouge : une dégradation reste neutre (or), l'amélioration en vert.
 */
function LastSessionDelta({
  current,
  previous,
  delta,
}: {
  current: number;
  previous: number;
  delta: number;
}) {
  const stable = Math.abs(delta) < 0.05;
  const word = stable ? 'stable' : delta < 0 ? 'plus rapide' : 'plus lent';
  const accent = stable ? palette.creamMute : delta < 0 ? palette.green : palette.gold;

  return (
    <View style={s.deltaPanel}>
      <View style={{ flex: 1, paddingRight: spacing.md }}>
        <Text style={s.eyebrowSmall}>Depuis votre dernière séance</Text>
        <Text style={[s.deltaBody, { marginTop: spacing.xs }]}>
          Meilleur tour {word} · {formatLapTime(previous)} → {formatLapTime(current)}
        </Text>
      </View>
      <Text style={[s.deltaValue, { color: accent }]}>
        {stable ? '±0,0 s' : formatDeltaSeconds(delta)}
      </Text>
    </View>
  );
}

function computeStats(sessions: SessionPoint[]): {
  count: number;
  best: number;
  median: number;
} {
  if (sessions.length === 0) return { count: 0, best: 0, median: 0 };
  const times = sessions.map((p) => p.bestSeconds).sort((a, b) => a - b);
  const best = times[0]; // le plus petit chrono = le meilleur
  const mid = Math.floor(times.length / 2);
  const median = times.length % 2 ? times[mid] : (times[mid - 1] + times[mid]) / 2;
  return { count: sessions.length, best, median };
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
  eyebrowSmall: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.h3,
    letterSpacing: 0.5,
    color: palette.cream,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  chartPanel: {
    backgroundColor: palette.card2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.line,
    padding: spacing.md,
    marginBottom: spacing.xl,
    // halo or discret (iOS) — la donnée respire sans juger
    shadowColor: palette.gold,
    shadowOpacity: 0.15,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  deltaPanel: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: palette.card2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.line,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  axis: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },
  linkPress: {
    minHeight: 44,
    justifyContent: 'center' as const,
    paddingHorizontal: spacing.sm,
  },
  link: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: palette.creamMute,
    textDecorationLine: 'underline' as const,
  },
  deltaBody: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamSoft,
  },
  deltaValue: {
    fontFamily: fonts.mono,
    fontSize: fontSize.value,
    color: palette.cream,
  },
};
