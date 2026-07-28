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

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
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

import { SourceMethodBlock } from '@/components/InsightTransparency';
import { EmptyState, Fact } from '@/components/instruments';
import {
  AnimatedPresence,
  BreathingGlow,
  DrawInPath,
  FadeInSection,
  polylineLength,
  PressableScale,
  Stagger,
  useReduceMotion,
} from '@/components/motion';
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
  // Écart-type des tours de la dernière séance (le nom dit ce que c'est —
  // regularityService expose AUSSI un spreadSeconds = amplitude, à ne pas confondre).
  const [stdDevSeconds, setStdDevSeconds] = useState<number | null>(null);
  const [regularityManifest, setRegularityManifest] = useState<string | null>(null);
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
      // strict : une panne réseau affiche l'état ERREUR + retry, jamais un faux
      // « 0 séance enregistrée » (fait inventé).
      const rows = await fetchAllSessions(profile.id, { limit: 100, strict: true });
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
        const laps = await fetchSessionLaps(pts[0].sessionId, { strict: true });
        if (cancelled) return;
        const valid = laps
          .filter((l) => !l.is_outlap && !l.is_inlap && l.duration_seconds > 0)
          .map((l) => ({ lapNumber: l.lap_number, durationSeconds: l.duration_seconds }));
        setLastLaps(valid);
        // Constance = ÉCART-TYPE (handoff §9) — même métrique que Paddock/Bilan.
        const reg = computeRegularity(valid);
        setStdDevSeconds(reg.stdDevSeconds);
        setRegularityManifest(reg.manifest);
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
      <View style={{ paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl }}>
        {/* ── MODULE 1 — MEILLEUR TOUR ─────────────────────────────────── */}
        <FadeInSection>
          <Text style={[s.moduleEyebrow, { color: palette.gold }]}>
            MEILLEUR TOUR · SÉANCE APRÈS SÉANCE
          </Text>
          {lastBest != null ? (
            <>
              {/* Le chiffre roi OR respire discrètement (l'unique de l'écran). */}
              <BreathingGlow style={s.kingRow}>
                <Text style={[s.kingNumber, { color: palette.gold }]}>
                  {formatBestShort(lastBest)}
                </Text>
                <Text style={s.kingSub}>dernière séance</Text>
              </BreathingGlow>
              {/* Lecture (retour build 23) — ce qu'on regarde, en une phrase simple.
                  Descriptif, jamais prescriptif. */}
              <Text style={s.lectureLine}>
                Votre meilleur tour de la dernière séance sur ce circuit.
                {sessions.length >= 3
                  ? ' La courbe retrace ce chrono, séance après séance — quand il baisse, elle monte.'
                  : ''}
              </Text>
            </>
          ) : null}
        </FadeInSection>

        {sessions.length < 3 ? (
          <FadeInSection delay={80}>
            <View style={{ marginTop: spacing.lg }}>
              <EmptyState
                message={`Votre trajectoire apparaîtra après 3 séances complètes. ${sessions.length} enregistrée${sessions.length > 1 ? 's' : ''} pour l'instant.`}
              />
            </View>
          </FadeInSection>
        ) : (
          <FadeInSection delay={80}>
            <BestLapAreaChart points={points} />
            <View style={s.axisRow}>
              <Text style={s.axis}>{points[0] ? monthLabel(points[0].startedAt) : ''}</Text>
              <Text style={s.axis}>
                {points[points.length - 1] ? monthLabel(points[points.length - 1].startedAt) : ''}
              </Text>
            </View>
            {/* Descriptif, jamais une conclusion de tendance inventée. */}
            <Text style={s.modulePhrase}>
              Votre meilleur tour, séance après séance. Juste vous, pas de classement.
            </Text>
          </FadeInSection>
        )}

        {/* ── MODULE 2 — CONSTANCE ─────────────────────────────────────── */}
        {lastLaps.length >= 2 && stdDevSeconds != null ? (
          <>
            <View style={s.separator} />
            <FadeInSection delay={120}>
              <Text style={[s.moduleEyebrow, { color: dataColors.regularity }]}>
                CONSTANCE · VOS TOURS
              </Text>
              <View style={s.kingRow}>
                <ConstancyKingNumber stdDevSeconds={stdDevSeconds} />
                {/* Libellé vulgarisé SANS perdre le terme technique (build 23). */}
                <Text style={s.kingSub}>s d&apos;écart-type (dispersion)</Text>
              </View>
            </FadeInSection>
            <ConstancyBars laps={lastLaps} />
            {/* Phrase DÉRIVÉE de la donnée (manifest du service), jamais figée. */}
            <FadeInSection delay={160}>
              <Text style={s.modulePhrase}>
                {regularityManifest ?? 'Vos tours, tels quels.'} Le tour en or est votre meilleur.
              </Text>
            </FadeInSection>
          </>
        ) : null}

        {/* Pédagogie (build 23) : comment lire — repliable, état local, pas un modal. */}
        {sessions.length > 0 ? (
          <HowToRead>
            <HowRow color={palette.gold}>
              L&apos;or ne dit que le chrono : la courbe du meilleur tour, la barre du meilleur
              tour, le record. Jamais un jugement.
            </HowRow>
            {sessions.length >= 3 ? (
              <HowRow>
                Sur la courbe, chaque point est une séance ; le point plein est votre record. Un
                chrono plus bas est dessiné plus haut : l&apos;amélioration monte.
              </HowRow>
            ) : null}
            <HowRow color={dataColors.regularity}>
              Le violet est la régularité. ± est l&apos;écart-type : la dispersion de vos tours
              autour de leur moyenne — plus il est petit, plus vos tours se ressemblent.
            </HowRow>
            {lastLaps.length >= 2 ? (
              <HowRow>
                L&apos;histogramme reprend la dernière séance : une barre par tour, plus courte =
                tour plus rapide. Des barres presque égales dessinent une séance régulière.
              </HowRow>
            ) : null}
            <SourceMethodBlock
              items={[
                'Chronos mesurés par le boîtier (GPS et capteurs inertiels, 25 points par seconde), tours détectés au passage de la ligne.',
                'La courbe suit un seul circuit — celui de votre dernière séance — pour comparer le comparable.',
                'La référence est votre propre historique. Aucun autre pilote, aucun classement.',
              ]}
            />
          </HowToRead>
        ) : null}

        {/* ── Substance sous les modules (parti A) ─────────────────────── */}

        {lastDelta ? (
          <FadeInSection delay={200} style={s.deltaPanel}>
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
          </FadeInSection>
        ) : null}

        {sessions.length >= 3 ? (
          <FadeInSection delay={240} style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Fact label="Séances" value={String(stats.count)} />
            <Fact label="Meilleur tour" value={formatLapTime(stats.best)} accent />
            {/* Médiane de vos MEILLEURS tours (une valeur par séance), pas le
                tour médian d'une séance — le libellé dit la population. */}
            <Fact label="Médiane des meilleurs" value={formatLapTime(stats.median)} />
          </FadeInSection>
        ) : null}

        {/* Vos lectures — sous-vues de la zone, en cascade (Stagger). */}
        <FadeInSection delay={280}>
          <Text style={[s.eyebrowSmall, { marginTop: spacing.xxl, marginBottom: spacing.md }]}>
            VOS LECTURES
          </Text>
        </FadeInSection>
        <Stagger initialDelay={320} style={{ gap: spacing.sm }}>
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
        </Stagger>

        <View style={{ marginTop: spacing.xxl, alignItems: 'center' }}>
          <PressableScale
            accessibilityRole="link"
            accessibilityLabel="Voir vos statistiques agrégées"
            hitSlop={hitSlop}
            onPress={() => router.push('/(app)/stats' as never)}
            style={s.linkPress}
          >
            <Text style={s.link}>Voir vos statistiques agrégées</Text>
          </PressableScale>
        </View>
      </View>
    </Screen>
  );
}

/**
 * Courbe en AIRE du meilleur tour (maquette) : ligne OR + gradient sous la
 * ligne, points cerclés, dernier point plein labellisé « votre record ».
 * Convention maquette : l'amélioration MONTE (chrono plus bas = point plus haut).
 * La ligne or SE DESSINE à l'apparition (DrawInPath) — le tracé final est la
 * donnée réelle, l'animation n'est qu'un chemin vers elle.
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
  // Le RECORD réel (min all-time de la fenêtre), pas le dernier point : le label
  // « votre record » ne doit jamais désigner une séance qui n'est pas le record.
  const recordIdx = values.indexOf(lo);

  const lineD =
    `M ${xy[0].x.toFixed(1)},${xy[0].y.toFixed(1)} ` +
    xy
      .slice(1)
      .map((p) => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');
  const areaD = `${lineD} L ${xy[lastIdx].x.toFixed(1)},${H} L ${xy[0].x.toFixed(1)},${H} Z`;

  const a11ySummary = `Meilleur tour sur ${points.length} séances ; record ${formatLapTime(lo)}.`;

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
        {/* ligne or — se dessine de la première à la dernière séance */}
        <DrawInPath
          d={lineD}
          length={polylineLength(xy)}
          duration={1200}
          delay={200}
          stroke={palette.gold}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* points cerclés + le point RECORD plein, labellisé « votre record » */}
        {xy.map((p, i) =>
          i === recordIdx ? null : (
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
        <Circle cx={xy[recordIdx].x} cy={xy[recordIdx].y} r={4.5} fill={palette.gold} />
        <SvgText
          x={Math.min(Math.max(xy[recordIdx].x, 40), W - 8)}
          y={Math.max(10, xy[recordIdx].y - 10)}
          fill={palette.gold}
          fontSize={9}
          fontFamily={fonts.mono}
          textAnchor={xy[recordIdx].x > W / 2 ? 'end' : 'start'}
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
  // Hauteur = durée, sur une ÉCHELLE FIXE (pleine variation visuelle = 3 s
  // au-dessus du meilleur, clampée) : un pilote régulier voit réellement des
  // barres presque égales, un pilote dispersé des barres inégales — l'échelle
  // relative min-max rendait les deux identiques.
  const FULL_SCALE_S = 3;
  const hFor = (d: number) =>
    H * 0.55 + Math.min(1, Math.max(0, (d - lo) / FULL_SCALE_S)) * H * 0.35;
  const bestIdx = durations.indexOf(lo);
  const bestLapNumber = laps[bestIdx]?.lapNumber ?? bestIdx + 1;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Régularité sur ${n} tours ; le meilleur est le tour ${bestLapNumber}.`}
    >
      {/* Les barres S'ÉTIRENT depuis la ligne de base à l'apparition (build 23). */}
      <BarsReveal height={H}>
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
      </BarsReveal>
      <View style={s.axisRow}>
        <Text style={s.axis}>T1</Text>
        <Text style={[s.axis, { color: palette.gold }]}>◆ votre meilleur</Text>
        <Text style={s.axis}>T{n}</Text>
      </View>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Pédagogie (retour fondateur build 23 : « élevé mais pas très compréhensible »).
   Composants LOCAUX à l'écran — le périmètre du chantier ne touche pas aux
   composants partagés. Descriptif uniquement : ce que ça montre, jamais quoi
   faire. Aucune donnée ni logique modifiée — lisibilité et motion seulement.
   ───────────────────────────────────────────────────────────────────────────── */

/** « 0,42 » — format français (virgule), N décimales. */
function fmtFr(n: number, decimals: number): string {
  return n.toFixed(decimals).replace('.', ',');
}

/**
 * Chiffre roi qui COMPTE : de 0 vers la valeur réelle (ease-out cubic, ~900 ms).
 * La destination est la donnée ; l'animation n'est qu'un chemin vers elle.
 * Respecte « Réduire les animations » (rendu direct, WCAG 2.3.3).
 */
function useCountUpFr(value: number, decimals: number, duration = 900): string {
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(() => fmtFr(0, decimals));
  useEffect(() => {
    if (reduceMotion) {
      setDisplay(fmtFr(value, decimals));
      return;
    }
    const listener = progress.addListener(({ value: p }) => setDisplay(fmtFr(p * value, decimals)));
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => progress.removeListener(listener);
  }, [value, decimals, duration, reduceMotion, progress]);
  return display;
}

/** Le chiffre roi violet (écart-type) — se construit à l'apparition. */
function ConstancyKingNumber({ stdDevSeconds }: { stdDevSeconds: number }) {
  const display = useCountUpFr(stdDevSeconds, 2);
  return (
    <Text
      style={[s.kingNumber, { color: dataColors.regularity }]}
      accessibilityLabel={`Plus ou moins ${fmtFr(stdDevSeconds, 2)} secondes d'écart-type`}
    >
      ±{display}
    </Text>
  );
}

/**
 * Les barres s'étirent depuis la ligne de base à l'apparition (transform seul,
 * 60 fps, ancrage bas via translateY compensé). « Réduire les animations » =
 * rendu direct, sans mouvement.
 *
 * Reste local : le kit GrowBar s'étire horizontalement (scaleX, ancre gauche) ;
 * ici il faut un étirement VERTICAL ancré en bas, sur un SVG entier — mêmes
 * durées/courbes que le kit (ease-out cubic, native driver).
 */
function BarsReveal({ height, children }: { height: number; children: ReactNode }) {
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress, reduceMotion]);
  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [height / 2, 0],
            }),
          },
          { scaleY: progress },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** Affordance fine « Comment lire cet écran » → panneau repliable (AnimatedPresence). */
function HowToRead({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginTop: spacing.lg }}>
      <PressableScale
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={hitSlop}
        onPress={() => setOpen((o) => !o)}
        style={s.howBtn}
      >
        <Text style={s.howLabel}>Comment lire cet écran</Text>
        <Text style={[s.howChevron, open ? s.howChevronOpen : null]}>›</Text>
      </PressableScale>
      <AnimatedPresence visible={open}>
        <View style={s.howPanel}>{children}</View>
      </AnimatedPresence>
    </View>
  );
}

/** Une ligne du panneau : pastille de couleur (optionnelle) + phrase factuelle. */
function HowRow({ color, children }: { color?: string; children: ReactNode }) {
  return (
    <View style={s.howRow}>
      {color ? <View style={[s.howDot, { backgroundColor: color }]} /> : null}
      <Text style={s.howText}>{children}</Text>
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
  // Ligne de lecture (build 23) : dit ce qu'on regarde, en une phrase simple.
  lectureLine: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.55,
    marginBottom: spacing.md,
  },
  // « Comment lire cet écran » — affordance fine + panneau sobre.
  howBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    minHeight: 44,
  },
  howLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },
  howChevron: { fontFamily: fonts.body, fontSize: 16, color: palette.creamMute },
  howChevronOpen: { transform: [{ rotate: '90deg' }] },
  howPanel: { gap: spacing.sm, paddingBottom: spacing.xs },
  howRow: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: spacing.sm },
  howDot: { width: 7, height: 7, borderRadius: 4, marginTop: 5 },
  howText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamSoft,
    lineHeight: fontSize.small * 1.55,
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
