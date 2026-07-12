/**
 * Progression & Constance — zone Miroir. Reskin FIDÈLE aux maquettes Claude
 * Design refonte-v2 §7.4 (screens/04-progression.png), décision fondateur
 * 2026-07-12.
 *
 * Deux modules (maquette) :
 *   MODULE 1 — MEILLEUR TOUR : chiffre roi OR (~40px mono) « dernière séance »,
 *   courbe en AIRE or (gradient sous la ligne, points cerclés, dernier point
 *   plein + « votre record »), axes premier→dernier mois, phrase self-only.
 *   MODULE 2 — CONSTANCE : ±X,XX s VIOLET (~40px), histogramme des tours de la
 *   dernière séance (barres violet sombre #3A2E52, le meilleur tour en OR),
 *   légende T1 / ◆ votre meilleur / TN, phrase descriptive.
 *
 * Convention maquette : l'amélioration monte (le record en haut à droite).
 * Soi contre soi, jamais un classement. Substance préservée SOUS les modules
 * (parti A) : delta dernière séance, stats, sous-vues. Vouvoiement.
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { router } from 'expo-router';

import { EmptyState, Fact } from '@/components/instruments';
import { computeRegularity } from '@/services/regularityService';
import { fetchAllSessions, fetchSessionLaps } from '@/services/sessionsService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { StateWrapper } from '@/ui/StateWrapper';
import { formatLapTime } from '@/utils/format';

const { palette, dataColors, fonts, fontSize, spacing, radius, hitSlop } = theme;

/** Violet sombre des barres de constance (maquette §7.4). */
const BAR_INACTIVE = '#3A2E52';

// Sous-vues de la zone Progression — accès conservé (substance).
const PROGRESSION_VIEWS: { label: string; hint: string; href: string }[] = [
  { label: 'Passeport', hint: 'Votre identité de pilote, cumulée', href: '/(app)/passeport' },
  {
    label: 'Signature',
    hint: 'Ce qui rend votre pilotage reconnaissable',
    href: '/(app)/signature',
  },
  { label: 'Constance', hint: 'Votre régularité, tour après tour', href: '/(app)/regularite' },
  { label: 'Comparateur', hint: 'Vous contre vous, jamais les autres', href: '/(app)/comparateur' },
  { label: 'Carnet', hint: 'Vos notes libres, séance après séance', href: '/(app)/carnet' },
  { label: 'Programme', hint: 'Ce que votre coach a partagé', href: '/(app)/programme' },
  { label: 'Historique', hint: 'Toutes vos séances', href: '/(app)/roulages' },
];

type SessionPoint = {
  sessionId: string;
  startedAt: string;
  circuitName: string;
  bestSeconds: number;
};

function formatDeltaSeconds(d: number): string {
  const sign = d > 0 ? '+' : d < 0 ? '−' : '±';
  return `${sign}${Math.abs(d).toFixed(1).replace('.', ',')} s`;
}

/** « 1:24.3 » — chrono roi compact (dixième), mono. Arrondi AVANT le découpage
 *  des minutes (119,97 s → « 2:00.0 », jamais « 1:60.0 »). */
function formatBestShort(seconds: number): string {
  const t = Math.round(seconds * 10) / 10;
  const m = Math.floor(t / 60);
  const rest = t - m * 60;
  return `${m}:${rest.toFixed(1).padStart(4, '0')}`;
}

/** « JUIL » sans point final (fr-FR abrège « juil. » — la maquette n'en a pas). */
function monthLabel(iso: string): string {
  return new Date(iso)
    .toLocaleDateString('fr-FR', { month: 'short' })
    .replace(/\.$/, '')
    .toUpperCase();
}

export default function ProgressionScreen() {
  const profile = useAuthStore((s) => s.profile);
  const [sessions, setSessions] = useState<SessionPoint[]>([]);
  const [lastLaps, setLastLaps] = useState<{ lapNumber: number; durationSeconds: number }[]>([]);
  const [spreadSeconds, setSpreadSeconds] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    (async () => {
      const rows = await fetchAllSessions(profile.id, { limit: 100 });
      if (cancelled) return;
      const all = rows
        .filter((r) => r.best_lap_seconds != null && Number.isFinite(r.best_lap_seconds))
        .map((r) => ({
          sessionId: r.id,
          startedAt: r.started_at,
          circuitName: r.circuit_name,
          bestSeconds: r.best_lap_seconds as number,
        }));
      // Soi contre soi SUR LE MÊME TERRAIN : la courbe suit le circuit de la
      // dernière séance — mélanger deux circuits rendrait la progression fausse.
      const refCircuit = all[0]?.circuitName ?? null;
      const pts: SessionPoint[] = refCircuit
        ? all.filter((r) => r.circuitName === refCircuit)
        : all;
      setSessions(pts); // trié started_at décroissant

      // Module 2 — les tours de la DERNIÈRE séance (constance).
      if (pts.length > 0) {
        const laps = await fetchSessionLaps(pts[0].sessionId);
        if (cancelled) return;
        const valid = laps
          .filter((l) => !l.is_outlap && !l.is_inlap && l.duration_seconds > 0)
          .map((l) => ({ lapNumber: l.lap_number, durationSeconds: l.duration_seconds }));
        setLastLaps(valid);
        // Constance = ÉCART-TYPE (handoff §9) — même métrique que Paddock/Bilan.
        setSpreadSeconds(computeRegularity(valid).stdDevSeconds);
      }
      setLoading(false);
    })().catch(() => {
      if (!cancelled) {
        setError(true);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [profile, reloadKey]);

  // Points chronologiques croissants pour la courbe (module 1).
  const points = useMemo(() => [...sessions].reverse(), [sessions]);
  const stats = useMemo(() => computeStats(sessions), [sessions]);

  const lastDelta = useMemo(() => {
    if (sessions.length < 2) return null;
    const current = sessions[0].bestSeconds;
    const previous = sessions[1].bestSeconds;
    if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
    return { current, previous, delta: current - previous };
  }, [sessions]);

  if (loading || error) {
    return (
      <Screen>
        <AppBar title="Progression" onBack={() => router.back()} />
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl }}>
          <StateWrapper
            state={error ? 'error' : 'loading'}
            skeletonLines={4}
            errorCause="Votre progression n'a pas pu être chargée."
            onRetry={() => setReloadKey((k) => k + 1)}
          >
            {null}
          </StateWrapper>
        </View>
      </Screen>
    );
  }

  const lastBest = sessions[0]?.bestSeconds ?? null;

  return (
    <Screen>
      <AppBar title="Progression" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        {/* ── MODULE 1 — MEILLEUR TOUR ─────────────────────────────────── */}
        <Text style={[s.moduleEyebrow, { color: palette.gold }]}>
          MEILLEUR TOUR · SÉANCE APRÈS SÉANCE
        </Text>
        {lastBest != null ? (
          <View style={s.kingRow}>
            <Text style={[s.kingNumber, { color: palette.gold }]}>{formatBestShort(lastBest)}</Text>
            <Text style={s.kingSub}>dernière séance</Text>
          </View>
        ) : null}

        {sessions.length < 3 ? (
          <View style={{ marginTop: spacing.lg }}>
            <EmptyState
              message={`Votre trajectoire apparaîtra après 3 séances complètes. ${sessions.length} enregistrée${sessions.length > 1 ? 's' : ''} pour l'instant.`}
            />
          </View>
        ) : (
          <>
            <BestLapAreaChart points={points} />
            <View style={s.axisRow}>
              <Text style={s.axis}>{points[0] ? monthLabel(points[0].startedAt) : ''}</Text>
              <Text style={s.axis}>
                {points[points.length - 1] ? monthLabel(points[points.length - 1].startedAt) : ''}
              </Text>
            </View>
            <Text style={s.modulePhrase}>
              Vous gagnez du temps, séance après séance. Juste vous, pas de classement.
            </Text>
          </>
        )}

        {/* ── MODULE 2 — CONSTANCE ─────────────────────────────────────── */}
        {lastLaps.length >= 2 && spreadSeconds != null ? (
          <>
            <View style={s.separator} />
            <Text style={[s.moduleEyebrow, { color: dataColors.regularity }]}>
              CONSTANCE · VOS TOURS
            </Text>
            <View style={s.kingRow}>
              <Text style={[s.kingNumber, { color: dataColors.regularity }]}>
                ±{spreadSeconds.toFixed(2).replace('.', ',')}
              </Text>
              <Text style={s.kingSub}>s d&apos;écart</Text>
            </View>
            <ConstancyBars laps={lastLaps} />
            <Text style={s.modulePhrase}>
              Des barres presque égales — vous êtes régulier. Le tour en or est votre meilleur.
            </Text>
          </>
        ) : null}

        {/* ── Substance sous les modules (parti A) ─────────────────────── */}

        {lastDelta ? (
          <View style={s.deltaPanel}>
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <Text style={s.eyebrowSmall}>Depuis votre dernière séance</Text>
              <Text style={[s.deltaBody, { marginTop: spacing.xs }]}>
                Meilleur tour{' '}
                {Math.abs(lastDelta.delta) < 0.05
                  ? 'stable'
                  : lastDelta.delta < 0
                    ? 'plus rapide'
                    : 'plus lent'}{' '}
                · {formatLapTime(lastDelta.previous)} → {formatLapTime(lastDelta.current)}
              </Text>
            </View>
            <Text
              style={[
                s.deltaValue,
                {
                  color:
                    Math.abs(lastDelta.delta) < 0.05
                      ? palette.creamMute
                      : lastDelta.delta < 0
                        ? palette.green
                        : palette.creamMute,
                },
              ]}
            >
              {Math.abs(lastDelta.delta) < 0.05 ? '±0,0 s' : formatDeltaSeconds(lastDelta.delta)}
            </Text>
          </View>
        ) : null}

        {sessions.length >= 3 ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Fact label="Séances" value={String(stats.count)} />
            <Fact label="Meilleur tour" value={formatLapTime(stats.best)} accent />
            <Fact label="Tour médian" value={formatLapTime(stats.median)} />
          </View>
        ) : null}

        {/* Vos lectures — sous-vues de la zone. */}
        <Text style={[s.eyebrowSmall, { marginTop: spacing.xxl, marginBottom: spacing.md }]}>
          VOS LECTURES
        </Text>
        <View style={{ gap: spacing.sm }}>
          {PROGRESSION_VIEWS.map((v) => (
            <Card
              key={v.href}
              onPress={() => router.push(v.href as never)}
              accessibilityLabel={`${v.label}. ${v.hint}`}
            >
              <Text style={s.navLabel}>{v.label}</Text>
              <Text style={s.navHint}>{v.hint}</Text>
            </Card>
          ))}
        </View>

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
 * Courbe en AIRE du meilleur tour (maquette) : ligne OR + gradient sous la
 * ligne, points cerclés, dernier point plein labellisé « votre record ».
 * Convention maquette : l'amélioration MONTE (chrono plus bas = point plus haut).
 */
function BestLapAreaChart({ points }: { points: SessionPoint[] }) {
  const W = 320;
  const H = 150;
  const PAD_TOP = 22;
  const PAD_BOTTOM = 10;

  const values = points.map((p) => p.bestSeconds);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  // Plus rapide (lo) → plus HAUT (maquette : le record culmine).
  const yFor = (t: number) => PAD_TOP + ((t - lo) / span) * (H - PAD_TOP - PAD_BOTTOM);

  const xStep = points.length > 1 ? (W - 12) / (points.length - 1) : 0;
  const xy = points.map((p, i) => ({ x: 6 + i * xStep, y: yFor(p.bestSeconds) }));
  const lastIdx = xy.length - 1;

  const lineD =
    `M ${xy[0].x.toFixed(1)},${xy[0].y.toFixed(1)} ` +
    xy
      .slice(1)
      .map((p) => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');
  const areaD = `${lineD} L ${xy[lastIdx].x.toFixed(1)},${H} L ${xy[0].x.toFixed(1)},${H} Z`;

  const a11ySummary = `Meilleur tour sur ${points.length} séances, de ${formatLapTime(
    points[0].bestSeconds
  )} à ${formatLapTime(points[lastIdx].bestSeconds)}.`;

  return (
    <View
      style={s.chartFrame}
      accessible
      accessibilityRole="image"
      accessibilityLabel={a11ySummary}
    >
      <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
        <Defs>
          <LinearGradient id="goldArea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={palette.gold} stopOpacity={0.28} />
            <Stop offset="1" stopColor={palette.gold} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>
        {/* aire sous la ligne (gradient or) */}
        <Path d={areaD} fill="url(#goldArea)" />
        {/* ligne or */}
        <Path
          d={lineD}
          stroke={palette.gold}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* points cerclés + dernier plein « votre record » */}
        {xy.map((p, i) =>
          i === lastIdx ? null : (
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
        <Circle cx={xy[lastIdx].x} cy={xy[lastIdx].y} r={4.5} fill={palette.gold} />
        <SvgText
          x={Math.min(xy[lastIdx].x, W - 8)}
          y={Math.max(10, xy[lastIdx].y - 10)}
          fill={palette.gold}
          fontSize={9}
          fontFamily={fonts.mono}
          textAnchor="end"
        >
          votre record
        </SvgText>
      </Svg>
    </View>
  );
}

/**
 * Histogramme de constance (maquette) : une barre par tour de la dernière
 * séance, violet sombre — la barre du MEILLEUR tour en OR, et la plus COURTE
 * (hauteur = durée du tour : plus rapide = plus court, encodage maquette).
 * Légende T1 / ◆ votre meilleur / TN. Des barres presque égales = régularité.
 */
function ConstancyBars({ laps }: { laps: { lapNumber: number; durationSeconds: number }[] }) {
  const W = 320;
  const H = 84;
  const n = laps.length;
  // Gap dérivé de n : au-delà de ~27 tours, un gap fixe ferait déborder le viewBox.
  const gap = Math.min(6, W / (3 * n));
  const barW = (W - gap * (n - 1)) / n;
  const durations = laps.map((l) => l.durationSeconds);
  const lo = Math.min(...durations);
  const hi = Math.max(...durations);
  const span = hi - lo || 1;
  // Hauteur = durée (le rapide est plus court). La variation ne module que le
  // tiers supérieur : des tours presque égaux donnent des barres presque égales.
  const hFor = (d: number) => H * 0.55 + ((d - lo) / span) * H * 0.35;
  const bestIdx = durations.indexOf(lo);
  const bestLapNumber = laps[bestIdx]?.lapNumber ?? bestIdx + 1;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Régularité sur ${n} tours ; le meilleur est le tour ${bestLapNumber}.`}
    >
      <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
        {durations.map((d, i) => {
          const h = hFor(d);
          return (
            <Rect
              key={i}
              x={i * (barW + gap)}
              y={H - h}
              width={barW}
              height={h}
              rx={2}
              fill={i === bestIdx ? palette.gold : BAR_INACTIVE}
            />
          );
        })}
      </Svg>
      <View style={s.axisRow}>
        <Text style={s.axis}>T1</Text>
        <Text style={[s.axis, { color: palette.gold }]}>◆ votre meilleur</Text>
        <Text style={s.axis}>T{n}</Text>
      </View>
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
  const best = times[0];
  const mid = Math.floor(times.length / 2);
  const median = times.length % 2 ? times[mid] : (times[mid - 1] + times[mid]) / 2;
  return { count: sessions.length, best, median };
}

const s = {
  moduleEyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 1.8,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
    marginTop: spacing.lg,
  },
  kingRow: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    gap: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  kingNumber: {
    fontFamily: fonts.king,
    fontSize: 40,
    letterSpacing: -1.5,
  },
  kingSub: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    color: palette.creamMute,
  },
  chartFrame: {
    backgroundColor: palette.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.borderHair,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  axisRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    marginTop: spacing.sm,
  },
  axis: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },
  modulePhrase: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.6,
    marginTop: spacing.lg,
  },
  separator: {
    height: 1,
    backgroundColor: palette.separator,
    marginVertical: spacing.xxl,
  },
  eyebrowSmall: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
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
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
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
  navLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.bodyLg,
    color: palette.cream,
  },
  navHint: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: spacing.xs,
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
};
