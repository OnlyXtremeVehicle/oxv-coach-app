/**
 * SAISON — les quatre lectures, extraites de l'écran pour entrer dans le hub.
 * DA Instrument (kit @/ui/v2, tokens L0).
 *
 * ---
 *
 * POURQUOI CE FICHIER EXISTE — LA FUSION DU JALON 4
 *
 * *« Le hub Data devient la Saison, `data/saison` fusionne et disparaît. Seule
 * solution qui règle trois défauts d'un coup : l'orphelin disparaît, le hub
 * cesse d'être une liste sans destination, et "la saison est l'objet
 * principal" devient vrai littéralement. »* — plan de montage, jalon 4.
 *
 * `app/(app2)/data/saison.tsx` était un écran de treize cents lignes **que
 * personne ne pouvait atteindre** : aucune route du dépôt n'y menait. Son
 * contenu vit désormais ici, et le hub Data le monte en tête.
 *
 * ---
 *
 * TROIS EXPORTS, ET LA RAISON DE LA DÉCOUPE
 *
 *   `useSaisonData()`   — le chargement, sans rien afficher ;
 *   `<SaisonSections>`  — les quatre lectures, montées en tête de la liste ;
 *   `<SaisonCircuitSheet>` — la feuille de détail, montée AILLEURS.
 *
 * La feuille est séparée parce qu'elle se pose en position absolue sur tout
 * l'écran. Rendue dans l'en-tête d'une liste défilante, elle se positionnerait
 * par rapport à cet en-tête — donc de travers, et elle défilerait avec lui.
 *
 * ---
 *
 * SELF-ONLY : rien que les données du pilote courant (useAuthStore). Aucune
 * comparaison à un autre pilote, aucun rang, aucun palmarès — des FAITS sur soi.
 *
 * DONNÉES RÉELLES : chaque valeur trace vers une source. La prod n'a presque
 * pas de trames (1 séance / 1 tour) — chaque section dégrade honnêtement vers
 * un état vide (StateView), jamais un zéro fabriqué. Services en `strict:true`
 * pour distinguer « panne de lecture » (état erreur + retry) de « compte vide »
 * (état vide).
 *
 * Quatre lectures :
 *  1. TOUR DE RÉFÉRENCE — progression du meilleur tour par circuit (courbe
 *     dorée Skia + GlowStroke, points tappables, ligne pointillée = record).
 *     Source : `fetchAllSessions` → `bestLapCurve`.
 *  2. RÉGULARITÉ — histogramme Skia de la distribution des écarts au tour de
 *     référence + le fait « X % de vos tours à moins d'une seconde ». Source :
 *     `fetchSessionLaps` → `regularityHistogram` (withinOneSecPct).
 *  3. VOS FAITS — grille de statistiques consolidées, chiffres en RollingCounter
 *     au premier viewport. Source : `loadPilotStats` → `pilotStatCells`.
 *  4. CIRCUITS — cartes des circuits roulés (record perso, nombre de séances) +
 *     silhouettes pointillées des circuits OXV à découvrir → Sheet (records
 *     perso + écosystème via `listCircuitServices`).
 *
 * Doctrine : l'or Heritage est réservé au record/chrono (la courbe de référence
 * l'est) ; les couleurs QDI ne servent que la donnée (violet = régularité) ; un
 * seul rouge d'accent par zone ; vouvoiement ; zéro emoji.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Canvas, DashPathEffect, Path, RoundedRect, Skia } from '@shopify/react-native-skia';
import Animated, {
  Easing,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path as SvgPath } from 'react-native-svg';

import {
  Chip,
  GlowStroke,
  OxvIcon,
  PressScale,
  RollingCounter,
  SectionHeader,
  Sheet,
  SpringDot,
  StatCell,
  Stagger,
  StateView,
  colors,
  motionTokens,
  msToLapLabel,
  radius,
  space,
  typo,
  useFirstViewport,
  useReduceMotion,
} from '@/ui/v2';
import { circuitFilters } from '@/features/data/dataHubLogic';
import {
  bestLapCurve,
  pilotStatCells,
  regularityHistogram,
  type PilotStatCell,
  type PilotStatInput,
  type PilotStatKind,
} from '@/features/data/seasonLogic';
import {
  circuitSubtitle,
  groupServicesByKind,
  SERVICE_KIND_LABELS,
  type CircuitService,
  type DirectoryCircuit,
} from '@/services/ecosystemLogic';
import { fetchDirectoryCircuits, listCircuitServices } from '@/services/ecosystemService';
import { fetchAllSessions, fetchSessionLaps } from '@/services/sessionsService';
import { loadPilotStats, type PilotStats } from '@/services/statsService';
import { useAuthStore } from '@/store/useAuthStore';

// Types inférés des services — évite d'importer @/types (frontière d'imports L3).
type Session = Awaited<ReturnType<typeof fetchAllSessions>>[number];
type LapRow = Awaited<ReturnType<typeof fetchSessionLaps>>[number];

/** Point de la courbe de référence, id de séance conservé (voir `curvePoints`). */
interface CurvePoint {
  startedAt: string;
  bestLapMs: number;
  id: string;
}

/** Circuit effectivement roulé, agrégé depuis les séances (id stable pour l'écosystème). */
interface DrivenCircuit {
  id: string;
  name: string;
  sessionCount: number;
  bestLapMs: number | null;
  distanceKm: number;
}

/** Circuit ouvert dans le Sheet : roulé (avec records perso) ou à découvrir. */
interface CircuitFocus {
  id: string;
  name: string;
  driven: DrivenCircuit | null;
}

/** Nombre max de séances dont on charge les tours (histogramme de régularité). */
// TODO device-tune : fan-out de N requêtes `fetchSessionLaps` faute d'un service
// d'agrégat de tours. Suffisant tant que la prod a peu de séances ; à remplacer
// par une lecture groupée (`.in('session_id', …)`) côté service au durcissement.
const REGULARITY_MAX_SESSIONS = 40;

/** Libellés des seaux de l'histogramme (alignés sur BUCKET_EDGES de seasonLogic). */
const BUCKET_LABELS = ['< 0,5 s', '0,5–1 s', '1–2 s', '2–5 s', '5 s +'] as const;

/** Remplace chaque chiffre par « 0 » — valeur de départ du RollingCounter. */
function zeroed(value: string): string {
  return value.replace(/\d/g, '0');
}

/** Agrège les circuits roulés depuis les séances (id ← circuit_id, jamais deviné). */
function drivenCircuitsFrom(sessions: readonly Session[]): DrivenCircuit[] {
  const byId = new Map<string, DrivenCircuit>();
  for (const s of sessions) {
    const id = s.circuit_id;
    if (!id) continue; // pas d'identifiant : pas de carte circuit
    const lapMs = s.best_lap_seconds != null ? s.best_lap_seconds * 1000 : null;
    const distance = s.distance_km != null ? Number(s.distance_km) : 0;
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, {
        id,
        name: s.circuit_name || 'Circuit',
        sessionCount: 1,
        bestLapMs: lapMs,
        distanceKm: distance,
      });
    } else {
      existing.sessionCount += 1;
      existing.distanceKm += distance;
      if (lapMs != null && (existing.bestLapMs == null || lapMs < existing.bestLapMs)) {
        existing.bestLapMs = lapMs;
      }
    }
  }
  return Array.from(byId.values()).sort((a, b) => b.sessionCount - a.sessionCount);
}

/** Entrées de statistiques consolidées (déjà calculées) à formater. */
function statInputsFrom(stats: PilotStats): PilotStatInput[] {
  const circuits = stats.totalSessions > 0 ? Object.keys(stats.byCircuit).length : null;
  return [
    { key: 'sessions', label: 'Séances', value: stats.totalSessions || null, kind: 'count' },
    { key: 'laps', label: 'Tours', value: stats.totalLaps || null, kind: 'count' },
    {
      key: 'distance',
      label: 'Distance',
      value: stats.totalDistanceKm > 0 ? stats.totalDistanceKm : null,
      kind: 'distance',
    },
    {
      key: 'best',
      label: 'Meilleur tour',
      value: stats.bestLapSeconds != null ? stats.bestLapSeconds * 1000 : null,
      kind: 'chrono',
    },
    { key: 'speed', label: 'Vitesse de pointe', value: stats.maxSpeedKmh, kind: 'speed' },
    { key: 'circuits', label: 'Circuits', value: circuits, kind: 'count' },
  ];
}

// ===========================================================================
// Écran
// ===========================================================================

type LoadStatus = 'loading' | 'ready' | 'error';

/**
 * Le chargement de la saison, sans rien afficher.
 *
 * Rendu séparément des vues pour que la feuille de détail — qui vit ailleurs
 * dans l'arbre — partage le même état que les sections sans le recharger.
 */
export function useSaisonData() {
  const { width } = useWindowDimensions();
  const userId = useAuthStore((s) => s.profile?.id ?? null);

  const [status, setStatus] = useState<LoadStatus>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<PilotStats | null>(null);
  const [directory, setDirectory] = useState<DirectoryCircuit[]>([]);

  // Tours par séance (ms) pour l'histogramme de régularité — chargé à part,
  // best-effort (la régularité dégrade vers un état vide si la lecture échoue).
  const [lapsBySession, setLapsBySession] = useState<Map<string, number[]>>(new Map());
  const [lapsStatus, setLapsStatus] = useState<LoadStatus>('loading');

  const [selectedCircuitId, setSelectedCircuitId] = useState<string | null>(null);
  const [focus, setFocus] = useState<CircuitFocus | null>(null);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // ── Chargement principal — sessions + stats en strict, annuaire best-effort ──
  useEffect(() => {
    if (!userId) {
      setStatus('ready');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    Promise.all([
      fetchAllSessions(userId, { strict: true, limit: 500 }),
      loadPilotStats(userId, { strict: true }),
      fetchDirectoryCircuits().catch(() => [] as DirectoryCircuit[]),
    ])
      .then(([rows, pilotStats, dirs]) => {
        if (cancelled) return;
        setSessions(rows);
        setStats(pilotStats);
        setDirectory(dirs);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [userId, reloadKey]);

  // ── Circuit sélectionné par défaut : le plus roulé (première puce) ──────────
  const chips = useMemo(
    () =>
      circuitFilters(
        sessions.map((s) => ({ circuitId: s.circuit_id, circuitName: s.circuit_name }))
      ),
    [sessions]
  );
  useEffect(() => {
    if (selectedCircuitId === null && chips.length > 0) {
      setSelectedCircuitId(chips[0].id);
    }
  }, [chips, selectedCircuitId]);

  // ── Tours des séances (borné) → Map<sessionId, number[] ms> ─────────────────
  useEffect(() => {
    if (sessions.length === 0) {
      setLapsBySession(new Map());
      setLapsStatus('ready');
      return;
    }
    let cancelled = false;
    setLapsStatus('loading');
    const targets = sessions.slice(0, REGULARITY_MAX_SESSIONS);
    Promise.all(
      targets.map((s) =>
        fetchSessionLaps(s.id)
          .then((laps) => ({ id: s.id, laps }))
          .catch(() => ({ id: s.id, laps: [] as LapRow[] }))
      )
    )
      .then((results) => {
        if (cancelled) return;
        const map = new Map<string, number[]>();
        for (const { id, laps } of results) {
          const ms = laps
            .map((l) => (l.duration_seconds != null ? l.duration_seconds * 1000 : null))
            .filter((v): v is number => v !== null && Number.isFinite(v) && v > 0);
          if (ms.length > 0) map.set(id, ms);
        }
        setLapsBySession(map);
        setLapsStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setLapsStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [sessions]);

  // ── Séances du circuit sélectionné ──────────────────────────────────────────
  const filteredSessions = useMemo(
    () =>
      selectedCircuitId === null ? [] : sessions.filter((s) => s.circuit_id === selectedCircuitId),
    [sessions, selectedCircuitId]
  );
  const selectedName = chips.find((c) => c.id === selectedCircuitId)?.label ?? null;

  // Courbe du tour de référence. `bestLapCurve` filtre/trie sans cloner : les
  // objets rendus sont les MÊMES références que l'entrée (id conservé au
  // runtime) — d'où le cast typé qui réexpose `id` sans réimplémenter le tri.
  const curve = useMemo<CurvePoint[]>(() => {
    const input = filteredSessions.map((s) => ({
      startedAt: s.started_at,
      bestLapMs: s.best_lap_seconds != null ? s.best_lap_seconds * 1000 : null,
      id: s.id,
    }));
    return bestLapCurve(input) as CurvePoint[];
  }, [filteredSessions]);

  // Régularité : tours du circuit sélectionné, écart au meilleur tour du même
  // périmètre (jamais un mélange inter-circuits).
  const regularity = useMemo(() => {
    const lapMs = filteredSessions.flatMap((s) => lapsBySession.get(s.id) ?? []);
    if (lapMs.length === 0) return null;
    const bestMs = Math.min(...lapMs);
    return regularityHistogram(lapMs, bestMs);
  }, [filteredSessions, lapsBySession]);

  // Statistiques consolidées → cellules formatées (avec le type conservé pour
  // le RollingCounter chrono).
  const statCells = useMemo<(PilotStatCell & { kind: PilotStatKind })[]>(() => {
    if (!stats) return [];
    const inputs = statInputsFrom(stats);
    const cells = pilotStatCells(inputs);
    return cells.map((c, i) => ({ ...c, kind: inputs[i].kind }));
  }, [stats]);

  const driven = useMemo(() => drivenCircuitsFrom(sessions), [sessions]);
  const drivenIds = useMemo(() => new Set(driven.map((d) => d.id)), [driven]);
  const discover = useMemo(
    () => directory.filter((c) => !drivenIds.has(c.id)),
    [directory, drivenIds]
  );
  const directoryById = useMemo(() => {
    const map = new Map<string, DirectoryCircuit>();
    for (const c of directory) map.set(c.id, c);
    return map;
  }, [directory]);

  const contentWidth = Math.max(0, width - space.xl * 2 - space.md * 2);

  return {
    status,
    userId,
    reload,
    chips,
    selectedCircuitId,
    setSelectedCircuitId,
    selectedName,
    curve,
    regularity,
    lapsStatus,
    statCells,
    driven,
    discover,
    directoryById,
    contentWidth,
    focus,
    setFocus,
  };
}

export type SaisonData = ReturnType<typeof useSaisonData>;

/**
 * Les quatre lectures de la saison.
 *
 * **Sans coquille d'écran** : ni vue racine, ni défilement, ni encoche. Elle se
 * monte en tête d'une liste, et c'est l'hôte qui porte tout cela.
 */
export function SaisonSections({ data }: { data: SaisonData }) {
  const {
    status,
    userId,
    reload,
    chips,
    selectedCircuitId,
    setSelectedCircuitId,
    selectedName,
    curve,
    regularity,
    lapsStatus,
    statCells,
    driven,
    discover,
    contentWidth,
    setFocus,
  } = data;

  // ── États non nominaux ──────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <View style={styles.stateWrap}>
        <StateView state="loading" shape="list" />
      </View>
    );
  }
  if (status === 'error') {
    return (
      <View style={styles.stateWrap}>
        <StateView
          state="error"
          errorMessage="Votre saison n'a pas pu être chargée."
          onRetry={reload}
        />
      </View>
    );
  }
  if (!userId) {
    return (
      <View style={styles.stateWrap}>
        <StateView state="empty" emptyMessage="Connectez-vous pour retrouver votre saison." />
      </View>
    );
  }

  const hasCurve = curve.length > 0;
  const withinPct = regularity?.withinOneSecPct ?? null;

  return (
    <View>
      {/* ── En-tête éditorial ───────────────────────────────────────────── */}
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>SAISON</Text>
        <Text style={styles.title} accessibilityRole="header">
          Votre trajectoire, contre vous-même.
        </Text>
        <Text style={styles.lede}>
          Des faits posés côte à côte — jamais un classement, jamais un autre pilote.
        </Text>
      </View>

      {/* ── Sélecteur de circuit (pilote courbe + régularité) ───────────── */}
      {chips.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={styles.chipScroll}
        >
          {chips.map((c) => (
            <Chip
              key={c.id}
              label={c.label}
              active={c.id === selectedCircuitId}
              onPress={() => setSelectedCircuitId(c.id)}
            />
          ))}
        </ScrollView>
      ) : null}

      {/* ── 1. Tour de référence — courbe dorée ─────────────────────────── */}
      <View style={styles.section}>
        <SectionHeader eyebrow="TOUR DE RÉFÉRENCE" title={selectedName ?? undefined} />
        <View style={styles.card}>
          {hasCurve ? (
            <GoldCurveChart
              points={curve}
              width={contentWidth}
              onPointPress={(i) => router.push(`/bilan/${curve[i].id}` as never)}
            />
          ) : (
            <StateView
              state="empty"
              emptyMessage="Aucun tour chronométré ici pour l'instant. Votre référence s'installera séance après séance."
            />
          )}
        </View>
        {hasCurve ? (
          <Text style={styles.caption}>
            Chaque point, une séance. La ligne pointillée dorée, votre record. Touchez un point pour
            rouvrir la séance.
          </Text>
        ) : null}
      </View>

      {/* ── 2. Régularité — histogramme des écarts ──────────────────────── */}
      <View style={styles.section}>
        <SectionHeader eyebrow="RÉGULARITÉ" />
        <View style={styles.card}>
          {lapsStatus === 'loading' ? (
            <StateView state="loading" shape="list" />
          ) : regularity ? (
            <>
              <RegularityHistogram histogram={regularity} width={contentWidth} />
              <Text style={styles.fact}>
                <Text style={styles.factNum}>
                  {withinPct !== null ? `${withinPct.toString().replace('.', ',')} %` : '—'}
                </Text>{' '}
                de vos tours à moins d&apos;une seconde de votre meilleur.
              </Text>
            </>
          ) : (
            <StateView
              state="empty"
              emptyMessage="Pas encore de tours lus sur ce circuit — la distribution s'affichera dès les premières boucles."
            />
          )}
        </View>
      </View>

      {/* ── 3. Vos faits — statistiques consolidées ─────────────────────── */}
      <View style={styles.section}>
        <SectionHeader eyebrow="VOS FAITS" />
        {statCells.length > 0 ? (
          <StatsGrid cells={statCells} />
        ) : (
          <View style={styles.card}>
            <StateView state="empty" emptyMessage="Vos statistiques se consolideront ici." />
          </View>
        )}
      </View>

      {/* ── 4. Circuits — roulés + à découvrir ──────────────────────────── */}
      <View style={styles.section}>
        <SectionHeader eyebrow="CIRCUITS" count={driven.length > 0 ? driven.length : undefined} />
        {driven.length > 0 ? (
          <Stagger style={styles.circuitStack}>
            {driven.map((c) => (
              <DrivenCircuitCard
                key={c.id}
                circuit={c}
                onPress={() => setFocus({ id: c.id, name: c.name, driven: c })}
              />
            ))}
          </Stagger>
        ) : (
          <View style={styles.card}>
            <StateView
              state="empty"
              emptyMessage="Vos circuits roulés apparaîtront ici, séance après séance."
            />
          </View>
        )}

        {discover.length > 0 ? (
          <>
            <Text style={styles.subEyebrow}>À DÉCOUVRIR</Text>
            <View style={styles.discoverRow}>
              {discover.map((c) => (
                <DiscoverCircuitCard
                  key={c.id}
                  circuit={c}
                  onPress={() => setFocus({ id: c.id, name: c.name, driven: null })}
                />
              ))}
            </View>
          </>
        ) : null}
      </View>

      {/* ── Pied — votre signature ──────────────────────────────────────── */}
      <View style={styles.section}>
        <PressScale
          // Le groupe est OBLIGATOIRE ici. `/signature` est réclamée par deux
          // fichiers — `app/(app)/signature.tsx` et `app/(app2)/signature.tsx` —
          // et un push non qualifié laisse expo-router arbitrer. Le pilote lit
          // sa signature dans l'arbre V2 : on la nomme.
          onPress={() => router.push('/(app2)/signature' as never)}
          accessibilityLabel="Votre signature"
        >
          <View style={styles.signatureRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.signatureLabel}>Votre signature</Text>
              <Text style={styles.signatureSub}>
                La forme de votre saison, d&apos;un seul tenant.
              </Text>
            </View>
            <Chevron />
          </View>
        </PressScale>
      </View>
    </View>
  );
}

/**
 * La feuille de détail d'un circuit — records perso et écosystème.
 *
 * **Se monte au niveau de l'ÉCRAN, jamais dans l'en-tête de la liste.** Elle se
 * pose en position absolue sur toute la surface : rendue dans un en-tête
 * défilant, elle se placerait par rapport à lui et partirait avec le
 * défilement.
 */
export function SaisonCircuitSheet({ data }: { data: SaisonData }) {
  const { focus, directoryById, setFocus } = data;
  return (
    <CircuitSheet
      focus={focus}
      directory={focus ? (directoryById.get(focus.id) ?? null) : null}
      onClose={() => setFocus(null)}
    />
  );
}

// ===========================================================================
// 1. Courbe dorée du tour de référence (Skia)
// ===========================================================================

const CURVE_HEIGHT = 156;
const CURVE_PAD_L = 16;
const CURVE_PAD_R = 16;
const CURVE_PAD_T = 26;
const CURVE_PAD_B = 18;

function GoldCurveChart({
  points,
  width,
  onPointPress,
}: {
  points: readonly CurvePoint[];
  width: number;
  onPointPress: (index: number) => void;
}) {
  const reduce = useReduceMotion();
  const progress = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce) {
      progress.value = 1;
      return;
    }
    progress.value = withTiming(1, {
      duration: motionTokens.pulse,
      easing: Easing.out(Easing.cubic),
    });
  }, [reduce, progress]);

  const geo = useMemo(() => {
    const n = points.length;
    const values = points.map((p) => p.bestLapMs);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min;
    const usableW = Math.max(1, width - CURVE_PAD_L - CURVE_PAD_R);
    const usableH = CURVE_HEIGHT - CURVE_PAD_T - CURVE_PAD_B;
    const xFor = (i: number) => CURVE_PAD_L + (n > 1 ? i / (n - 1) : 0.5) * usableW;
    // Plus rapide (min) en HAUT : progresser vers le record, c'est monter.
    const yFor = (ms: number) =>
      span > 0 ? CURVE_PAD_T + ((ms - min) / span) * usableH : CURVE_HEIGHT / 2;

    const coords = points.map((p, i) => ({ x: xFor(i), y: yFor(p.bestLapMs), ms: p.bestLapMs }));

    const line = Skia.Path.Make();
    coords.forEach((c, i) => (i === 0 ? line.moveTo(c.x, c.y) : line.lineTo(c.x, c.y)));

    const recordY = yFor(min);
    const record = Skia.Path.Make();
    record.moveTo(CURVE_PAD_L, recordY);
    record.lineTo(width - CURVE_PAD_R, recordY);

    return { coords, line, record, recordMs: min, hasLine: n > 1 };
  }, [points, width]);

  return (
    <View style={{ width, height: CURVE_HEIGHT }}>
      <Text style={styles.recordTag}>RECORD · {msToLapLabel(geo.recordMs)}</Text>
      <Canvas
        style={{ width, height: CURVE_HEIGHT }}
        accessible
        accessibilityLabel={`Progression du tour de référence, ${points.length} ${
          points.length > 1 ? 'séances' : 'séance'
        }`}
      >
        {/* Record : ligne pointillée dorée en haut. */}
        <Path path={geo.record} style="stroke" strokeWidth={1.5} color="rgba(196,164,89,0.5)">
          <DashPathEffect intervals={[5, 4]} />
        </Path>
        {/* Courbe de référence : trait doré lumineux (progression au mount). */}
        {geo.hasLine ? (
          <GlowStroke
            path={geo.line}
            color={colors.heritage.gold}
            glowColor={colors.heritage.glow}
            strokeWidth={2.5}
            progress={progress as SharedValue<number>}
          />
        ) : null}
        {/* Points de séance — claquent après le tracé. */}
        {geo.coords.map((c, i) => (
          <SpringDot
            key={i}
            x={c.x}
            y={c.y}
            r={4.5}
            color={colors.heritage.text}
            delay={reduce ? 0 : motionTokens.pulse + i * 40}
            play
            still={reduce}
          />
        ))}
      </Canvas>
      {/* Cibles tactiles (le Canvas Skia est muet au toucher). */}
      {geo.coords.map((c, i) => (
        <Pressable
          key={i}
          onPress={() => onPointPress(i)}
          accessibilityLabel={`Séance ${i + 1}, ${msToLapLabel(c.ms)}`}
          hitSlop={8}
          style={[styles.pointHit, { left: c.x - 18, top: c.y - 18 }]}
        />
      ))}
    </View>
  );
}

// ===========================================================================
// 2. Histogramme de régularité (Skia)
// ===========================================================================

const HIST_HEIGHT = 120;

function RegularityHistogram({
  histogram,
  width,
}: {
  histogram: { buckets: readonly { count: number }[] };
  width: number;
}) {
  const buckets = histogram.buckets;
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));
  const gap = space.sm;
  const barW = Math.max(1, (width - gap * (buckets.length - 1)) / buckets.length);

  return (
    <View>
      <Canvas
        style={{ width, height: HIST_HEIGHT }}
        accessible
        accessibilityLabel="Distribution des écarts au tour de référence"
      >
        {buckets.map((b, i) => {
          if (b.count <= 0) return null;
          const h = Math.max(3, (b.count / maxCount) * (HIST_HEIGHT - 4));
          const x = i * (barW + gap);
          return (
            <RoundedRect
              key={i}
              x={x}
              y={HIST_HEIGHT - h}
              width={barW}
              height={h}
              r={4}
              color={colors.qdi.regularite}
            />
          );
        })}
      </Canvas>
      <View style={[styles.histLabels, { width }]}>
        {/* Regroupé : sinon le compte et le seau sont lus en deux arrêts —
            « 12 », puis « 0,5–1 s » — et le nombre reste orphelin. */}
        {buckets.map((b, i) => (
          <View
            key={i}
            style={styles.histLabelCell}
            accessible
            accessibilityLabel={`${b.count} tours, écart ${BUCKET_LABELS[i] ?? ''}`}
          >
            <Text style={styles.histCount}>{b.count}</Text>
            <Text style={styles.histBucket}>{BUCKET_LABELS[i] ?? ''}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ===========================================================================
// 3. Grille de faits — RollingCounter au premier viewport
// ===========================================================================

function StatsGrid({ cells }: { cells: (PilotStatCell & { kind: PilotStatKind })[] }) {
  const reduce = useReduceMotion();
  const { ref, visible } = useFirstViewport(!reduce);
  return (
    <Animated.View ref={ref} style={styles.statGrid}>
      {cells.map((c) => (
        <StatItem key={c.key} datum={c} visible={visible} />
      ))}
    </Animated.View>
  );
}

function StatItem({
  datum,
  visible,
}: {
  datum: PilotStatCell & { kind: PilotStatKind };
  visible: boolean;
}) {
  const isNum = datum.value !== '—';
  return (
    // La valeur passe par `children` (RollingCounter) : StatCell ne la connaît
    // pas et ne regroupe donc pas d'office — on lui donne le libellé complet,
    // sinon « SÉANCES » puis « 12 » sont deux arrêts sans lien.
    <StatCell
      style={styles.statCell}
      label={datum.label}
      value={isNum ? undefined : '—'}
      accessibilityLabel={`${datum.label} : ${isNum ? datum.value : 'non mesuré'}`}
    >
      {isNum ? (
        <RollingCounter
          value={visible ? datum.value : zeroed(datum.value)}
          fontSize={22}
          fontFamily={typo.monoSemi}
          accentMillis={datum.kind === 'chrono'}
        />
      ) : undefined}
    </StatCell>
  );
}

// ===========================================================================
// 4. Cartes circuits
// ===========================================================================

function DrivenCircuitCard({ circuit, onPress }: { circuit: DrivenCircuit; onPress: () => void }) {
  const sessionsLabel = `${circuit.sessionCount} séance${circuit.sessionCount > 1 ? 's' : ''}`;
  return (
    <PressScale
      onPress={onPress}
      accessibilityLabel={`${circuit.name}, ${sessionsLabel}${
        circuit.bestLapMs != null ? `, record ${msToLapLabel(circuit.bestLapMs)}` : ''
      }`}
    >
      <View style={styles.circuitCard}>
        <View style={styles.circuitThumb}>
          <OxvIcon name="circuit" size={26} color={colors.text.low} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.circuitName} numberOfLines={1}>
            {circuit.name}
          </Text>
          <Text style={styles.circuitMeta}>{sessionsLabel}</Text>
        </View>
        <Text style={styles.circuitRecord}>
          {circuit.bestLapMs != null ? msToLapLabel(circuit.bestLapMs) : '—'}
        </Text>
      </View>
    </PressScale>
  );
}

function DiscoverCircuitCard({
  circuit,
  onPress,
}: {
  circuit: DirectoryCircuit;
  onPress: () => void;
}) {
  return (
    <PressScale
      onPress={onPress}
      accessibilityLabel={`${circuit.name}, à découvrir`}
      style={styles.discoverPressable}
    >
      <View style={styles.discoverCard}>
        <View style={styles.discoverThumb}>
          <OxvIcon name="circuit" size={22} color={colors.text.dim} />
        </View>
        <Text style={styles.discoverName} numberOfLines={2}>
          {circuit.name}
        </Text>
        <Text style={styles.discoverTag}>À découvrir</Text>
      </View>
    </PressScale>
  );
}

// ===========================================================================
// Sheet détail circuit — records perso + écosystème
// ===========================================================================

function CircuitSheet({
  focus,
  directory,
  onClose,
}: {
  focus: CircuitFocus | null;
  directory: DirectoryCircuit | null;
  onClose: () => void;
}) {
  const [services, setServices] = useState<CircuitService[]>([]);
  const [servicesStatus, setServicesStatus] = useState<LoadStatus>('loading');

  useEffect(() => {
    if (!focus) return;
    let cancelled = false;
    setServicesStatus('loading');
    setServices([]);
    listCircuitServices(focus.id)
      .then((list) => {
        if (cancelled) return;
        setServices(list);
        setServicesStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setServicesStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [focus]);

  const groups = useMemo(() => groupServicesByKind(services), [services]);
  const driven = focus?.driven ?? null;
  const subtitle = directory ? circuitSubtitle(directory) : '';

  return (
    <Sheet visible={focus !== null} onClose={onClose} snapHeight={420}>
      {focus ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          <SectionHeader eyebrow="CIRCUIT" title={focus.name} />
          {subtitle ? <Text style={styles.sheetSubtitle}>{subtitle}</Text> : null}

          {/* Records perso — seulement si le circuit est roulé. */}
          {driven ? (
            <View style={styles.sheetStatRow}>
              <StatCell
                style={styles.sheetStat}
                label="Record"
                value={driven.bestLapMs != null ? msToLapLabel(driven.bestLapMs) : '—'}
              />
              <StatCell
                style={styles.sheetStat}
                label="Séances"
                value={String(driven.sessionCount)}
              />
              <StatCell
                style={styles.sheetStat}
                label="Distance"
                value={
                  driven.distanceKm > 0
                    ? `${driven.distanceKm.toFixed(1).replace('.', ',')} km`
                    : '—'
                }
              />
            </View>
          ) : (
            <Text style={styles.sheetDiscover}>
              Un circuit du réseau OXV que vous n&apos;avez pas encore roulé.
            </Text>
          )}

          {/* Écosystème du circuit. */}
          <View style={styles.sheetSection}>
            <SectionHeader eyebrow="AUTOUR DU CIRCUIT" />
            {servicesStatus === 'loading' ? (
              <StateView state="loading" shape="list" />
            ) : groups.length > 0 ? (
              <View style={{ marginTop: space.md }}>
                {groups.map((g) => (
                  <View key={g.kind} style={styles.serviceGroup}>
                    <Text style={styles.serviceKind}>
                      {SERVICE_KIND_LABELS[g.kind].toUpperCase()}
                    </Text>
                    {g.items.map((svc) => (
                      <View key={svc.id} style={styles.serviceRow}>
                        <Text style={styles.serviceName} numberOfLines={1}>
                          {svc.name}
                        </Text>
                        {svc.address ? (
                          <Text style={styles.serviceAddress} numberOfLines={1}>
                            {svc.address}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.sheetEmpty}>
                Aucun service référencé pour ce circuit pour l&apos;instant.
              </Text>
            )}
          </View>
        </ScrollView>
      ) : null}
    </Sheet>
  );
}

// ===========================================================================
// Glyphes
// ===========================================================================

function Chevron() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <SvgPath
        d="M9 5 L15.5 12 L9 19"
        stroke={colors.text.low}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

// ===========================================================================
// Styles
// ===========================================================================

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  stateWrap: {
    // Marge laterale fournie par l hote.
    paddingVertical: space.xl,
  },
  headerFixed: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 11,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    backgroundColor: colors.bg.base,
  },
  headerTitle: {
    flex: 1,
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.text.mid,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 20,
  },
  intro: {
    // Marge laterale fournie par l hote.
  },
  eyebrow: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.text.low,
  },
  title: {
    fontFamily: typo.display,
    fontSize: 22,
    color: colors.text.hi,
    lineHeight: 30,
    marginTop: space.sm,
  },
  lede: {
    fontFamily: typo.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.mid,
    marginTop: space.md,
  },
  chipScroll: {
    marginTop: space.xl,
    // Les puces defilent jusqu au bord : on annule la marge de l hote.
    marginHorizontal: -space.xl,
  },
  chipRow: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.xl,
  },
  section: {
    // Marge laterale fournie par l hote.
    marginTop: space.xxl,
  },
  card: {
    marginTop: space.lg,
    backgroundColor: colors.bg.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    padding: space.md,
  },
  caption: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text.low,
    marginTop: space.md,
  },
  recordTag: {
    position: 'absolute',
    left: CURVE_PAD_L,
    top: 2,
    zIndex: 1,
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.heritage.gold,
  },
  pointHit: {
    position: 'absolute',
    width: 36,
    height: 36,
  },
  fact: {
    fontFamily: typo.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.mid,
    marginTop: space.lg,
  },
  factNum: {
    fontFamily: typo.monoSemi,
    color: colors.qdi.regularite,
  },
  histLabels: {
    flexDirection: 'row',
    marginTop: space.sm,
  },
  histLabelCell: {
    flex: 1,
    alignItems: 'center',
  },
  histCount: {
    fontFamily: typo.monoSemi,
    fontSize: 12,
    color: colors.text.hi,
    fontVariant: ['tabular-nums'],
  },
  histBucket: {
    fontFamily: typo.mono,
    fontSize: 9,
    letterSpacing: 0.4,
    color: colors.text.low,
    marginTop: 2,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: space.lg,
    marginHorizontal: -space.sm,
  },
  statCell: {
    width: '50%',
    paddingHorizontal: space.sm,
    marginBottom: space.lg,
  },
  circuitStack: {
    marginTop: space.lg,
    gap: space.sm,
  },
  circuitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    padding: space.md,
  },
  circuitThumb: {
    width: 48,
    height: 48,
    borderRadius: radius.cell,
    backgroundColor: colors.bg.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circuitName: {
    fontFamily: typo.bodySemi,
    fontSize: 15,
    color: colors.text.hi,
  },
  circuitMeta: {
    fontFamily: typo.body,
    fontSize: 12,
    color: colors.text.low,
    marginTop: 2,
  },
  circuitRecord: {
    fontFamily: typo.monoSemi,
    fontSize: 15,
    color: colors.heritage.text,
    fontVariant: ['tabular-nums'],
  },
  subEyebrow: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.text.low,
    marginTop: space.xl,
    marginBottom: space.md,
  },
  discoverRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  discoverPressable: {
    width: '31%',
  },
  discoverCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border.strong,
    borderRadius: radius.card,
    paddingVertical: space.lg,
    paddingHorizontal: space.sm,
    alignItems: 'center',
    gap: space.sm,
    minHeight: 120,
  },
  discoverThumb: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discoverName: {
    fontFamily: typo.bodyMedium,
    fontSize: 12,
    color: colors.text.mid,
    textAlign: 'center',
  },
  discoverTag: {
    fontFamily: typo.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.text.dim,
    textTransform: 'uppercase',
  },
  signatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderRadius: radius.card,
    padding: space.lg,
  },
  signatureLabel: {
    fontFamily: typo.bodySemi,
    fontSize: 16,
    color: colors.text.hi,
  },
  signatureSub: {
    fontFamily: typo.body,
    fontSize: 12,
    color: colors.text.low,
    marginTop: 2,
  },
  // Sheet
  sheetSubtitle: {
    fontFamily: typo.body,
    fontSize: 13,
    color: colors.text.mid,
    marginTop: space.sm,
  },
  sheetStatRow: {
    flexDirection: 'row',
    marginTop: space.lg,
    marginHorizontal: -space.sm,
  },
  sheetStat: {
    flex: 1,
    paddingHorizontal: space.sm,
  },
  sheetDiscover: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text.mid,
    marginTop: space.lg,
  },
  sheetSection: {
    marginTop: space.xl,
  },
  serviceGroup: {
    marginBottom: space.lg,
  },
  serviceKind: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.text.low,
    marginBottom: space.sm,
  },
  serviceRow: {
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.hairline,
  },
  serviceName: {
    fontFamily: typo.bodyMedium,
    fontSize: 14,
    color: colors.text.hi,
  },
  serviceAddress: {
    fontFamily: typo.body,
    fontSize: 12,
    color: colors.text.low,
    marginTop: 2,
  },
  sheetEmpty: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text.mid,
    marginTop: space.md,
  },
});
