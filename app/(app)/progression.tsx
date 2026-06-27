/**
 * Écran #17 — Progression. Design V2 (charte oxv-mirror-app).
 *
 * Courbe SVG simple de la marge globale sur les N dernières sessions,
 * avec bandes de fond colorisées par zone (vert/jaune/rouge), sélecteur
 * de granularité (semaine / mois / tout) et stats personnels en bas.
 *
 * Doctrine : aucune comparaison avec d'autres pilotes. C'est uniquement
 * la trajectoire personnelle dans le temps. Phrase manifeste sobre
 * "Vous avancez."
 *
 * État vide pédagogique si moins de 3 sessions : on n'affiche pas la
 * courbe pour éviter une visualisation trompeuse.
 *
 * Reskin V2 : Screen + AppBar, Card/SectionLabel/Segmented/Fact du kit.
 * Le code SVG et les calculs de la courbe sont inchangés.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { router } from 'expo-router';

import { type RecentAnalysisRow, listRecentAnalyses } from '@/services/analysesService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Fact } from '@/ui/Fact';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { Segmented } from '@/ui/Segmented';

const AnimatedPath = Animated.createAnimatedComponent(Path);

type Granularity = 'week' | 'month' | 'all';

const GRAN_OPTIONS: { id: Granularity; label: string }[] = [
  { id: 'week', label: 'Semaine' },
  { id: 'month', label: 'Mois' },
  { id: 'all', label: 'Tout' },
];

export default function ProgressionScreen() {
  const profile = useAuthStore((s) => s.profile);
  const [analyses, setAnalyses] = useState<RecentAnalysisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState<Granularity>('all');

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    listRecentAnalyses(profile.id, 100)
      .then((rows) => {
        if (!cancelled) {
          setAnalyses(rows);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const filtered = useMemo(() => {
    if (granularity === 'all') return analyses;
    const cutoffDays = granularity === 'week' ? 7 : 30;
    const cutoff = Date.now() - cutoffDays * 24 * 60 * 60 * 1000;
    return analyses.filter((a) => new Date(a.sessionStartedAt).getTime() >= cutoff);
  }, [analyses, granularity]);

  // Points ordonnés chronologiquement croissants pour la courbe.
  const points = useMemo(() => [...filtered].reverse(), [filtered]);

  const stats = useMemo(() => computeStats(analyses), [analyses]);

  // §3.3 — cœur du pilier Évolution : cette session VS la précédente.
  // analyses est trié décroissant (plus récente en tête).
  const lastDelta = useMemo(() => {
    if (analyses.length < 2) return null;
    const current = Number(analyses[0].marginGlobal);
    const previous = Number(analyses[1].marginGlobal);
    if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
    return { current, previous, delta: current - previous };
  }, [analyses]);

  if (loading) {
    return (
      <Screen scroll={false}>
        <AppBar title="PROGRESSION" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.palette.creamMute} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="PROGRESSION" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.title}>Vous avancez.</Text>

        {/* §3.3 — depuis la dernière session (constat neutre, vs soi) */}
        {lastDelta ? <LastSessionDelta {...lastDelta} /> : null}

        {analyses.length < 3 ? (
          <EmptyState count={analyses.length} />
        ) : (
          <>
            <View style={{ marginBottom: theme.spacing.xl }}>
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
              <Text style={s.periodEmpty}>Pas assez de sessions sur la période sélectionnée.</Text>
            ) : (
              <ProgressionChart points={points} />
            )}

            <StatsGrid stats={stats} />
          </>
        )}

        <View style={{ marginTop: theme.spacing.xxl, alignItems: 'center', gap: theme.spacing.lg }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/(app)/stats' as never)}
          >
            <Text style={s.link}>Voir vos statistiques agrégées</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

function ProgressionChart({ points }: { points: RecentAnalysisRow[] }) {
  const W = 320;
  const H = 180;
  // Bandes : rouge < 15, jaune 15-30, vert > 30. En SVG Y inversé.
  const yForMargin = (m: number) => H - (Math.max(0, Math.min(100, m)) / 100) * H;
  const yRedTop = yForMargin(15);
  const yYellowTop = yForMargin(30);

  const xStep = points.length > 1 ? W / (points.length - 1) : 0;
  const xy = points.map((p, i) => ({
    x: i * xStep,
    y: yForMargin(Number(p.marginGlobal)),
  }));

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
  // Longueur approximative de la polyline (somme des segments)
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

  return (
    <Card style={{ marginBottom: theme.spacing.xl }}>
      <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
        {/* Bande verte (haut) */}
        <Rect
          x={0}
          y={0}
          width={W}
          height={yYellowTop}
          fill={theme.dataColors.accel}
          opacity={0.08}
        />
        {/* Bande jaune (milieu) */}
        <Rect
          x={0}
          y={yYellowTop}
          width={W}
          height={yRedTop - yYellowTop}
          fill={theme.palette.gold}
          opacity={0.1}
        />
        {/* Bande rouge (bas) */}
        <Rect
          x={0}
          y={yRedTop}
          width={W}
          height={H - yRedTop}
          fill={theme.palette.red}
          opacity={0.1}
        />

        {/* Courbe — draw-on progressif gauche à droite (~1.2s) */}
        <AnimatedPath
          d={pathD}
          stroke={theme.palette.cream}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray={`${pathLength}`}
          strokeDashoffset={interpolatedOffset}
        />

        {/* Points */}
        {xy.map((p, i) => (
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3}
            fill={theme.palette.night}
            stroke={theme.palette.cream}
            strokeWidth={1.5}
          />
        ))}
      </Svg>

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: theme.spacing.sm,
        }}
      >
        <Text style={s.axis}>
          {points[0]?.sessionStartedAt
            ? new Date(points[0].sessionStartedAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
              })
            : ''}
        </Text>
        <Text style={s.axis}>
          {points[points.length - 1]?.sessionStartedAt
            ? new Date(points[points.length - 1].sessionStartedAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
              })
            : ''}
        </Text>
      </View>
    </Card>
  );
}

function StatsGrid({ stats }: { stats: { count: number; avg: number; best: number } }) {
  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
      <Fact label="Sessions" value={String(stats.count)} />
      <Fact label="Marge moyenne" value={String(Math.round(stats.avg))} unit="%" />
      <Fact label="Meilleure" value={String(Math.round(stats.best))} unit="%" />
    </View>
  );
}

function EmptyState({ count }: { count: number }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.xxl }}>
      <Text style={s.emptyTitle}>Votre progression apparaîtra après 3 sessions complètes.</Text>
      <Text style={s.emptyHint}>
        {count === 0
          ? 'Aucune session pour le moment.'
          : count === 1
            ? '1 session enregistrée.'
            : `${count} sessions enregistrées.`}
      </Text>
    </Card>
  );
}

/**
 * Encart « depuis la dernière session » — le cœur du pilier §3.3.
 * Constat factuel neutre : le delta de marge vs la session précédente.
 * Jamais un jugement (« mieux »/« moins bien ») — juste le signe et la
 * valeur, avec une formulation descriptive (« en hausse »/« stable »).
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
  const rounded = Math.round(delta);
  const stable = Math.abs(rounded) < 1;
  const word = stable ? 'stable' : rounded > 0 ? 'en hausse' : 'en baisse';
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '±';
  const accent = stable
    ? theme.palette.creamMute
    : rounded > 0
      ? theme.dataColors.accel
      : theme.palette.gold;

  return (
    <Card
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: theme.spacing.xl,
      }}
    >
      <View style={{ flex: 1, paddingRight: theme.spacing.md }}>
        <SectionLabel>Depuis votre dernière session</SectionLabel>
        <Text style={[s.deltaBody, { marginTop: theme.spacing.xs }]}>
          Marge {word} · {Math.round(previous)} % → {Math.round(current)} %
        </Text>
      </View>
      <Text style={[s.deltaValue, { color: accent }]}>
        {stable ? '±0' : `${sign}${Math.abs(rounded)}`}
        <Text style={s.deltaUnit}> pts</Text>
      </Text>
    </Card>
  );
}

function computeStats(analyses: RecentAnalysisRow[]): {
  count: number;
  avg: number;
  best: number;
} {
  if (analyses.length === 0) return { count: 0, avg: 0, best: 0 };
  const margins = analyses.map((a) => Number(a.marginGlobal));
  const sum = margins.reduce((s, m) => s + m, 0);
  return {
    count: analyses.length,
    avg: sum / analyses.length,
    best: Math.max(...margins),
  };
}

const s = {
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  periodEmpty: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.xxl,
    marginBottom: theme.spacing.xl,
  },
  axis: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  link: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
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
    marginTop: theme.spacing.sm,
  },
  deltaBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamSoft,
  },
  deltaValue: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.value,
    color: theme.palette.cream,
  },
  deltaUnit: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
};
