/**
 * SÉANCE — l'écran pivot de la zone DATA (V2-L3). Route
 * `/(app2)/data/session/[id]` : la lecture DÉTAILLÉE d'UNE séance du pilote
 * courant, section par section, dans un seul scroll ancré.
 *
 * DOCTRINE (non négociable) :
 *  - SELF-ONLY : uniquement les données du pilote courant (useAuthStore).
 *    Aucun service coach, aucune trace d'un autre pilote.
 *  - DONNÉES RÉELLES : une donnée absente devient « — » ou un StateView vide —
 *    JAMAIS un chiffre fabriqué. La prod n'a presque aucune trame (1 séance /
 *    1 tour) : chaque section doit se dégrader proprement en vide honnête.
 *  - PAS DE FABRICATION : `telemetry_frames` ne porte NI fréquence cardiaque NI
 *    température de piste. La section « Cœur » rend donc un vide honnête (jamais
 *    de FC inventée) ; « Conditions » ne lit que l'air réel (temp + humidité,
 *    nullable → « — »).
 *  - 6 LECTURES = DÉMO : les visualisations Insight sont montées telles quelles
 *    (composants zéro-prop autonomes) sous le bandeau DÉMO — non recâblées.
 *  - COMPARATEUR SANS GAGNANT ; couleurs QDI = données seulement ; or Heritage
 *    réservé au record/certifié ; UN accent rouge par zone ; vouvoiement ; zéro
 *    emoji.
 *
 * Le hook `useSeance(id)` charge les sections indépendantes via
 * `Promise.allSettled` : l'échec d'une section n'abat pas les autres (vide ou
 * erreur honnête, jamais un zéro trompeur). Les sous-données lourdes
 * (télémétrie, trames de tour, tracé) sont chargées PARESSEUSEMENT dans leur
 * propre section — le montage reste léger.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Canvas, Circle, Group, Path, Rect } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  runOnUI,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import Svg, { Path as SvgPath } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ChronoHero,
  Chip,
  CondensingHeaderBar,
  ListRow,
  PressScale,
  SectionHeader,
  Sheet,
  StatCell,
  StateView,
  TraceCircuit,
  clamp,
  colors,
  condensedProgress,
  haptic,
  lerp,
  radius,
  space,
  tabBarSpace,
  typo,
} from '@/ui/v2';
import { formatDeltaMs } from '@/features/data/comparerLogic';
import { AnatomieViz } from '@/components/insights/AnatomieViz';
import { DispersionViz } from '@/components/insights/DispersionViz';
import { FlowViz } from '@/components/insights/FlowViz';
import { GGViz, type GGPoint } from '@/components/insights/GGViz';
import { TourIdealViz } from '@/components/insights/TourIdealViz';
import { TransfertViz } from '@/components/insights/TransfertViz';
import { DemoBanner } from '@/components/insights/InsightCard';
import { READINGS, type ReadingKey } from '@/components/insights/catalogue';
import { fetchSessionInsights } from '@/services/sessionInsightsService';
import type { SessionInsights } from '@/circuit/sessionInsights';
import { supabase } from '@/lib/supabase';
import { fetchAllSessions, fetchSessionLaps } from '@/services/sessionsService';
import { loadCornerEvolution } from '@/services/cornerEvolutionService';
import type { CornerEvolution } from '@/services/cornerEvolutionService';
import {
  listSegmentAnalysesForSession,
  type SegmentAnalysisRow,
} from '@/services/segmentAnalysesService';
import {
  loadGGPoints,
  loadLapFrames,
  loadSessionTrajectory,
  loadSpeedTracePoints,
  loadThrottleBrakePoints,
} from '@/services/sessionTelemetryService';
import { loadWeatherCorrelation } from '@/services/weatherCorrelationService';
import type { WeatherBucket, WeatherCorrelation } from '@/services/weatherCorrelationService';
import { useAuthStore } from '@/store/useAuthStore';
import type { MarginZone } from '@/types/domain';
import type { Lap, TelemetrySession } from '@/types/telemetry';
import type { TrajectoryFramePoint } from '@/services/trajectoryLogic';
import { formatChronoMs } from '@/utils/time';
import { formatDateShort } from '@/utils/format';

// ═══════════════════════════════════════════════════════════════════════════
// Ancres — le rail horizontal collant sous le header condensé.
// ═══════════════════════════════════════════════════════════════════════════

/** Les sept ancres de la séance, dans l'ordre de lecture. */
const ANCHORS = [
  { key: 'resume', label: 'Résumé' },
  { key: 'tours', label: 'Tours' },
  { key: 'trace', label: 'Tracé' },
  { key: 'telemetrie', label: 'Télémétrie' },
  { key: 'constats', label: 'Constats' },
  { key: 'coeur', label: 'Cœur' },
  { key: 'conditions', label: 'Conditions' },
] as const;

const HEADER_BASE = 48;
const RAIL_HEIGHT = 44;

// ═══════════════════════════════════════════════════════════════════════════
// Hook de données — sections indépendantes (Promise.allSettled).
// ═══════════════════════════════════════════════════════════════════════════

/** Météo de la séance : temp + humidité RÉELLES, nullable (« — » si absent). */
interface SeanceWeather {
  temperatureC: number | null;
  humidityPct: number | null;
  label: string | null;
}

/** État chargé du hook `useSeance`. */
interface SeanceData {
  session: TelemetrySession;
  laps: Lap[];
  segments: SegmentAnalysisRow[];
  weather: SeanceWeather | null;
  correlation: WeatherCorrelation | null;
  /** Séances du MÊME circuit (self-only), pour la superposition B4. */
  circuitSessionIds: string[];
  /** Tour retenu par séance pour la superposition (best_lap_number, sinon 1). */
  lapNumberBySession: Record<string, number>;
  /** Lectures Insight RÉELLES (session_insights) — null tant que non calculées. */
  insights: SessionInsights | null;
  /** Nuage g-g RÉEL (loadGGPoints) — vide si trames insuffisantes. */
  ggPoints: GGPoint[];
  /** Sections dont le chargement a ÉCHOUÉ (erreur DB) — distinct de « vide ». */
  failed: Record<string, boolean>;
}

type SeanceStatus = 'loading' | 'ready' | 'notfound' | 'error';

/**
 * Lecture météo d'UNE séance — SELECT-only, self-only (RLS restreint aux
 * séances du pilote). `temperature_c` / `humidity_pct` sont NULLABLE en base :
 * on préserve le null (rendu « — »), on n'invente jamais un zéro (donnée
 * réelle, doctrine L3). Une panne DB REMONTE (erreur → retry), jamais masquée.
 */
async function loadSeanceWeather(sessionId: string): Promise<SeanceWeather | null> {
  const { data, error } = await supabase
    .from('weather_snapshots')
    .select('temperature_c, humidity_pct, weather_label, captured_at')
    .eq('session_id', sessionId)
    .order('captured_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as {
    temperature_c: number | null;
    humidity_pct: number | null;
    weather_label: string | null;
  };
  return {
    temperatureC: row.temperature_c !== null ? Number(row.temperature_c) : null,
    humidityPct: row.humidity_pct !== null ? Number(row.humidity_pct) : null,
    label: row.weather_label,
  };
}

/**
 * Charge la séance pivot + ses sections. La séance elle-même est le socle :
 * son absence rend `notfound`, une panne de la liste rend `error`. Les autres
 * sections passent par `Promise.allSettled` — chacune tombe en vide honnête
 * (ou en erreur de section) sans abattre les voisines.
 */
function useSeance(id: string | undefined) {
  const userId = useAuthStore((s) => s.profile?.id ?? s.user?.id ?? null);
  const [status, setStatus] = useState<SeanceStatus>('loading');
  const [data, setData] = useState<SeanceData | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!id || !userId) return;
    let cancelled = false;
    setStatus('loading');

    (async () => {
      // Socle : la séance du pilote. `strict` distingue panne (error) de vide.
      let sessions: TelemetrySession[];
      try {
        sessions = await fetchAllSessions(userId, { strict: true });
      } catch {
        if (!cancelled) setStatus('error');
        return;
      }
      const session = sessions.find((s) => s.id === id) ?? null;
      if (!session) {
        if (!cancelled) setStatus('notfound');
        return;
      }

      const circuitSessions = session.circuit_id
        ? sessions.filter((s) => s.circuit_id === session.circuit_id)
        : [session];
      const circuitSessionIds = circuitSessions.map((s) => s.id);
      const lapNumberBySession: Record<string, number> = {};
      for (const s of circuitSessions) {
        lapNumberBySession[s.id] = s.best_lap_number ?? 1;
      }

      // Sections indépendantes — l'échec de l'une n'entache pas les autres.
      const [lapsR, segmentsR, weatherR, correlationR, insightsR, ggR] = await Promise.allSettled([
        fetchSessionLaps(id, { strict: true }),
        listSegmentAnalysesForSession(id),
        loadSeanceWeather(id),
        loadWeatherCorrelation(userId, session.circuit_id ?? undefined),
        fetchSessionInsights(id),
        loadGGPoints(id),
      ]);
      if (cancelled) return;

      const failed: Record<string, boolean> = {};
      let laps: Lap[] = [];
      if (lapsR.status === 'fulfilled') laps = lapsR.value;
      else failed.tours = true;

      let segments: SegmentAnalysisRow[] = [];
      if (segmentsR.status === 'fulfilled') segments = segmentsR.value;
      else failed.trace = true;

      let weather: SeanceWeather | null = null;
      if (weatherR.status === 'fulfilled') weather = weatherR.value;
      else failed.weather = true;

      let correlation: WeatherCorrelation | null = null;
      if (correlationR.status === 'fulfilled') correlation = correlationR.value;
      else failed.conditions = true;

      // Insights RÉELS : absence honnête (null) tant que le moteur n'a pas tourné
      // sur des trames denses. Panne DB → section Constats en erreur, jamais un
      // rendu démo passé pour réel.
      let insights: SessionInsights | null = null;
      if (insightsR.status === 'fulfilled') insights = insightsR.value;
      else failed.constats = true;

      let ggPoints: GGPoint[] = [];
      if (ggR.status === 'fulfilled') ggPoints = ggR.value;

      setData({
        session,
        laps,
        segments,
        weather,
        correlation,
        circuitSessionIds,
        lapNumberBySession,
        insights,
        ggPoints,
        failed,
      });
      setStatus('ready');
    })().catch(() => {
      if (!cancelled) setStatus('error');
    });

    return () => {
      cancelled = true;
    };
  }, [id, userId, nonce]);

  return { status, data, reload };
}

// ═══════════════════════════════════════════════════════════════════════════
// Petits utilitaires purs de rendu (couleur, mise à l'échelle).
// ═══════════════════════════════════════════════════════════════════════════

/** Couleur d'une zone de marge — donnée (jamais du chrome). Rouge = l'accent. */
function marginZoneColor(zone: MarginZone | null): string {
  switch (zone) {
    case 'green':
      return colors.qdi.acceleration;
    case 'yellow':
      return colors.qdi.fluidite;
    case 'red':
      return colors.accent;
    default:
      return colors.text.low;
  }
}

/** Interpole deux couleurs #RRGGBB — sert la rampe froid→chaud (sans rouge). */
function lerpHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255;
  const ag = (pa >> 8) & 255;
  const ab = pa & 255;
  const br = (pb >> 16) & 255;
  const bg = (pb >> 8) & 255;
  const bb = pb & 255;
  const k = clamp(t, 0, 1);
  const r = Math.round(lerp(ar, br, k));
  const g = Math.round(lerp(ag, bg, k));
  const bl = Math.round(lerp(ab, bb, k));
  return `rgb(${r}, ${g}, ${bl})`;
}

/** Rampe vitesse froid→chaud : bleu (lent) → ambre (rapide). Aucun rouge. */
function speedColor(t: number): string {
  return lerpHex(colors.qdi.trajectoire, colors.qdi.fluidite, t);
}

/** Point projeté d'une trajectoire, avec sa vitesse alignée 1:1. */
interface FittedPoint {
  x: number;
  y: number;
  speed: number | null;
}

/**
 * Projette une trajectoire lat/lon dans une boîte px (ratio d'aspect préservé,
 * latitude vers le haut). La vitesse reste alignée point à point — jamais
 * ré-échantillonnée. < 2 points GPS → tableau vide (rien d'inventé).
 */
function fitTrajectory(
  traj: readonly TrajectoryFramePoint[],
  width: number,
  height: number,
  pad: number
): FittedPoint[] {
  if (traj.length < 2 || width <= 0 || height <= 0) return [];
  const lats = traj.map((p) => p.lat);
  const lons = traj.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const minLon = Math.min(...lons);
  const spanLat = Math.max(...lats) - minLat;
  const spanLon = Math.max(...lons) - minLon;
  const maxSpan = Math.max(spanLat, spanLon);
  if (!Number.isFinite(maxSpan) || maxSpan <= 0) return [];
  const scale = Math.min((width - 2 * pad) / maxSpan, (height - 2 * pad) / maxSpan);
  return traj.map((p) => ({
    x: pad + (p.lon - minLon) * scale,
    y: height - pad - (p.lat - minLat) * scale,
    speed: p.speed,
  }));
}

/** Chemin SVG d'une polyligne de points (M…L…). */
function polylinePath(points: readonly { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) d += ` L ${points[i].x} ${points[i].y}`;
  return d;
}

/** Durée d'un tour en ms (les tours stockent des secondes). */
function lapMs(lap: Lap): number {
  return Math.round(lap.duration_seconds * 1000);
}

// ═══════════════════════════════════════════════════════════════════════════
// Écran.
// ═══════════════════════════════════════════════════════════════════════════

export default function SeanceScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id;
  const insets = useSafeAreaInsets();
  const { status, data, reload } = useSeance(id);

  const headerH = insets.top + HEADER_BASE;
  const railTop = headerH;
  const contentTop = headerH + RAIL_HEIGHT + space.md;

  // Tour sélectionné (pilote Tracé / Télémétrie / Cœur). null = tour de réf.
  const [selectedLap, setSelectedLap] = useState<number | null>(null);

  // Scroll partagé : header condensé + rail actif suivent le même défilement.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const sectionY = useRef<number[]>([]);
  const [activeAnchor, setActiveAnchor] = useState(0);

  const syncActive = useCallback(
    (y: number) => {
      const line = y + headerH + RAIL_HEIGHT + 12;
      let next = 0;
      for (let i = 0; i < ANCHORS.length; i++) {
        const top = sectionY.current[i];
        if (top !== undefined && top <= line) next = i;
      }
      setActiveAnchor((prev) => (prev === next ? prev : next));
    },
    [headerH]
  );

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
    runOnJS(syncActive)(event.contentOffset.y);
  });

  const goToAnchor = useCallback(
    (index: number) => {
      const top = sectionY.current[index];
      if (top === undefined) return;
      haptic('tap');
      const target = Math.max(0, top - headerH - RAIL_HEIGHT);
      runOnUI(() => {
        'worklet';
        scrollTo(scrollRef, 0, target, true);
      })();
    },
    [headerH, scrollRef]
  );

  const registerSection = useCallback(
    (index: number) => (event: LayoutChangeEvent) => {
      sectionY.current[index] = event.nativeEvent.layout.y;
    },
    []
  );

  // Style du header condensé (fondu entrant au-delà du seuil).
  const condensedStyle = useAnimatedStyle(() => ({
    opacity: condensedProgress(scrollY.value, 40, 24),
  }));

  const metaLine = useMemo(() => {
    if (!data) return '';
    const date = data.session.started_at ? formatDateShort(data.session.started_at) : null;
    return [date, data.session.circuit_name || null].filter(Boolean).join(' · ').toUpperCase();
  }, [data]);

  // ── États non nominaux — jamais de spinner ─────────────────────────────
  if (status !== 'ready' || !data) {
    return (
      <View style={styles.root}>
        <View style={[styles.stateWrap, { paddingTop: headerH + space.xl }]}>
          {status === 'loading' ? (
            <StateView state="loading" shape="list" />
          ) : status === 'error' ? (
            <StateView
              state="error"
              errorMessage="La séance n'a pas pu être chargée."
              onRetry={reload}
            />
          ) : (
            <StateView state="empty" emptyMessage="Cette séance est introuvable." />
          )}
        </View>
        <HeaderFixed headerH={headerH} insetsTop={insets.top} title={metaLine} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: contentTop,
          paddingBottom: tabBarSpace(insets.bottom) + space.xxl,
        }}
      >
        {/* ── 1 · RÉSUMÉ ──────────────────────────────────────────────── */}
        <View style={styles.section} onLayout={registerSection(0)}>
          <ResumeSection session={data.session} laps={data.laps} />
        </View>

        {/* ── 2 · TOURS ───────────────────────────────────────────────── */}
        <View style={styles.section} onLayout={registerSection(1)}>
          <SectionHeader eyebrow="TOURS" count={data.laps.length || undefined} />
          <ToursSection
            laps={data.laps}
            failed={data.failed.tours === true}
            selectedLap={selectedLap}
            onSelect={setSelectedLap}
            onRetry={reload}
          />
        </View>

        {/* ── 3 · TRACÉ & VIRAGES ─────────────────────────────────────── */}
        <View style={styles.section} onLayout={registerSection(2)}>
          <SectionHeader eyebrow="TRACÉ & VIRAGES" />
          <TraceSection
            sessionId={data.session.id}
            selectedLap={selectedLap}
            segments={data.segments}
            circuitSessionIds={data.circuitSessionIds}
            lapNumberBySession={data.lapNumberBySession}
          />
        </View>

        {/* ── 4 · TÉLÉMÉTRIE ──────────────────────────────────────────── */}
        <View style={styles.section} onLayout={registerSection(3)}>
          <SectionHeader eyebrow="TÉLÉMÉTRIE" />
          <TelemetrieSection sessionId={data.session.id} />
        </View>

        {/* ── 5 · CONSTATS ────────────────────────────────────────────── */}
        <View style={styles.section} onLayout={registerSection(4)}>
          <SectionHeader eyebrow="CONSTATS" title="Les lectures approfondies" />
          <ConstatsSection
            insights={data.insights}
            ggPoints={data.ggPoints}
            insightsFailed={data.failed.constats === true}
          />
        </View>

        {/* ── 6 · CŒUR ────────────────────────────────────────────────── */}
        <View style={styles.section} onLayout={registerSection(5)}>
          <SectionHeader eyebrow="CŒUR" />
          <CoeurSection />
        </View>

        {/* ── 7 · CONDITIONS ──────────────────────────────────────────── */}
        <View style={styles.section} onLayout={registerSection(6)}>
          <SectionHeader eyebrow="CONDITIONS" />
          <ConditionsSection
            weather={data.weather}
            correlation={data.correlation}
            failed={data.failed.conditions === true || data.failed.weather === true}
            onRetry={reload}
          />
        </View>

        {/* ── Pied — comparer / bilan ─────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.footerAccent}>
            <ListRow
              icon="data"
              label="Comparer cette séance"
              sublabel="Choisir une autre séance en regard"
              divider={false}
              onPress={() => router.navigate('/(app2)/data' as never)}
              accessibilityLabel="Comparer cette séance à une autre"
            />
          </View>
          <View style={styles.footerPlain}>
            <ListRow
              label="Ouvrir le bilan"
              divider={false}
              onPress={() => router.push(`/(app2)/bilan/${data.session.id}` as never)}
              accessibilityLabel="Ouvrir le bilan de cette séance"
            />
          </View>
        </View>
      </Animated.ScrollView>

      {/* Barre condensée (fond blur) + rail d'ancres collant dessous. */}
      <CondensingHeaderBar condensedStyle={condensedStyle} height={headerH} />
      <HeaderFixed headerH={headerH} insetsTop={insets.top} title={metaLine} />
      <View style={[styles.rail, { top: railTop }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.railContent}
        >
          {ANCHORS.map((a, i) => (
            <Chip
              key={a.key}
              label={a.label}
              active={activeAnchor === i}
              onPress={() => goToAnchor(i)}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Header fixe — retour + méta mono, toujours tappable.
// ═══════════════════════════════════════════════════════════════════════════

function HeaderFixed({
  headerH,
  insetsTop,
  title,
}: {
  headerH: number;
  insetsTop: number;
  title: string;
}) {
  return (
    <View style={[styles.headerFixed, { height: headerH, paddingTop: insetsTop }]}>
      <PressScale
        onPress={() => router.back()}
        accessibilityLabel="Retour"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Svg width={20} height={20} viewBox="0 0 24 24">
          <SvgPath
            d="M15 5 L8.5 12 L15 19"
            stroke={colors.text.hi}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </PressScale>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title || 'SÉANCE'}
      </Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · RÉSUMÉ — ChronoHero + stats hairline.
// ═══════════════════════════════════════════════════════════════════════════

function ResumeSection({ session, laps }: { session: TelemetrySession; laps: Lap[] }) {
  // Chrono de référence : best_lap_seconds si présent, sinon le meilleur tour lu.
  const bestFromLaps = useMemo(() => {
    const valid = laps.filter((l) => !l.is_outlap && !l.is_inlap && l.duration_seconds > 0);
    if (valid.length === 0) return null;
    return Math.min(...valid.map(lapMs));
  }, [laps]);
  const bestMs =
    session.best_lap_seconds !== null ? Math.round(session.best_lap_seconds * 1000) : bestFromLaps;

  const tours = laps.length > 0 ? laps.length : session.lap_count;
  // distance_km arrive en STRING depuis PostgREST (colonne numeric) : Number()
  // avant toFixed, sinon .toFixed n'existe pas sur une string → crash au rendu.
  const distance =
    session.distance_km !== null
      ? `${Number(session.distance_km).toFixed(1).replace('.', ',')} km`
      : '—';
  const vmax = session.max_speed_kmh !== null ? `${Math.round(session.max_speed_kmh)} km/h` : '—';

  return (
    <View style={styles.resumeCard}>
      <Text style={styles.resumeEyebrow}>TOUR DE RÉFÉRENCE</Text>
      {bestMs !== null ? (
        <ChronoHero chronoMs={bestMs} size="l" />
      ) : (
        <Text style={styles.resumeNoChrono}>—</Text>
      )}
      <View style={styles.hairlineRow}>
        <StatCell
          label="Tours"
          value={tours > 0 ? String(tours) : '—'}
          style={styles.hairlineCell}
        />
        <StatCell label="Distance" value={distance} style={styles.hairlineCell} />
        <StatCell label="Vitesse maxi" value={vmax} style={styles.hairlineCell} />
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · TOURS — histogramme Skia (une barre par tour, hauteur = temps).
// ═══════════════════════════════════════════════════════════════════════════

const BARS_HEIGHT = 150;

function ToursSection({
  laps,
  failed,
  selectedLap,
  onSelect,
  onRetry,
}: {
  laps: Lap[];
  failed: boolean;
  selectedLap: number | null;
  onSelect: (n: number | null) => void;
  onRetry: () => void;
}) {
  const [width, setWidth] = useState(0);

  const bars = useMemo(() => {
    const valid = laps.filter((l) => l.duration_seconds > 0);
    return valid.map((l) => ({ lapNumber: l.lap_number, ms: lapMs(l), isBest: l.is_best_lap }));
  }, [laps]);

  const bestMs = useMemo(() => {
    if (bars.length === 0) return null;
    return Math.min(...bars.map((b) => b.ms));
  }, [bars]);

  const selected = useMemo(
    () => bars.find((b) => b.lapNumber === selectedLap) ?? null,
    [bars, selectedLap]
  );

  if (failed) {
    return (
      <StateView state="error" errorMessage="Les tours n'ont pas pu être lus." onRetry={onRetry} />
    );
  }
  if (bars.length === 0) {
    return <StateView state="empty" emptyMessage="Aucun tour complet capté pour cette séance." />;
  }

  // Échelle : on étale l'écart min→max pour rendre les différences lisibles.
  const minMs = Math.min(...bars.map((b) => b.ms));
  const maxMs = Math.max(...bars.map((b) => b.ms));
  const range = Math.max(1, maxMs - minMs);
  const slot = width > 0 ? width / bars.length : 0;
  const barW = slot > 0 ? Math.max(3, slot * 0.62) : 0;

  const onTapX = (x: number) => {
    if (slot <= 0) return;
    const idx = clamp(Math.floor(x / slot), 0, bars.length - 1);
    const lap = bars[idx].lapNumber;
    haptic('tap');
    onSelect(selectedLap === lap ? null : lap);
  };
  const tap = Gesture.Tap().onEnd((e) => {
    runOnJS(onTapX)(e.x);
  });

  return (
    <View>
      {/* Ligne de tête : le tour sélectionné, son chrono, son écart au réf. */}
      <View style={styles.toursHead}>
        {selected && bestMs !== null ? (
          <Text style={styles.toursHeadText}>
            {`Tour ${selected.lapNumber} · ${formatChronoMs(selected.ms)}`}
            {selected.ms > bestMs ? (
              <Text style={styles.toursDelta}>{`  ${formatDeltaMs(selected.ms - bestMs)}`}</Text>
            ) : (
              <Text style={styles.toursRef}> référence</Text>
            )}
          </Text>
        ) : (
          <Text style={styles.toursHint}>Touchez une barre pour isoler un tour.</Text>
        )}
      </View>

      <GestureDetector gesture={tap}>
        <View
          style={{ height: BARS_HEIGHT }}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        >
          {width > 0 ? (
            <Canvas style={{ width, height: BARS_HEIGHT }}>
              {bars.map((b, i) => {
                // Barre courte = tour rapide : hauteur inversée sur l'écart.
                const t = (b.ms - minMs) / range;
                const h = lerp(BARS_HEIGHT * 0.9, BARS_HEIGHT * 0.28, t);
                const x = i * slot + (slot - barW) / 2;
                const y = BARS_HEIGHT - h;
                const isSelected = b.lapNumber === selectedLap;
                const fill = isSelected
                  ? colors.accent
                  : b.isBest
                    ? colors.bg.card2
                    : colors.border.strong;
                return (
                  <Group key={b.lapNumber}>
                    <Rect x={x} y={y} width={barW} height={h} color={fill} />
                    {b.isBest ? (
                      // Tour de référence : liseré or Heritage (record de séance).
                      <Rect
                        x={x}
                        y={y}
                        width={barW}
                        height={h}
                        color={colors.heritage.gold}
                        style="stroke"
                        strokeWidth={1.5}
                      />
                    ) : null}
                  </Group>
                );
              })}
            </Canvas>
          ) : null}
        </View>
      </GestureDetector>
      <Text style={styles.legendMono}>
        Barre courte = tour rapide. Liseré or = tour de référence.
      </Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · TRACÉ & VIRAGES — TraceCircuit du tour + pastilles de marge + zoom.
// ═══════════════════════════════════════════════════════════════════════════

function TraceSection({
  sessionId,
  selectedLap,
  segments,
  circuitSessionIds,
  lapNumberBySession,
}: {
  sessionId: string;
  selectedLap: number | null;
  segments: SegmentAnalysisRow[];
  circuitSessionIds: string[];
  lapNumberBySession: Record<string, number>;
}) {
  const [trace, setTrace] = useState<{ lat: number; lon: number }[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [openCorner, setOpenCorner] = useState<SegmentAnalysisRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      // Tour sélectionné → ses trames ; sinon la trajectoire entière de séance.
      const frames =
        selectedLap !== null
          ? (await loadLapFrames(sessionId, selectedLap))
              .filter((f) => f.lat !== null && f.lon !== null)
              .map((f) => ({ lat: f.lat as number, lon: f.lon as number }))
          : (await loadSessionTrajectory(sessionId)).map((p) => ({ lat: p.lat, lon: p.lon }));
      if (!cancelled) {
        setTrace(frames);
        setLoading(false);
      }
    })().catch(() => {
      if (!cancelled) {
        setTrace([]);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId, selectedLap]);

  // Pastilles de marge : uniquement si des virages segmentés existent (honnête).
  const cornerMarkers = useMemo(
    () =>
      segments
        .filter((s) => s.startProgress !== null && s.endProgress !== null)
        .map((s) => ({
          t: clamp(((s.startProgress as number) + (s.endProgress as number)) / 2, 0, 1),
          color: marginZoneColor(s.marginZone),
        })),
    [segments]
  );

  const tappableCorners = useMemo(
    () => segments.filter((s) => s.startProgress !== null && s.endProgress !== null),
    [segments]
  );

  if (loading && trace === null) {
    return <StateView state="loading" shape="hero" />;
  }
  if (!trace || trace.length < 2) {
    return (
      <StateView
        state="empty"
        emptyMessage="Tracé indisponible — aucune trame GPS pour cette lecture."
      />
    );
  }

  return (
    <View>
      <Text style={styles.legendMono}>
        {selectedLap !== null ? `TOUR ${selectedLap}` : 'SÉANCE ENTIÈRE'}
      </Text>
      <View style={styles.traceCard}>
        <TraceCircuit centerline={trace} height={200} markers={cornerMarkers} />
      </View>

      {tappableCorners.length > 0 ? (
        <View style={styles.cornerRow}>
          {tappableCorners.map((c) => (
            <PressScale
              key={c.segmentIndex}
              onPress={() => {
                haptic('tap');
                setOpenCorner(c);
              }}
              accessibilityLabel={`Virage ${c.segmentName ?? c.segmentIndex + 1}`}
            >
              <View style={styles.cornerPill}>
                <View
                  style={[styles.cornerDot, { backgroundColor: marginZoneColor(c.marginZone) }]}
                />
                <Text style={styles.cornerPillLabel}>
                  {c.segmentName ?? `V${c.segmentIndex + 1}`}
                </Text>
              </View>
            </PressScale>
          ))}
        </View>
      ) : null}

      <Sheet visible={openCorner !== null} onClose={() => setOpenCorner(null)} snapHeight={420}>
        {openCorner ? (
          <CornerZoomSheet
            corner={openCorner}
            circuitSessionIds={circuitSessionIds}
            lapNumberBySession={lapNumberBySession}
          />
        ) : null}
      </Sheet>
    </View>
  );
}

/**
 * Contenu du zoom virage : onglet DÉTAIL (faits factuels du virage) + onglet
 * ÉVOLUTION (superposition B4, self-only, des passages passés du pilote —
 * anciens en text.dim, courant en accent).
 */
function CornerZoomSheet({
  corner,
  circuitSessionIds,
  lapNumberBySession,
}: {
  corner: SegmentAnalysisRow;
  circuitSessionIds: string[];
  lapNumberBySession: Record<string, number>;
}) {
  const [tab, setTab] = useState<'detail' | 'evolution'>('detail');
  const [evolution, setEvolution] = useState<CornerEvolution | null>(null);
  const [evoStatus, setEvoStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  useEffect(() => {
    if (tab !== 'evolution' || evoStatus !== 'idle') return;
    if (corner.startProgress === null || corner.endProgress === null) {
      setEvolution({ passes: [] });
      setEvoStatus('ready');
      return;
    }
    let cancelled = false;
    setEvoStatus('loading');
    loadCornerEvolution(circuitSessionIds, lapNumberBySession, {
      startProgress: corner.startProgress,
      endProgress: corner.endProgress,
    })
      .then((evo) => {
        if (!cancelled) {
          setEvolution(evo);
          setEvoStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setEvoStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [tab, evoStatus, corner, circuitSessionIds, lapNumberBySession]);

  const title = corner.segmentName ?? `Virage ${corner.segmentIndex + 1}`;
  const fact = (label: string, value: string) => (
    <View style={styles.factRow}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
  const km = (v: number | null) => (v !== null ? `${Math.round(v)} km/h` : '—');
  const g = (v: number | null) => (v !== null ? `${v.toFixed(2)} g` : '—');

  return (
    <View>
      <SectionHeader eyebrow="VIRAGE" title={title} />
      <View style={styles.tabRow}>
        <Chip label="Détail" active={tab === 'detail'} onPress={() => setTab('detail')} />
        <Chip label="Évolution" active={tab === 'evolution'} onPress={() => setTab('evolution')} />
      </View>

      {tab === 'detail' ? (
        <View style={styles.factCard}>
          {fact('Vitesse d’entrée', km(corner.entrySpeedKmh))}
          {fact('Vitesse à la corde', km(corner.minSpeedKmh ?? corner.apexSpeedKmh))}
          {fact('Vitesse de sortie', km(corner.exitSpeedKmh))}
          {fact('G latéral maxi', g(corner.maxGLateral))}
          {corner.marginZone ? fact('Marge', marginLabel(corner.marginZone)) : null}
        </View>
      ) : evoStatus === 'loading' || evoStatus === 'idle' ? (
        <StateView state="loading" shape="hero" />
      ) : evoStatus === 'error' ? (
        <StateView state="error" errorMessage="Superposition indisponible." />
      ) : evolution && evolution.passes.length >= 2 ? (
        <CornerEvolutionCanvas evolution={evolution} />
      ) : (
        <StateView
          state="empty"
          emptyMessage="Pas encore assez de passages sur ce virage pour une superposition."
        />
      )}
    </View>
  );
}

/** Étiquette humaine d'une zone de marge (doctrine « marge », pas « limite »). */
function marginLabel(zone: MarginZone): string {
  switch (zone) {
    case 'green':
      return 'Confortable';
    case 'yellow':
      return 'À explorer';
    case 'red':
      return 'Terrain serré';
  }
}

/** Superposition des passages d'un virage — anciens estompés, courant accentué. */
function CornerEvolutionCanvas({ evolution }: { evolution: CornerEvolution }) {
  const [width, setWidth] = useState(0);
  const H = 220;
  const PAD = 16;

  const paths = useMemo(() => {
    if (width <= 0) return [];
    return evolution.passes.map((pass) => {
      // Points normalisés [0..1] (y = latitude, vers le haut) → boîte px.
      const pts = pass.points.map((p) => ({
        x: PAD + p.x * (width - 2 * PAD),
        y: H - PAD - p.y * (H - 2 * PAD),
      }));
      return { d: polylinePath(pts), isCurrent: pass.isCurrent };
    });
  }, [evolution, width]);

  return (
    <View>
      <Text style={styles.legendMono}>
        {`${evolution.passes.length} passages — le plus récent en avant`}
      </Text>
      <View style={{ height: H }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Canvas style={{ width, height: H }}>
            {paths.map((p, i) =>
              p.d !== '' ? (
                <Path
                  key={i}
                  path={p.d}
                  style="stroke"
                  strokeWidth={p.isCurrent ? 3 : 1.5}
                  strokeCap="round"
                  strokeJoin="round"
                  color={p.isCurrent ? colors.accent : colors.text.dim}
                />
              ) : null
            )}
          </Canvas>
        ) : null}
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · TÉLÉMÉTRIE — onglets internes G-G / Canaux / Heatmap / Replay.
// ═══════════════════════════════════════════════════════════════════════════

type TeleTab = 'gg' | 'canaux' | 'heatmap' | 'replay';

function TelemetrieSection({ sessionId }: { sessionId: string }) {
  const [tab, setTab] = useState<TeleTab>('gg');
  const [gg, setGg] = useState<{ gLat: number; gLong: number; speedKmh: number | null }[] | null>(
    null
  );
  const [speed, setSpeed] = useState<{ progress: number; speedKmh: number }[] | null>(null);
  const [brake, setBrake] = useState<{ progress: number; gLong: number }[] | null>(null);
  const [traj, setTraj] = useState<TrajectoryFramePoint[] | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  // Chargement PARESSEUX unique — les trames sont lourdes (jusqu'à 60k lignes).
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    (async () => {
      const [ggPts, speedPts, brakePts, trajPts] = await Promise.all([
        loadGGPoints(sessionId),
        loadSpeedTracePoints(sessionId),
        loadThrottleBrakePoints(sessionId),
        loadSessionTrajectory(sessionId),
      ]);
      if (cancelled) return;
      setGg(ggPts);
      setSpeed(speedPts);
      setBrake(brakePts);
      setTraj(trajPts);
      setStatus('ready');
    })().catch(() => {
      if (!cancelled) setStatus('error');
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const hasAny =
    (gg?.length ?? 0) > 0 ||
    (speed?.length ?? 0) > 0 ||
    (brake?.length ?? 0) > 0 ||
    (traj?.length ?? 0) > 1;

  return (
    <View>
      <View style={styles.tabRow}>
        <Chip label="G-G" active={tab === 'gg'} onPress={() => setTab('gg')} />
        <Chip label="Canaux" active={tab === 'canaux'} onPress={() => setTab('canaux')} />
        <Chip label="Heatmap" active={tab === 'heatmap'} onPress={() => setTab('heatmap')} />
        <Chip label="Replay" active={tab === 'replay'} onPress={() => setTab('replay')} />
      </View>

      {status === 'loading' ? (
        <StateView state="loading" shape="hero" />
      ) : status === 'error' ? (
        <StateView state="error" errorMessage="Télémétrie indisponible pour l'instant." />
      ) : !hasAny ? (
        <StateView
          state="empty"
          emptyMessage="Aucune trame du boîtier pour cette séance — la télémétrie s'affichera dès la première vraie capture."
        />
      ) : tab === 'gg' ? (
        <GGScatter points={gg ?? []} />
      ) : tab === 'canaux' ? (
        <ChannelsChart speed={speed ?? []} brake={brake ?? []} />
      ) : tab === 'heatmap' ? (
        <HeatmapTrace traj={traj ?? []} />
      ) : (
        <ReplayTrace traj={traj ?? []} />
      )}
    </View>
  );
}

const GG_SIZE = 260;

/** Diagramme G-G : nuage {gLat, gLong}, couleur = vitesse (froid→chaud). */
function GGScatter({
  points,
}: {
  points: { gLat: number; gLong: number; speedKmh: number | null }[];
}) {
  if (points.length === 0) {
    return <StateView state="empty" emptyMessage="Nuage G-G indisponible." />;
  }
  // Sous-échantillonnage doux pour rester fluide (BASIC).
  // TODO device-tune : ajuster le pas selon la densité réelle sur appareil.
  const step = Math.max(1, Math.floor(points.length / 700));
  const sampled = points.filter((_, i) => i % step === 0);

  const speeds = sampled.map((p) => p.speedKmh ?? 0).filter((v) => v > 0);
  const minSp = speeds.length > 0 ? Math.min(...speeds) : 0;
  const maxSp = speeds.length > 0 ? Math.max(...speeds) : 1;
  const spRange = Math.max(1, maxSp - minSp);

  const R = GG_SIZE / 2;
  const GMAX = 1.5; // g pleine échelle
  const toPx = (gx: number, gy: number) => ({
    // gLat → droite (x), gLong positif (accél) → haut (y écran inversé).
    x: R + clamp(gx / GMAX, -1, 1) * (R - 8),
    y: R - clamp(gy / GMAX, -1, 1) * (R - 8),
  });

  return (
    <View style={styles.canvasCenter}>
      <Canvas style={{ width: GG_SIZE, height: GG_SIZE }}>
        {/* Croix centrale — repère neutre, jamais un verdict. */}
        <Rect x={R - 0.5} y={0} width={1} height={GG_SIZE} color={colors.border.card} />
        <Rect x={0} y={R - 0.5} width={GG_SIZE} height={1} color={colors.border.card} />
        <Circle
          cx={R}
          cy={R}
          r={R - 8}
          color={colors.border.hairline}
          style="stroke"
          strokeWidth={1}
        />
        {sampled.map((p, i) => {
          const at = toPx(p.gLat, p.gLong);
          const t = p.speedKmh !== null ? (p.speedKmh - minSp) / spRange : 0;
          return <Circle key={i} cx={at.x} cy={at.y} r={2} color={speedColor(t)} opacity={0.6} />;
        })}
      </Canvas>
      <Text style={styles.legendMono}>
        Horizontal : appui latéral. Vertical : freinage (bas) / accélération (haut).
      </Text>
    </View>
  );
}

const CHAN_H = 96;

/** Deux canaux empilés (vitesse + G long) avec un curseur au doigt (BASIC). */
function ChannelsChart({
  speed,
  brake,
}: {
  speed: { progress: number; speedKmh: number }[];
  brake: { progress: number; gLong: number }[];
}) {
  const [width, setWidth] = useState(0);
  const [cursor, setCursor] = useState(0.5); // 0..1

  if (speed.length < 2 && brake.length < 2) {
    return <StateView state="empty" emptyMessage="Canaux indisponibles." />;
  }

  const maxSpeed = speed.length > 0 ? Math.max(...speed.map((p) => p.speedKmh)) : 1;
  const speedPts =
    width > 0
      ? speed.map((p) => ({
          x: p.progress * width,
          y: CHAN_H - (p.speedKmh / Math.max(1, maxSpeed)) * (CHAN_H - 6) - 3,
        }))
      : [];
  const brakePts =
    width > 0
      ? brake.map((p) => ({
          // gLong ∈ [-1.5, 1.5] ; 0 au centre.
          x: p.progress * width,
          y: CHAN_H / 2 - clamp(p.gLong / 1.5, -1, 1) * (CHAN_H / 2 - 4),
        }))
      : [];

  // Valeurs au curseur — le point réel le plus proche (pas d'interpolation).
  const nearest = <T extends { progress: number }>(arr: T[]): T | null => {
    if (arr.length === 0) return null;
    let best = arr[0];
    let bestD = Math.abs(arr[0].progress - cursor);
    for (const p of arr) {
      const d = Math.abs(p.progress - cursor);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  };
  const curSpeed = nearest(speed);
  const curBrake = nearest(brake);
  const cursorX = cursor * width;

  // polylinePath rend '' sous 2 points (ex. séance GPS-only sans g-force → brake
  // vide). Un <Path path="" /> lève « Invalid path » côté Skia : on ne peint le
  // tracé QUE si la chaîne est non vide (le curseur/axe restent, honnêtement).
  const speedPath = polylinePath(speedPts);
  const brakePath = polylinePath(brakePts);

  // TODO device-tune : curseur piloté par état React (runOnJS) — passer le
  // suivi sur le thread UI (Skia reactive value) pour un scrubbing 60fps.
  const pan = Gesture.Pan()
    .onBegin((e) => {
      if (width > 0) runOnJS(setCursor)(clamp(e.x / width, 0, 1));
    })
    .onUpdate((e) => {
      if (width > 0) runOnJS(setCursor)(clamp(e.x / width, 0, 1));
    });

  return (
    <View>
      <View style={styles.chanHead}>
        <Text style={styles.chanValue}>
          {curSpeed ? `${Math.round(curSpeed.speedKmh)} km/h` : '—'}
        </Text>
        <Text style={styles.chanValueAlt}>
          {curBrake ? `${curBrake.gLong >= 0 ? '+' : ''}${curBrake.gLong.toFixed(2)} g` : '—'}
        </Text>
      </View>
      <GestureDetector gesture={pan}>
        <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {/* Canal vitesse */}
          <View style={{ height: CHAN_H }}>
            {width > 0 ? (
              <Canvas style={{ width, height: CHAN_H }}>
                {speedPath ? (
                  <Path
                    path={speedPath}
                    style="stroke"
                    strokeWidth={2}
                    strokeCap="round"
                    strokeJoin="round"
                    color={colors.qdi.trajectoire}
                  />
                ) : null}
                <Rect x={cursorX - 0.5} y={0} width={1} height={CHAN_H} color={colors.text.mid} />
              </Canvas>
            ) : null}
          </View>
          <Text style={styles.chanLabel}>VITESSE</Text>
          {/* Canal G longitudinal */}
          <View style={{ height: CHAN_H, marginTop: space.sm }}>
            {width > 0 ? (
              <Canvas style={{ width, height: CHAN_H }}>
                <Rect
                  x={0}
                  y={CHAN_H / 2 - 0.5}
                  width={width}
                  height={1}
                  color={colors.border.card}
                />
                {brakePath ? (
                  <Path
                    path={brakePath}
                    style="stroke"
                    strokeWidth={2}
                    strokeCap="round"
                    strokeJoin="round"
                    color={colors.qdi.freinage}
                  />
                ) : null}
                <Rect x={cursorX - 0.5} y={0} width={1} height={CHAN_H} color={colors.text.mid} />
              </Canvas>
            ) : null}
          </View>
          <Text style={styles.chanLabel}>
            G LONGITUDINAL — bas : freinage · haut : accélération
          </Text>
        </View>
      </GestureDetector>
    </View>
  );
}

const HEAT_H = 240;

/** Tracé chauffé par la vitesse (froid→chaud, sans rouge). */
function HeatmapTrace({ traj }: { traj: TrajectoryFramePoint[] }) {
  const [width, setWidth] = useState(0);

  const segments = useMemo(() => {
    const pts = fitTrajectory(traj, width, HEAT_H, 14);
    if (pts.length < 2) return [];
    const speeds = pts.map((p) => p.speed ?? 0).filter((v) => v > 0);
    const minSp = speeds.length > 0 ? Math.min(...speeds) : 0;
    const maxSp = speeds.length > 0 ? Math.max(...speeds) : 1;
    const range = Math.max(1, maxSp - minSp);
    // Regroupe les segments par couleur (≤ N chemins) pour rester léger.
    const BUCKETS = 6;
    const byBucket: string[] = Array.from({ length: BUCKETS }, () => '');
    for (let i = 1; i < pts.length; i++) {
      const sp = pts[i].speed;
      const t = sp !== null ? (sp - minSp) / range : 0;
      const b = clamp(Math.floor(t * BUCKETS), 0, BUCKETS - 1);
      byBucket[b] += `M ${pts[i - 1].x} ${pts[i - 1].y} L ${pts[i].x} ${pts[i].y} `;
    }
    return byBucket.map((d, b) => ({ d, color: speedColor((b + 0.5) / BUCKETS) }));
  }, [traj, width]);

  if (traj.length < 2) {
    return <StateView state="empty" emptyMessage="Trajectoire indisponible." />;
  }

  return (
    <View>
      <View style={{ height: HEAT_H }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Canvas style={{ width, height: HEAT_H }}>
            {segments.map((s, i) =>
              s.d !== '' ? (
                <Path
                  key={i}
                  path={s.d.trim()}
                  style="stroke"
                  strokeWidth={4}
                  strokeCap="round"
                  strokeJoin="round"
                  color={s.color}
                />
              ) : null
            )}
          </Canvas>
        ) : null}
      </View>
      <View style={styles.heatLegend}>
        <Text style={styles.legendMono}>Lent</Text>
        <View style={styles.heatBar}>
          {Array.from({ length: 12 }).map((_, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: speedColor(i / 11) }} />
          ))}
        </View>
        <Text style={styles.legendMono}>Rapide</Text>
      </View>
    </View>
  );
}

const REPLAY_H = 240;
const REPLAY_STEP_MS = 60;

/** Point qui parcourt le tracé — version BASIC (intervalle JS isolé). */
function ReplayTrace({ traj }: { traj: TrajectoryFramePoint[] }) {
  const [width, setWidth] = useState(0);
  const [idx, setIdx] = useState(0);

  const pts = useMemo(() => fitTrajectory(traj, width, REPLAY_H, 14), [traj, width]);

  // TODO device-tune : boucle par intervalle JS (BASIC) — porter l'animation
  // sur le thread UI (shared value + Skia) pour un défilement 60fps sans
  // re-render de section.
  useEffect(() => {
    if (pts.length < 2) return;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % pts.length);
    }, REPLAY_STEP_MS);
    return () => clearInterval(t);
  }, [pts.length]);

  if (traj.length < 2) {
    return <StateView state="empty" emptyMessage="Replay indisponible." />;
  }

  const head = pts.length > 0 ? pts[Math.min(idx, pts.length - 1)] : null;
  const tracePath = polylinePath(pts);

  return (
    <View>
      <View style={{ height: REPLAY_H }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && tracePath !== '' ? (
          <Canvas style={{ width, height: REPLAY_H }}>
            <Path
              path={tracePath}
              style="stroke"
              strokeWidth={3}
              strokeCap="round"
              strokeJoin="round"
              color={colors.border.strong}
            />
            {head ? <Circle cx={head.x} cy={head.y} r={6} color={colors.accent} /> : null}
          </Canvas>
        ) : null}
      </View>
      <Text style={styles.legendMono}>Le point suit votre passage, tour après tour.</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 · CONSTATS — les six lectures (DÉMO) montées dans un Sheet.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Monte la visualisation d'une lecture avec sa tranche RÉELLE d'insights (ou son
 * nuage g-g réel), en état vide honnête si la donnée manque. `flow` reste une
 * DÉMONSTRATION : aucune source d'insight « fluidité » n'existe (il faudrait un
 * calcul dédié dérivé des trames) → bandeau DemoBanner limité à cette lecture.
 */
function renderReadingViz(key: ReadingKey, insights: SessionInsights | null, ggPoints: GGPoint[]) {
  switch (key) {
    case 'anatomie':
      return <AnatomieViz anatomy={insights?.anatomy ?? null} />;
    case 'gg':
      return <GGViz points={ggPoints} />;
    case 'dispersion':
      return <DispersionViz dispersion={insights?.dispersion ?? null} />;
    case 'tour-ideal':
      return <TourIdealViz ideal={insights?.ideal_lap ?? null} />;
    case 'flow':
      return <FlowViz />;
    case 'transfert':
      return <TransfertViz transfer={insights?.load_transfer ?? null} />;
    default:
      return null;
  }
}

function ConstatsSection({
  insights,
  ggPoints,
  insightsFailed,
}: {
  insights: SessionInsights | null;
  ggPoints: GGPoint[];
  insightsFailed: boolean;
}) {
  const [open, setOpen] = useState<ReadingKey | null>(null);
  const reading = open ? (READINGS.find((r) => r.key === open) ?? null) : null;

  // Panne DB de la lecture insights : erreur honnête (distincte de « vide »).
  if (insightsFailed) {
    return <StateView state="error" emptyMessage="Lectures indisponibles pour le moment." />;
  }

  // Le sous-libellé est le NIVEAU de la lecture (neutre, factuel) — jamais l'ancien
  // `fact` de démo (chiffres fabriqués). La donnée réelle vit dans la viz du Sheet.
  return (
    <View>
      <View style={styles.constatsList}>
        {READINGS.map((r) => (
          <ListRow
            key={r.key}
            label={r.name}
            sublabel={r.eyebrow}
            onPress={() => {
              haptic('tap');
              setOpen(r.key);
            }}
            accessibilityLabel={`${r.name} — lecture approfondie`}
          />
        ))}
      </View>

      <Sheet visible={open !== null} onClose={() => setOpen(null)} snapHeight={520}>
        {reading ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <SectionHeader eyebrow={reading.eyebrow} title={reading.name} />
            {open === 'flow' ? (
              <View style={styles.constatDemo}>
                <DemoBanner />
              </View>
            ) : null}
            {open ? renderReadingViz(open, insights, ggPoints) : null}
          </ScrollView>
        ) : null}
      </Sheet>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 · CŒUR — vide HONNÊTE (aucune FC en base, jamais fabriquée).
// ═══════════════════════════════════════════════════════════════════════════

function CoeurSection() {
  // Portail flag + consentement + données : `telemetry_frames` NE PORTE PAS de
  // fréquence cardiaque. Aucune valeur n'est donc inventée — vide assumé, la
  // FC arrivera avec un capteur compatible et le consentement du pilote.
  return (
    <StateView
      state="empty"
      emptyMessage="La fréquence cardiaque n'est pas mesurée pour cette séance. Elle apparaîtra avec un capteur compatible et votre accord."
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 7 · CONDITIONS — météo réelle (nullable → « — ») + corrélation B5.
// ═══════════════════════════════════════════════════════════════════════════

function ConditionsSection({
  weather,
  correlation,
  failed,
  onRetry,
}: {
  weather: SeanceWeather | null;
  correlation: WeatherCorrelation | null;
  failed: boolean;
  onRetry: () => void;
}) {
  const hasCorrelation =
    correlation !== null &&
    (correlation.byTemp.some((b) => b.avgLapMs !== null) ||
      correlation.byHumidity.some((b) => b.avgLapMs !== null));

  if (failed && weather === null && !hasCorrelation) {
    return <StateView state="error" errorMessage="Conditions indisponibles." onRetry={onRetry} />;
  }

  return (
    <View>
      {/* Météo capturée de la séance — temp/humidité RÉELLES, « — » si absentes. */}
      {weather ? (
        <View style={styles.condCard}>
          <View style={styles.hairlineRow}>
            <StatCell
              label="Température"
              value={weather.temperatureC !== null ? `${Math.round(weather.temperatureC)} °C` : '—'}
              style={styles.hairlineCell}
            />
            <StatCell
              label="Humidité"
              value={weather.humidityPct !== null ? `${Math.round(weather.humidityPct)} %` : '—'}
              style={styles.hairlineCell}
            />
          </View>
          {weather.label ? <Text style={styles.condLabel}>{weather.label}</Text> : null}
        </View>
      ) : (
        <StateView state="empty" emptyMessage="Aucune météo capturée pour cette séance." />
      )}

      {/* B5 — petits multiples : votre tour de référence par tranche météo. */}
      {hasCorrelation && correlation ? (
        <View style={styles.smallMultiples}>
          <Text style={styles.legendMono}>TOUR DE RÉFÉRENCE PAR CONDITIONS</Text>
          <WeatherSmallMultiple title="Température" buckets={correlation.byTemp} />
          <WeatherSmallMultiple title="Humidité" buckets={correlation.byHumidity} />
        </View>
      ) : null}
    </View>
  );
}

/** Un petit multiple : barres du tour de réf moyen par tranche (sans rouge). */
function WeatherSmallMultiple({ title, buckets }: { title: string; buckets: WeatherBucket[] }) {
  const withData = buckets.filter((b) => b.avgLapMs !== null && b.count > 0);
  if (withData.length === 0) return null;
  const values = withData.map((b) => b.avgLapMs as number);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);

  return (
    <View style={styles.multipleBlock}>
      <Text style={styles.multipleTitle}>{title}</Text>
      <View style={styles.multipleRow}>
        {withData.map((b) => {
          // Barre plus haute = tour plus rapide (écart inversé, comme les tours).
          const t = ((b.avgLapMs as number) - min) / range;
          const h = lerp(52, 18, t);
          return (
            <View key={b.label} style={styles.multipleCol}>
              <View
                style={[styles.multipleBar, { height: h, backgroundColor: colors.qdi.trajectoire }]}
              />
              <Text style={styles.multipleValue}>{formatChronoMs(b.avgLapMs as number)}</Text>
              <Text style={styles.multipleLabel} numberOfLines={1}>
                {b.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Styles.
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  stateWrap: {
    flex: 1,
    paddingHorizontal: space.xl,
  },
  headerFixed: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
  },
  headerTitle: {
    flex: 1,
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 1.4,
    color: colors.text.mid,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 20,
  },
  rail: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: RAIL_HEIGHT,
    zIndex: 15,
    justifyContent: 'center',
    backgroundColor: colors.bg.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.hairline,
  },
  railContent: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.xl,
    alignItems: 'center',
  },
  section: {
    paddingHorizontal: space.xl,
    marginTop: space.xxl,
  },
  // ── Résumé ──
  resumeCard: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    padding: space.lg,
  },
  resumeEyebrow: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.accent,
    marginBottom: space.sm,
  },
  resumeNoChrono: {
    fontFamily: typo.monoSemi,
    fontSize: 48,
    color: colors.text.low,
  },
  hairlineRow: {
    flexDirection: 'row',
    marginTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.hairline,
    paddingTop: space.md,
  },
  hairlineCell: {
    flex: 1,
  },
  // ── Tours ──
  toursHead: {
    minHeight: 20,
    marginTop: space.md,
    marginBottom: space.sm,
  },
  toursHeadText: {
    fontFamily: typo.mono,
    fontSize: 13,
    color: colors.text.hi,
  },
  toursDelta: {
    fontFamily: typo.mono,
    fontSize: 13,
    color: colors.text.mid,
  },
  toursRef: {
    fontFamily: typo.mono,
    fontSize: 12,
    color: colors.heritage.gold,
  },
  toursHint: {
    fontFamily: typo.body,
    fontSize: 12,
    color: colors.text.low,
  },
  legendMono: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.text.low,
    marginTop: space.sm,
  },
  // ── Tracé ──
  traceCard: {
    marginTop: space.sm,
    backgroundColor: colors.bg.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    padding: space.md,
  },
  cornerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.md,
  },
  cornerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border.card,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  cornerDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  cornerPillLabel: {
    fontFamily: typo.bodyMedium,
    fontSize: 12,
    color: colors.text.mid,
  },
  // ── Sheet virage ──
  tabRow: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.md,
    marginBottom: space.md,
  },
  factCard: {
    backgroundColor: colors.bg.card2,
    borderRadius: radius.cell,
    padding: space.md,
  },
  factRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.hairline,
  },
  factLabel: {
    fontFamily: typo.body,
    fontSize: 13,
    color: colors.text.mid,
  },
  factValue: {
    fontFamily: typo.mono,
    fontSize: 14,
    color: colors.text.hi,
    fontVariant: ['tabular-nums'],
  },
  // ── Télémétrie ──
  canvasCenter: {
    alignItems: 'center',
    marginTop: space.md,
  },
  chanHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  chanValue: {
    fontFamily: typo.monoSemi,
    fontSize: 18,
    color: colors.qdi.trajectoire,
  },
  chanValueAlt: {
    fontFamily: typo.monoSemi,
    fontSize: 18,
    color: colors.qdi.freinage,
  },
  chanLabel: {
    fontFamily: typo.mono,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.text.low,
    marginTop: space.xs,
  },
  heatLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
  },
  heatBar: {
    flex: 1,
    flexDirection: 'row',
    height: 6,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  // ── Constats ──
  constatsList: {
    marginTop: space.md,
  },
  constatDemo: {
    marginTop: space.md,
    marginBottom: space.md,
  },
  // ── Conditions ──
  condCard: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    padding: space.lg,
    marginTop: space.sm,
  },
  condLabel: {
    fontFamily: typo.body,
    fontSize: 13,
    color: colors.text.mid,
    marginTop: space.md,
  },
  smallMultiples: {
    marginTop: space.xl,
  },
  multipleBlock: {
    marginTop: space.md,
  },
  multipleTitle: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.text.low,
    marginBottom: space.sm,
  },
  multipleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
  },
  multipleCol: {
    flex: 1,
    alignItems: 'center',
  },
  multipleBar: {
    width: '70%',
    borderRadius: 3,
  },
  multipleValue: {
    fontFamily: typo.mono,
    fontSize: 11,
    color: colors.text.hi,
    marginTop: space.xs,
    fontVariant: ['tabular-nums'],
  },
  multipleLabel: {
    fontFamily: typo.body,
    fontSize: 10,
    color: colors.text.low,
    marginTop: 2,
  },
  // ── Pied ──
  footerAccent: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
  },
  footerPlain: {
    marginTop: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
  },
});
