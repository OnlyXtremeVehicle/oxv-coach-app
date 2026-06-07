/**
 * Écran #17 — Progression.
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
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { router } from 'expo-router';

import { type RecentAnalysisRow, listRecentAnalyses } from '@/services/analysesService';
import { useAuthStore } from '@/store/useAuthStore';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);

type Granularity = 'week' | 'month' | 'all';

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
    listRecentAnalyses(profile.id, 100).then((rows) => {
      if (!cancelled) {
        setAnalyses(rows);
        setLoading(false);
      }
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
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.background.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={colors.text.secondary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>PROGRESSION</Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.xl }]}>
          Vous avancez.
        </Text>

        {/* §3.3 — depuis la dernière session (constat neutre, vs soi) */}
        {lastDelta ? <LastSessionDelta {...lastDelta} /> : null}

        {analyses.length < 3 ? (
          <EmptyState count={analyses.length} />
        ) : (
          <>
            <GranularityPicker value={granularity} onChange={setGranularity} />

            {points.length < 2 ? (
              <Text
                style={[
                  typography.caption,
                  { marginTop: spacing.xxl, color: colors.text.tertiary, textAlign: 'center' },
                ]}
              >
                Pas assez de sessions sur la période sélectionnée.
              </Text>
            ) : (
              <ProgressionChart points={points} />
            )}

            <StatsGrid stats={stats} />
          </>
        )}

        <View style={{ marginTop: spacing.xxl, alignItems: 'center', gap: spacing.lg }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/(app)/stats' as never)}
          >
            <Text
              style={{
                color: colors.text.secondary,
                fontSize: fontSize.caption,
                textDecorationLine: 'underline',
              }}
            >
              Voir vos statistiques agrégées
            </Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>Retour</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function GranularityPicker({
  value,
  onChange,
}: {
  value: Granularity;
  onChange: (g: Granularity) => void;
}) {
  const options: { id: Granularity; label: string }[] = [
    { id: 'week', label: 'Semaine' },
    { id: 'month', label: 'Mois' },
    { id: 'all', label: 'Tout' },
  ];

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.xl,
      }}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <Pressable
            accessibilityRole="button"
            key={opt.id}
            onPress={() => onChange(opt.id)}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: spacing.sm,
              borderRadius: borderRadius.md,
              borderWidth: 1,
              borderColor: active ? colors.accent.red : colors.border.subtle,
              backgroundColor: active ? 'rgba(200, 16, 46, 0.10)' : 'transparent',
              alignItems: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                color: active ? colors.text.primary : colors.text.secondary,
                fontSize: fontSize.caption,
                fontWeight: active ? fontWeight.medium : fontWeight.regular,
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
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
    <View
      style={{
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        borderWidth: 0.5,
        borderColor: colors.border.subtle,
        padding: spacing.md,
        marginBottom: spacing.xl,
      }}
    >
      <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
        {/* Bande verte (haut) */}
        <Rect x={0} y={0} width={W} height={yYellowTop} fill={colors.margin.green} opacity={0.08} />
        {/* Bande jaune (milieu) */}
        <Rect
          x={0}
          y={yYellowTop}
          width={W}
          height={yRedTop - yYellowTop}
          fill={colors.margin.yellow}
          opacity={0.1}
        />
        {/* Bande rouge (bas) */}
        <Rect
          x={0}
          y={yRedTop}
          width={W}
          height={H - yRedTop}
          fill={colors.margin.red}
          opacity={0.1}
        />

        {/* Courbe — draw-on progressif gauche à droite (~1.2s) */}
        <AnimatedPath
          d={pathD}
          stroke={colors.text.primary}
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
            fill={colors.background.primary}
            stroke={colors.text.primary}
            strokeWidth={1.5}
          />
        ))}
      </Svg>

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: spacing.sm,
        }}
      >
        <Text style={[typography.caption, { color: colors.text.tertiary }]}>
          {points[0]?.sessionStartedAt
            ? new Date(points[0].sessionStartedAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
              })
            : ''}
        </Text>
        <Text style={[typography.caption, { color: colors.text.tertiary }]}>
          {points[points.length - 1]?.sessionStartedAt
            ? new Date(points[points.length - 1].sessionStartedAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
              })
            : ''}
        </Text>
      </View>
    </View>
  );
}

function StatsGrid({ stats }: { stats: { count: number; avg: number; best: number } }) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      <StatCard label="Sessions" value={String(stats.count)} />
      <StatCard label="Marge moyenne" value={`${Math.round(stats.avg)}%`} />
      <StatCard label="Meilleure" value={`${Math.round(stats.best)}%`} />
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flex: 1,
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        borderWidth: 0.5,
        borderColor: colors.border.subtle,
        backgroundColor: colors.background.secondary,
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          color: colors.text.primary,
          fontSize: fontSize.titleLarge,
          fontWeight: fontWeight.ultralight,
          marginBottom: spacing.xs,
        }}
      >
        {value}
      </Text>
      <Text style={[typography.caption, { textAlign: 'center' }]}>{label}</Text>
    </View>
  );
}

function EmptyState({ count }: { count: number }) {
  return (
    <View
      style={{
        marginTop: spacing.xxxl,
        padding: spacing.xl,
        borderRadius: borderRadius.lg,
        borderWidth: 0.5,
        borderColor: colors.border.subtle,
        backgroundColor: colors.background.secondary,
        alignItems: 'center',
      }}
    >
      <Text style={[typography.manifest, { textAlign: 'center', marginBottom: spacing.lg }]}>
        Votre progression apparaîtra après 3 sessions complètes.
      </Text>
      <Text style={[typography.caption, { color: colors.text.tertiary }]}>
        {count === 0
          ? 'Aucune session pour le moment.'
          : count === 1
            ? '1 session enregistrée.'
            : `${count} sessions enregistrées.`}
      </Text>
    </View>
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
    ? colors.text.secondary
    : rounded > 0
      ? colors.margin.green
      : colors.margin.yellow;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        borderWidth: 0.5,
        borderColor: colors.border.subtle,
        backgroundColor: colors.background.secondary,
        marginBottom: spacing.xl,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={[typography.eyebrow, { color: colors.text.tertiary, marginBottom: spacing.xs }]}
        >
          DEPUIS VOTRE DERNIÈRE SESSION
        </Text>
        <Text style={{ color: colors.text.secondary, fontSize: fontSize.caption }}>
          Marge {word} · {Math.round(previous)} % → {Math.round(current)} %
        </Text>
      </View>
      <Text
        style={{
          color: accent,
          fontSize: fontSize.titleLarge,
          fontWeight: fontWeight.light,
          fontFamily: 'Menlo',
        }}
      >
        {stable ? '±0' : `${sign}${Math.abs(rounded)}`}
        <Text style={{ fontSize: fontSize.caption, color: colors.text.tertiary }}> pts</Text>
      </Text>
    </View>
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
