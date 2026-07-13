/**
 * Écran #22 — Comparer un virage. Reskin FIDÈLE à la maquette Claude Design
 * refonte-v2 §7bis #6d (screens/22-comparer-virage.png).
 *
 * Maquette (haut → bas) : AppBar détail « Comparer · Virage N » · 2 pills de
 * tours (tiret or / tiret bleu) · carte : 2 tracés superposés du MÊME virage
 * (tour A en OR, tour B en BLEU #4F9DF7) + points d'apex · 3 tuiles factuelles
 * (apex A / apex B / écart) · une phrase descriptive. Deux faits côte à côte,
 * AUCUN gagnant.
 *
 * Pivot assumé (doc à l'appui) : l'écran comparait 2 SESSIONS ; la cible v2
 * compare 2 TOURS de la même séance — cf. cartographie fonctionnelle du bundle
 * (« Deux tours côte à côte sur un même virage »), 12_ACCEPTANCE_CRITERIA §2.4
 * (« deux tours du pilote ») et AUDIT_CDC_V2 (écart connu « 2 sessions au lieu
 * de 2 tours »). DROP net : picker de 2ᵉ session, tableaux delta et GForceBars
 * adossés à `segment_analyses` (stats PAR SESSION — aucune table par tour,
 * besoin noté, zéro schéma inventé).
 *
 * Données réelles uniquement :
 *   - tours : `fetchSessionLaps` (table `laps`) — numéros, chronos, meilleur ;
 *   - trace : `loadLapFrames` (table `telemetry_frames`, RLS pilote/coach),
 *     fenêtrée sur le virage via les progress de HAUTE_SAINTONGE_SEGMENTS
 *     (même approximation V1 index/total que cornerDeepDiveService — appliquée
 *     à UN tour, donc plus juste que sur la séance entière) ;
 *   - apex : frame la plus proche de la corde OSM (même méthode que
 *     virage.tsx) ; vitesse mesurée à ce point, sinon « — ».
 * L'annotation « apex +tôt » du PNG n'est PAS reprise : chiffre d'exemple,
 * aucune définition validée de l'antériorité d'apex.
 *
 * Couleurs : OR = tour de référence A (défaut : meilleur tour → lien chrono,
 * convention verrouillée « A or / B bleu ; aucun gagnant », PLAN_V3) ; BLEU
 * trajectoire = tour B. L'écart reste crème : un delta n'est pas un record.
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Circle as SvgCircle } from 'react-native-svg';

import {
  CircuitMap,
  TrackLayer,
  TrajectoryLayer,
  getCornerViewBox,
  projectToScene,
} from '@/components/CircuitMap';
import { getCorner } from '@/lib/circuitTopology';
import { fetchSessionLaps } from '@/services/sessionsService';
import { type SessionFrame, loadLapFrames } from '@/services/sessionTelemetryService';
import { HAUTE_SAINTONGE_SEGMENTS } from '@/trackviz/hauteSaintonge';
import type { Lap } from '@/types/telemetry';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { formatLapTime } from '@/utils/format';

// Fond de l'encart graphe — couleur maquette non tokenisée, même valeur que
// l'encart du Zoom virage (virage.tsx, 07-zoom-virage.png).
const GRAPH_BG = '#0E0E10';

/** Portion du tour couvrant le virage + point d'apex mesuré. */
interface CornerSlice {
  points: { lat: number; lon: number }[];
  apex: { lat: number; lon: number; speedKmh: number | null } | null;
}

/**
 * Fenêtre le tour sur le virage (progress index/total — approximation V1,
 * cf. cornerDeepDiveService) puis marque la frame la plus proche de la corde
 * OSM (même méthode d'argmin que virage.tsx). Jamais de point inventé.
 */
function sliceCorner(
  frames: SessionFrame[],
  win: { start: number; end: number } | null,
  apexRef: { lat: number; lon: number }
): CornerSlice {
  const valid = frames.filter(
    (f): f is SessionFrame & { lat: number; lon: number } => f.lat !== null && f.lon !== null
  );
  const total = valid.length;
  if (total === 0) return { points: [], apex: null };

  const windowed =
    win && total > 1
      ? valid.filter((_, i) => {
          const p = i / (total - 1);
          return p >= win.start && p <= win.end;
        })
      : valid;
  if (windowed.length === 0) return { points: [], apex: null };

  let apexIdx = 0;
  let bestD = Infinity;
  windowed.forEach((f, i) => {
    const d = (f.lat - apexRef.lat) ** 2 + (f.lon - apexRef.lon) ** 2;
    if (d < bestD) {
      bestD = d;
      apexIdx = i;
    }
  });
  const apexFrame = windowed[apexIdx];

  return {
    points: windowed.map((f) => ({ lat: f.lat, lon: f.lon })),
    apex: { lat: apexFrame.lat, lon: apexFrame.lon, speedKmh: apexFrame.speedKmh },
  };
}

export default function VirageComparerScreen() {
  const params = useLocalSearchParams<{ index?: string; sessionA?: string }>();
  const cornerIndex = Number(params.index ?? '1');
  const corner = getCorner(cornerIndex);

  const [laps, setLaps] = useState<Lap[]>([]);
  const [loadingLaps, setLoadingLaps] = useState(true);
  const [lapA, setLapA] = useState<number | null>(null);
  const [lapB, setLapB] = useState<number | null>(null);
  // null = frames en cours de chargement pour le tour sélectionné.
  const [framesA, setFramesA] = useState<SessionFrame[] | null>(null);
  const [framesB, setFramesB] = useState<SessionFrame[] | null>(null);
  const [expanded, setExpanded] = useState<'A' | 'B' | null>(null);

  // Charge les tours réels de la séance ; défaut : A = meilleur tour (lien
  // chrono → or), B = le tour valide suivant au chrono. Aucun tour → état vide.
  useEffect(() => {
    if (!params.sessionA) {
      setLoadingLaps(false);
      return;
    }
    let cancelled = false;
    fetchSessionLaps(params.sessionA)
      .then((rows) => {
        if (cancelled) return;
        setLaps(rows);
        const valid = rows.filter((l) => !l.is_outlap && !l.is_inlap);
        const pool = valid.length >= 2 ? valid : rows;
        const sorted = [...pool].sort((x, y) => x.duration_seconds - y.duration_seconds);
        const first = pool.find((l) => l.is_best_lap) ?? sorted[0] ?? null;
        const second = sorted.find((l) => first !== null && l.lap_number !== first.lap_number);
        setLapA(first ? first.lap_number : null);
        setLapB(second ? second.lap_number : null);
        setLoadingLaps(false);
      })
      .catch(() => {
        if (!cancelled) setLoadingLaps(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.sessionA]);

  // Frames réelles du tour A (telemetry_frames via loadLapFrames, RLS intacte).
  useEffect(() => {
    if (!params.sessionA || lapA === null) return;
    const sessionId = params.sessionA;
    const lapNumber = lapA;
    let cancelled = false;
    setFramesA(null);
    loadLapFrames(sessionId, lapNumber).then((rows) => {
      if (!cancelled) setFramesA(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [params.sessionA, lapA]);

  // Frames réelles du tour B.
  useEffect(() => {
    if (!params.sessionA || lapB === null) return;
    const sessionId = params.sessionA;
    const lapNumber = lapB;
    let cancelled = false;
    setFramesB(null);
    loadLapFrames(sessionId, lapNumber).then((rows) => {
      if (!cancelled) setFramesB(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [params.sessionA, lapB]);

  const viewBox = useMemo(() => {
    if (!corner) return undefined;
    return getCornerViewBox({ lat: corner.apexLat, lon: corner.apexLon }, 100);
  }, [corner]);

  // Fenêtre progress du virage (segments trackviz réels, mêmes bornes que
  // cornerDeepDiveService).
  const cornerWindow = useMemo(() => {
    const sg = HAUTE_SAINTONGE_SEGMENTS.find((seg) => seg.order === cornerIndex);
    return sg ? { start: sg.progressStart, end: sg.progressEnd } : null;
  }, [cornerIndex]);

  const sliceA = useMemo(
    () =>
      corner && framesA
        ? sliceCorner(framesA, cornerWindow, { lat: corner.apexLat, lon: corner.apexLon })
        : null,
    [framesA, cornerWindow, corner]
  );
  const sliceB = useMemo(
    () =>
      corner && framesB
        ? sliceCorner(framesB, cornerWindow, { lat: corner.apexLat, lon: corner.apexLon })
        : null,
    [framesB, cornerWindow, corner]
  );

  // Vitesses d'apex mesurées, arrondies AVANT le delta pour que les trois
  // tuiles restent cohérentes entre elles (84 − 79 = +5).
  const apexAKmh = sliceA?.apex?.speedKmh != null ? Math.round(sliceA.apex.speedKmh) : null;
  const apexBKmh = sliceB?.apex?.speedKmh != null ? Math.round(sliceB.apex.speedKmh) : null;
  const delta = apexAKmh !== null && apexBKmh !== null ? apexAKmh - apexBKmh : null;
  const deltaText =
    delta === null ? '—' : delta > 0 ? `+${delta}` : delta < 0 ? `−${Math.abs(delta)}` : '±0';

  // Phrase descriptive dérivée du delta MESURÉ (vouvoiement, jamais de
  // consigne, aucun gagnant). Delta absent → pas de phrase.
  const caption =
    delta === null || lapA === null || lapB === null
      ? null
      : delta > 0
        ? `Au tour ${lapA}, vous portez plus de vitesse à l'apex. Deux faits, côte à côte.`
        : delta < 0
          ? `Au tour ${lapB}, vous portez plus de vitesse à l'apex. Deux faits, côte à côte.`
          : "Vitesse d'apex identique sur les deux tours. Deux faits, côte à côte.";

  if (!corner) {
    return (
      <Screen scroll={false}>
        <AppBar title="Comparer" onBack={() => router.back()} />
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: theme.spacing.lg,
          }}
        >
          <Text style={[s.emptyTitle, { textAlign: 'center' }]}>Ce virage n'existe pas.</Text>
        </View>
      </Screen>
    );
  }

  const framesLoading = framesA === null || framesB === null;
  const noTrace =
    !framesLoading && (sliceA?.points.length ?? 0) < 2 && (sliceB?.points.length ?? 0) < 2;

  return (
    <Screen>
      <AppBar
        title={`Comparer · Virage ${corner.index}`}
        subtitle={corner.name}
        onBack={() => router.back()}
      />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        {!params.sessionA ? (
          <EmptyBlock
            title="Aucune séance à comparer."
            hint="Ouvrez ce comparateur depuis un virage du Data Lab."
          />
        ) : loadingLaps ? (
          <Text style={[s.meta, { paddingVertical: theme.spacing.lg }]}>Chargement…</Text>
        ) : lapA === null || lapB === null ? (
          <EmptyBlock
            title="Deux tours complets, au minimum."
            hint="La comparaison s'ouvre dès que la séance contient deux tours."
          />
        ) : (
          <>
            {/* Sélecteurs de tours réels — pills v2 (tiret or / tiret bleu). */}
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <LapPill
                color={theme.palette.gold}
                lapNumber={lapA}
                expanded={expanded === 'A'}
                onPress={() => setExpanded(expanded === 'A' ? null : 'A')}
              />
              <LapPill
                color={theme.dataColors.trajectory}
                lapNumber={lapB}
                expanded={expanded === 'B'}
                onPress={() => setExpanded(expanded === 'B' ? null : 'B')}
              />
            </View>

            {/* Choix du tour pour la pill dépliée — tours réels de la séance. */}
            {expanded ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: theme.spacing.sm }}
                contentContainerStyle={{ gap: theme.spacing.xs, paddingHorizontal: 2 }}
              >
                {laps.map((l) => {
                  const otherLap = expanded === 'A' ? lapB : lapA;
                  if (l.lap_number === otherLap) return null;
                  const on = (expanded === 'A' ? lapA : lapB) === l.lap_number;
                  const kind = l.is_best_lap
                    ? ', meilleur tour'
                    : l.is_outlap
                      ? ', tour de sortie'
                      : l.is_inlap
                        ? ', tour de rentrée'
                        : '';
                  return (
                    <Pressable
                      key={l.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`Tour ${l.lap_number}, ${formatLapTime(l.duration_seconds)}${kind}`}
                      accessibilityHint="Sélectionne ce tour pour la comparaison"
                      hitSlop={theme.hitSlop}
                      onPress={() => {
                        if (expanded === 'A') setLapA(l.lap_number);
                        else setLapB(l.lap_number);
                        setExpanded(null);
                      }}
                      style={({ pressed }) => [
                        s.chip,
                        {
                          borderColor: on
                            ? l.is_best_lap
                              ? theme.palette.gold
                              : theme.palette.edge
                            : theme.palette.line,
                          opacity: pressed ? 0.85 : l.is_outlap || l.is_inlap ? 0.6 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.chipNum,
                          { color: on ? theme.palette.cream : theme.palette.creamMute },
                        ]}
                      >
                        T{l.lap_number}
                      </Text>
                      {/* Chrono : l'or reste au meilleur tour (record), seul. */}
                      <Text style={[s.chipChrono, l.is_best_lap && { color: theme.palette.gold }]}>
                        {formatLapTime(l.duration_seconds)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            {/* Tracés superposés du même virage — or sur bleu, points d'apex. */}
            <Card style={s.traceCard}>
              {framesLoading ? (
                <View style={s.traceLoading}>
                  <Text style={s.meta}>Chargement…</Text>
                </View>
              ) : (
                <View
                  accessible
                  accessibilityLabel={`Tracés superposés du virage ${corner.index} : tour ${lapA} en or, tour ${lapB} en bleu, points d'apex marqués.`}
                >
                  <CircuitMap
                    viewBox={viewBox}
                    height={240}
                    background={GRAPH_BG}
                    borderRadius={theme.radius.md}
                  >
                    <TrackLayer animate={false} opacity={0.25} strokeWidth={6} />
                    {sliceB && sliceB.points.length > 1 ? (
                      <TrajectoryLayer
                        points={sliceB.points}
                        colorMode="uniform"
                        color={theme.dataColors.trajectory}
                        strokeWidth={3}
                      />
                    ) : null}
                    {sliceA && sliceA.points.length > 1 ? (
                      <TrajectoryLayer
                        points={sliceA.points}
                        colorMode="uniform"
                        color={theme.palette.gold}
                        strokeWidth={3}
                      />
                    ) : null}
                    {sliceB?.apex ? (
                      <ApexDot at={sliceB.apex} color={theme.dataColors.trajectory} />
                    ) : null}
                    {sliceA?.apex ? <ApexDot at={sliceA.apex} color={theme.palette.gold} /> : null}
                  </CircuitMap>
                </View>
              )}
            </Card>
            {noTrace ? (
              <Text style={[s.meta, { marginBottom: theme.spacing.lg }]}>
                Pas de trace GPS exploitable sur ce virage pour ces tours.
              </Text>
            ) : null}

            {/* Trois faits — apex A, apex B, écart. Aucun gagnant. */}
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <Tile
                label={`T${lapA} · apex`}
                labelColor={theme.palette.gold}
                value={apexAKmh !== null ? String(apexAKmh) : '—'}
                a11y={`Vitesse à l'apex au tour ${lapA} : ${apexAKmh !== null ? `${apexAKmh} kilomètres heure` : 'non mesurée'}.`}
              />
              <Tile
                label={`T${lapB} · apex`}
                labelColor={theme.dataColors.trajectory}
                value={apexBKmh !== null ? String(apexBKmh) : '—'}
                a11y={`Vitesse à l'apex au tour ${lapB} : ${apexBKmh !== null ? `${apexBKmh} kilomètres heure` : 'non mesurée'}.`}
              />
              {/* Delta = fait neutre, pas un record → crème, jamais l'or. */}
              <Tile
                label="Écart"
                labelColor={theme.palette.eyebrow}
                value={deltaText}
                a11y={
                  delta !== null
                    ? `Écart à l'apex, tour ${lapA} moins tour ${lapB} : ${deltaText} kilomètres heure.`
                    : "Écart à l'apex non mesurable."
                }
              />
            </View>

            {caption ? <Text style={s.caption}>{caption}</Text> : null}
          </>
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

/**
 * Pill de sélection d'un tour (maquette : tiret couleur + « Tour N »).
 * Or = tour de référence A, bleu trajectoire = tour B — étiquetage de série,
 * jamais un verdict. Tap → déplie le choix parmi les tours réels.
 */
function LapPill({
  color,
  lapNumber,
  expanded,
  onPress,
}: {
  color: string;
  lapNumber: number;
  expanded: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`Tour ${lapNumber}`}
      accessibilityHint="Ouvre le choix du tour à comparer"
      onPress={onPress}
      style={({ pressed }) => [
        s.pill,
        {
          borderColor: expanded ? theme.palette.edge : theme.palette.line,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[s.pillDash, { backgroundColor: color }]} />
      <Text style={s.pillTxt}>Tour {lapNumber}</Text>
    </Pressable>
  );
}

/** Point d'apex mesuré sur un tracé (frame réelle la plus proche de la corde). */
function ApexDot({ at, color }: { at: { lat: number; lon: number }; color: string }) {
  const p = projectToScene(at);
  return (
    <SvgCircle
      cx={p.x}
      cy={p.y}
      r={3.4}
      fill={color}
      stroke={theme.palette.night}
      strokeWidth={1.2}
    />
  );
}

/** Tuile factuelle — eyebrow mono couleur de série, chiffre mono, unité. */
function Tile({
  label,
  labelColor,
  value,
  a11y,
}: {
  label: string;
  labelColor: string;
  value: string;
  a11y: string;
}) {
  return (
    <View style={s.tile} accessible accessibilityLabel={a11y}>
      <Text style={[s.tileLabel, { color: labelColor }]}>{label}</Text>
      <Text style={s.tileValue}>{value}</Text>
      <Text style={s.tileUnit}>km/h</Text>
    </View>
  );
}

function EmptyBlock({ title, hint }: { title: string; hint: string }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.xxl }}>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyHint}>{hint}</Text>
    </Card>
  );
}

const s = {
  meta: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.5,
    color: theme.palette.creamMute,
  },
  pill: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    backgroundColor: theme.palette.card2,
  },
  pillDash: {
    width: 16,
    height: 3,
    borderRadius: 2,
  },
  pillTxt: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.5,
    color: theme.palette.cream,
  },
  chip: {
    minHeight: 44,
    minWidth: 56,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    backgroundColor: theme.palette.card2,
  },
  chipNum: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
  },
  chipChrono: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.4,
    color: theme.palette.creamMute,
    marginTop: 2,
  },
  traceCard: {
    padding: theme.spacing.xs,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  traceLoading: {
    height: 240,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  tile: {
    flex: 1,
    alignItems: 'center' as const,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
    backgroundColor: theme.palette.surface3,
  },
  tileLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
  },
  tileValue: {
    fontFamily: theme.fonts.king,
    fontSize: theme.fontSize.value,
    color: theme.palette.cream,
    marginTop: theme.spacing.xs,
  },
  tileUnit: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: theme.palette.creamMute,
    marginTop: 2,
  },
  caption: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    lineHeight: theme.fontSize.small * 1.6,
    color: theme.palette.secondary,
    marginTop: theme.spacing.lg,
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
  backHit: {
    minHeight: 44,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
};
