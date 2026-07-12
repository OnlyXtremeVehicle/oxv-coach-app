/**
 * Écran #15 — Zoom virage (deep-dive). Reskin FIDÈLE aux maquettes Claude
 * Design refonte-v2 §7.7 (screens/07-zoom-virage.png), parti A fondateur.
 *
 * Héros conforme à la maquette (haut → bas) :
 *   header « Virage N » + chevrons précédent/suivant (les 7 virages Beltoise
 *   sont connus statiquement — navigation câblée) · encart graphe fond sombre :
 *   trajectoire réelle BLEUE, tracé officiel en pointillé, segment de freinage
 *   ROUGE + segment de sortie VERT (phases dérivées des vitesses MESURÉES,
 *   jamais décoratives), points FREIN / APEX / SORTIE · 3 tuiles vitesse
 *   ENTRÉE / APEX / SORTIE (chiffre roi mono) · 2 lignes factuelles
 *   pastille + phrase, dérivées des stats segment réelles.
 *
 * La substance existante est CONSERVÉE sous le héros : détail vitesses (point
 * bas, écart entrée → sortie, temps dans le virage), forces vécues
 * (GForceBars), écarts de trajectoire, annotations et repères coach, question
 * ouverte, comparaison, CTA coach. Logique / services / nav / RLS inchangés.
 * Vouvoiement ; aucune donnée inventée (« — » ou bloc masqué si absente).
 */

import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Circle as SvgCircle, Polyline as SvgPolyline, Text as SvgText } from 'react-native-svg';

import {
  CircuitMap,
  getCornerViewBox,
  getScenePoints,
  projectToScene,
} from '@/components/CircuitMap';
import { GForceBars } from '@/components/GForceBars';
import { FadeInSection } from '@/components/motion';
import { getCorner, nextCornerIndex, previousCornerIndex } from '@/lib/circuitTopology';
import { supabase } from '@/lib/supabase';
import {
  type CoachAnnotation,
  listVisibleAnnotationsForCorner,
} from '@/services/coachAnnotationsService';
import { getAnnotationAudioUrl } from '@/services/coachAudioService';
import { type CoachCornerReference, compareSpeedToReference } from '@/services/coachReferenceLogic';
import { listCoachReferencesForCorner } from '@/services/coachReferenceService';
import {
  type CornerDeepDive,
  type CornerTrajectoryPoint,
  loadCornerDeepDive,
} from '@/services/cornerDeepDiveService';
import { useAuthStore } from '@/store/useAuthStore';
import { type MarginZone, marginLabelOf, marginZoneOf } from '@/types/domain';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { formatDateShort, formatDelta, formatLapTime } from '@/utils/format';

const { palette, dataColors, fonts, fontSize, spacing, radius } = theme;

// Couleurs de la MAQUETTE §7.7 non tokenisées — réservées à l'encart graphe.
const GRAPH_BG = '#0E0E10'; // fond de l'encart graphe (07-zoom-virage.png)
const GRAPH_REFERENCE = '#3A3A40'; // tracé officiel en pointillé (07-zoom-virage.png)

/** Décimale française à 1 chiffre (« 1,2 »). */
function fr1(n: number): string {
  return n.toFixed(1).replace('.', ',');
}

/** Une phase de la trajectoire — bornes d'index sur les frames réelles. */
interface TrajectoryPhase {
  color: string;
  from: number;
  to: number;
}

interface TrajectoryReading {
  phases: TrajectoryPhase[];
  /** Début de la décélération mesurée (point FREIN), sinon null. */
  brakeIdx: number | null;
  /** Point de passage le plus proche de la corde OSM (point APEX). */
  apexIdx: number;
  /** Vrai si une réaccélération a été mesurée (point + segment SORTIE). */
  hasExit: boolean;
}

/** Chute de vitesse minimale (km/h) pour considérer un freinage MESURÉ. */
const MIN_MEASURED_DROP_KMH = 5;

/**
 * Découpe la trajectoire GPS réelle en phases (approche / freinage / virage /
 * sortie) à partir des VITESSES MESURÉES des frames — jamais une courbe
 * décorative. Sans vitesses exploitables, tout reste bleu trajectoire et
 * seuls les points géométriques réels sont marqués.
 */
function readTrajectory(
  points: CornerTrajectoryPoint[],
  apex: { lat: number; lon: number }
): TrajectoryReading | null {
  if (points.length < 2) return null;

  // Point APEX : la frame la plus proche de la corde OSM (géométrie réelle).
  let apexIdx = 0;
  let bestD = Infinity;
  points.forEach((p, i) => {
    const d = (p.lat - apex.lat) ** 2 + (p.lon - apex.lon) ** 2;
    if (d < bestD) {
      bestD = d;
      apexIdx = i;
    }
  });

  // Point bas mesuré (vitesse minimale) et pic d'entrée avant celui-ci.
  let minIdx = -1;
  let minV = Infinity;
  points.forEach((p, i) => {
    const v = p.speedKmh;
    if (v != null && Number.isFinite(v) && v < minV) {
      minV = v;
      minIdx = i;
    }
  });

  let brakeIdx = -1;
  let maxV = -Infinity;
  for (let i = 0; i < minIdx; i++) {
    const v = points[i].speedKmh;
    if (v != null && Number.isFinite(v) && v > maxV) {
      maxV = v;
      brakeIdx = i;
    }
  }

  // Pas de décélération mesurable → trajectoire entière en bleu, honnêtement.
  if (minIdx < 0 || brakeIdx < 0 || maxV - minV < MIN_MEASURED_DROP_KMH) {
    return {
      phases: [{ color: dataColors.trajectory, from: 0, to: points.length - 1 }],
      brakeIdx: null,
      apexIdx,
      hasExit: false,
    };
  }

  // Bande basse (+5 % du minimum) : fin du freinage / début de réaccélération.
  const band = minV + Math.max(2, minV * 0.05);
  let redEnd = minIdx;
  for (let i = brakeIdx + 1; i <= minIdx; i++) {
    const v = points[i].speedKmh;
    if (v != null && v <= band) {
      redEnd = i;
      break;
    }
  }
  let greenStart = minIdx;
  for (let i = points.length - 1; i >= minIdx; i--) {
    const v = points[i].speedKmh;
    if (v != null && v <= band) {
      greenStart = i;
      break;
    }
  }

  const phases: TrajectoryPhase[] = [];
  if (brakeIdx > 0) phases.push({ color: dataColors.trajectory, from: 0, to: brakeIdx });
  phases.push({ color: dataColors.brake, from: brakeIdx, to: redEnd });
  if (greenStart > redEnd)
    phases.push({ color: dataColors.trajectory, from: redEnd, to: greenStart });
  const hasExit = points.length - 1 > greenStart;
  if (hasExit) phases.push({ color: dataColors.accel, from: greenStart, to: points.length - 1 });

  return { phases, brakeIdx, apexIdx, hasExit };
}

/** Projette une portion de trajectoire en points SVG scène (mètres). */
function toSceneStr(points: { lat: number; lon: number }[]): string {
  return points
    .map((p) => {
      const sc = projectToScene(p);
      return `${sc.x.toFixed(1)},${sc.y.toFixed(1)}`;
    })
    .join(' ');
}

export default function VirageScreen() {
  const params = useLocalSearchParams<{ index?: string; sessionId?: string }>();
  const cornerIndex = Number(params.index ?? '1');
  const corner = getCorner(cornerIndex);

  const [deepDive, setDeepDive] = useState<CornerDeepDive | null>(null);
  const [annotations, setAnnotations] = useState<CoachAnnotation[]>([]);
  const [coachReferences, setCoachReferences] = useState<CoachCornerReference[]>([]);
  const [sessionPilotId, setSessionPilotId] = useState<string | null>(null);
  const profile = useAuthStore((s) => s.profile);
  const isCoach = profile?.role === 'coach' || profile?.role === 'admin';

  useEffect(() => {
    if (!params.sessionId || !corner) return;
    let cancelled = false;
    loadCornerDeepDive(params.sessionId, corner.index).then((d) => {
      if (!cancelled) setDeepDive(d);
    });
    return () => {
      cancelled = true;
    };
  }, [params.sessionId, corner]);

  // Charge les annotations partagées par les coachs de ce pilote
  useEffect(() => {
    if (!profile?.id || !corner) return;
    let cancelled = false;
    listVisibleAnnotationsForCorner(profile.id, corner.index, params.sessionId ?? null).then(
      (rows) => {
        if (!cancelled) setAnnotations(rows);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [profile?.id, corner, params.sessionId]);

  // Repères du coach pour ce virage (§10.3c-A). RLS : le pilote voit ceux
  // de ses coachs consentis ; le coach voit les siens.
  useEffect(() => {
    if (!corner) return;
    let cancelled = false;
    listCoachReferencesForCorner(corner.index).then((rows) => {
      if (!cancelled) setCoachReferences(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [corner]);

  // Côté coach : récupère l'id du pilote propriétaire de la session
  // pour pouvoir l'annoter. RLS protège (un coach ne lit que les sessions
  // d'un pilote qu'il suit).
  useEffect(() => {
    if (!isCoach || !params.sessionId) return;
    const sessionId = params.sessionId; // narrow avant async closure
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('telemetry_sessions')
        .select('user_id')
        .eq('id', sessionId)
        .maybeSingle();
      if (!cancelled && data) setSessionPilotId(data.user_id as string);
    })();
    return () => {
      cancelled = true;
    };
  }, [isCoach, params.sessionId]);

  const trajectory = useMemo(() => deepDive?.trajectory ?? [], [deepDive]);

  // Tracé officiel projeté (référence en pointillé de la maquette).
  const referenceStr = useMemo(
    () =>
      getScenePoints()
        .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        .join(' '),
    []
  );

  // Phases freinage / sortie dérivées des vitesses réelles des frames.
  const reading = useMemo(
    () =>
      corner ? readTrajectory(trajectory, { lat: corner.apexLat, lon: corner.apexLon }) : null,
    [trajectory, corner]
  );

  if (!corner) {
    return <VirageNotFound />;
  }

  const stats = deepDive?.stats ?? null;

  const onPrev = () => {
    router.replace({
      pathname: '/(app)/virage',
      params: {
        index: String(previousCornerIndex(cornerIndex)),
        sessionId: params.sessionId ?? '',
      },
    });
  };

  const onNext = () => {
    router.replace({
      pathname: '/(app)/virage',
      params: {
        index: String(nextCornerIndex(cornerIndex)),
        sessionId: params.sessionId ?? '',
      },
    });
  };

  const onCompare = () => {
    router.push({
      pathname: '/(app)/virage-comparer',
      params: {
        index: String(cornerIndex),
        sessionA: params.sessionId ?? '',
      },
    } as never);
  };

  // Marge : affichée UNIQUEMENT si des stats existent — jamais de zone inventée.
  const zone: MarginZone | null = stats
    ? (stats.marginZone ??
      (stats.marginPercent !== null && stats.marginPercent !== undefined
        ? marginZoneOf(stats.marginPercent)
        : null))
    : null;

  const viewBox = getCornerViewBox(
    { lat: corner.apexLat, lon: corner.apexLon },
    100 // 100m de rayon = ~200m de fenêtre, large
  );
  const apexScene = projectToScene({ lat: corner.apexLat, lon: corner.apexLon });

  // Lignes factuelles — dérivées des stats segment réelles, jamais des copies démo.
  const speedDrop =
    stats?.entrySpeedKmh != null && stats?.minSpeedKmh != null
      ? stats.entrySpeedKmh - stats.minSpeedKmh
      : null;

  const factLines: { key: string; color: string; value: string; rest: string }[] = [];
  if (speedDrop !== null && speedDrop > 0) {
    factLines.push({
      key: 'freinage',
      color: dataColors.brake,
      // − U+2212 (jamais le tiret ASCII sur une valeur).
      value: `−${Math.round(speedDrop)} km/h`,
      rest: "entre l'entrée et le point bas",
    });
  } else if (stats?.maxGBraking != null) {
    factLines.push({
      key: 'freinage',
      color: dataColors.brake,
      value: `${fr1(stats.maxGBraking)} g`,
      rest: 'de décélération maximale mesurée',
    });
  }
  if (stats?.maxGLateral != null) {
    factLines.push({
      key: 'lateral',
      color: dataColors.trajectory,
      value: `${fr1(stats.maxGLateral)} g`,
      rest: 'au point le plus fort du virage',
    });
  }

  const graphA11y = [
    `Trajectoire réelle du virage ${corner.index}`,
    stats?.entrySpeedKmh != null ? `entrée ${Math.round(stats.entrySpeedKmh)} km/h` : null,
    stats?.apexSpeedKmh != null ? `apex ${Math.round(stats.apexSpeedKmh)} km/h` : null,
    stats?.exitSpeedKmh != null ? `sortie ${Math.round(stats.exitSpeedKmh)} km/h` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');

  return (
    <Screen>
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xxl,
          paddingTop: spacing.md,
        }}
      >
        {/* Header maquette : chevrons précédent / suivant + « Virage N ». */}
        <View style={s.header}>
          <NavChevron dir="prev" onPress={onPrev} />
          <Text style={s.headerTitle} accessibilityRole="header">
            Virage {corner.index}
          </Text>
          <NavChevron dir="next" onPress={onNext} />
        </View>

        {/* Contexte réel : nom du virage + marge mesurée (si analysée). */}
        <Text
          style={s.contextEyebrow}
          accessibilityLabel={
            zone
              ? `${corner.name}. Marge : ${marginLabelOf(zone)}${
                  stats?.marginPercent != null
                    ? `, ${Math.round(stats.marginPercent)} pour cent`
                    : ''
                }`
              : corner.name
          }
        >
          {corner.name.toUpperCase()}
          {zone ? (
            <Text style={{ color: colorForZone(zone) }}>
              {` · ${marginLabelOf(zone).toUpperCase()}`}
              {stats?.marginPercent != null ? ` · ${Math.round(stats.marginPercent)}%` : ''}
            </Text>
          ) : null}
        </Text>

        {/* ENCART GRAPHE — trajectoire réelle ou EmptyState honnête. */}
        <FadeInSection>
          {reading ? (
            <View
              accessible
              accessibilityRole="image"
              accessibilityLabel={graphA11y}
              style={s.graphPanel}
            >
              <CircuitMap
                viewBox={viewBox}
                height={220}
                background={GRAPH_BG}
                borderRadius={radius.lg}
              >
                {/* Tracé officiel en pointillé — la référence de la maquette. */}
                <SvgPolyline
                  points={referenceStr}
                  stroke={GRAPH_REFERENCE}
                  strokeWidth={1.6}
                  strokeDasharray="5 6"
                  fill="none"
                />
                {/* Trajectoire réelle par phases mesurées. */}
                {reading.phases.map((ph) => (
                  <SvgPolyline
                    key={`${ph.from}-${ph.to}`}
                    points={toSceneStr(trajectory.slice(ph.from, ph.to + 1))}
                    stroke={ph.color}
                    strokeWidth={3.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                ))}
                {/* Points labellisés — uniquement sur phases réellement mesurées. */}
                {reading.brakeIdx !== null ? (
                  <GraphMarker
                    point={trajectory[reading.brakeIdx]}
                    color={dataColors.brake}
                    label="FREIN"
                    side="left"
                  />
                ) : null}
                <GraphMarker
                  point={trajectory[reading.apexIdx]}
                  color={dataColors.trajectory}
                  label="APEX"
                  side="right"
                />
                {reading.hasExit ? (
                  <GraphMarker
                    point={trajectory[trajectory.length - 1]}
                    color={dataColors.accel}
                    label="SORTIE"
                    side="right"
                  />
                ) : null}
                {/* Légende de la référence (bas de l'encart). */}
                <SvgPolyline
                  points={`${(apexScene.x - 92).toFixed(1)},${(apexScene.y + 88).toFixed(1)} ${(
                    apexScene.x - 76
                  ).toFixed(1)},${(apexScene.y + 88).toFixed(1)}`}
                  stroke={GRAPH_REFERENCE}
                  strokeWidth={1.4}
                  strokeDasharray="4 4"
                  fill="none"
                />
                <SvgText
                  x={apexScene.x - 72}
                  y={apexScene.y + 90}
                  fontSize={5.5}
                  fontFamily={fonts.mono}
                  fill={palette.faint}
                >
                  tracé de référence
                </SvgText>
              </CircuitMap>
            </View>
          ) : (
            <View style={[s.graphPanel, s.graphEmpty]}>
              <Text style={s.graphEmptyTitle}>TRAJECTOIRE INDISPONIBLE</Text>
              <Text style={s.graphEmptyBody}>
                La trajectoire réelle de ce virage s’affichera après l’analyse d’une séance
                enregistrée.
              </Text>
            </View>
          )}
        </FadeInSection>

        {/* 3 TUILES VITESSE — entrée / apex / sortie, depuis les stats réelles. */}
        <FadeInSection delay={60}>
          <View style={s.tilesRow}>
            <SpeedTile label="ENTRÉE" color={dataColors.brake} kmh={stats?.entrySpeedKmh ?? null} />
            <SpeedTile
              label="APEX"
              color={dataColors.trajectory}
              kmh={stats?.apexSpeedKmh ?? null}
            />
            <SpeedTile label="SORTIE" color={dataColors.accel} kmh={stats?.exitSpeedKmh ?? null} />
          </View>
        </FadeInSection>

        {/* Lignes factuelles — pastille + phrase descriptive, données réelles. */}
        {factLines.length > 0 ? (
          <FadeInSection delay={120}>
            <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
              {factLines.map((line) => (
                <View key={line.key} style={s.factRow}>
                  <View style={[s.factDot, { backgroundColor: line.color }]} />
                  <Text style={s.factTxt}>
                    <Text style={[s.factValue, { color: line.color }]}>{line.value}</Text>{' '}
                    {line.rest}
                  </Text>
                </View>
              ))}
            </View>
          </FadeInSection>
        ) : null}

        {/* ─────────────────────────────────────────────────────────────
            Sous le héros : la substance existante, conservée (parti A).
            ───────────────────────────────────────────────────────────── */}

        {/* Vitesses — le détail hors tuiles (point bas, écart, temps). */}
        {stats ? (
          <Section eyebrow="VITESSES — DÉTAIL">
            <Card style={s.dataPanel}>
              <StatRow
                label="Au point bas"
                value={stats.minSpeedKmh != null ? `${Math.round(stats.minSpeedKmh)} km/h` : '—'}
              />
              <StatRow
                label="Écart entrée → sortie"
                value={formatDelta(stats.entrySpeedKmh, stats.exitSpeedKmh, 'km/h')}
                emphasis
                last={stats.durationSeconds == null}
              />
              {stats.durationSeconds != null ? (
                <StatRow
                  label="Temps dans le virage"
                  value={formatLapTime(stats.durationSeconds)}
                  last
                />
              ) : null}
            </Card>
          </Section>
        ) : null}

        {/* Forces vécues */}
        <Section eyebrow="FORCES VÉCUES">
          <GForceBars
            lateralG={stats?.maxGLateral ?? null}
            brakingG={stats?.maxGBraking ?? null}
            accelG={stats?.maxGAccel ?? null}
          />
        </Section>

        {/* Trajectoire */}
        <Section eyebrow="TRAJECTOIRE">
          {stats?.avgLateralErrorM !== null && stats?.avgLateralErrorM !== undefined ? (
            <Card style={s.dataPanel}>
              <StatRow
                label="Écart latéral moyen"
                value={`${stats.avgLateralErrorM.toFixed(1)} m`}
              />
              <StatRow
                label="Écart latéral max"
                value={
                  stats?.maxLateralErrorM != null ? `${stats.maxLateralErrorM.toFixed(1)} m` : '—'
                }
                last
              />
            </Card>
          ) : (
            <Text style={s.body}>
              La trajectoire détaillée apparaîtra après votre première session enregistrée.
            </Text>
          )}
        </Section>

        {/* Annotations coach (si partagées) */}
        {annotations.length > 0 ? (
          <Section eyebrow={annotations.length > 1 ? 'NOTES DE VOS COACHS' : 'NOTE DE VOTRE COACH'}>
            <View style={{ gap: spacing.sm }}>
              {annotations.map((a) => (
                <Card key={a.id} style={{ borderColor: palette.coach }}>
                  <Text style={s.coachNote}>« {a.body} »</Text>
                  {a.audioUrl ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Écouter la note vocale de votre coach"
                      hitSlop={6}
                      onPress={() => {
                        const path = a.audioUrl;
                        if (!path) return;
                        getAnnotationAudioUrl(path).then((url) => {
                          if (url) Linking.openURL(url).catch(() => undefined);
                        });
                      }}
                      style={({ pressed }) => [s.voiceNote, pressed && { opacity: 0.8 }]}
                    >
                      <Text style={s.voiceNoteText}>Écouter la note vocale</Text>
                    </Pressable>
                  ) : null}
                  <Text style={[s.meta, { marginTop: spacing.sm }]}>
                    {formatDateShort(a.createdAt)}
                    {a.aiAssisted ? ' · Assistée par IA, validée par votre coach' : ''}
                  </Text>
                </Card>
              ))}
            </View>
          </Section>
        ) : null}

        {/* Repères du coach (§10.3c-A) — superposés, étiquetés, factuels. */}
        {coachReferences.length > 0 ? (
          <Section
            eyebrow={coachReferences.length > 1 ? 'REPÈRES DE VOS COACHS' : 'REPÈRE DE VOTRE COACH'}
          >
            <View style={{ gap: spacing.sm }}>
              {coachReferences.map((ref) => (
                <CoachReferenceCard
                  key={ref.id}
                  reference={ref}
                  apexKmh={stats?.apexSpeedKmh ?? null}
                />
              ))}
            </View>
          </Section>
        ) : null}

        {/* Question ouverte — doctrine */}
        <View style={{ marginBottom: spacing.xxl * 1.5, marginTop: spacing.xxl }}>
          <Text style={[s.eyebrow, { marginBottom: spacing.md }]} accessibilityRole="header">
            QUESTION
          </Text>
          <Text style={[s.manifest, { textAlign: 'center', marginVertical: spacing.lg }]}>
            Était-ce volontaire&nbsp;?
          </Text>
        </View>

        {/* CTA Comparaison */}
        {params.sessionId ? (
          <View style={{ marginBottom: spacing.md }}>
            <Button
              label="Comparer ce virage à une autre session"
              variant="ghost"
              onPress={onCompare}
            />
          </View>
        ) : null}

        {/* CTA Annoter (coach uniquement, et si pilotId résolu) */}
        {isCoach && sessionPilotId ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Annoter ce virage"
            hitSlop={theme.hitSlop}
            onPress={() =>
              router.push({
                pathname: '/(coach)/annoter',
                params: {
                  pilotId: sessionPilotId,
                  cornerIndex: String(cornerIndex),
                  sessionId: params.sessionId ?? '',
                },
              } as never)
            }
            style={({ pressed }) => [s.coachCta, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={s.coachCtaTxt}>Annoter ce virage</Text>
          </Pressable>
        ) : null}

        <View style={{ marginTop: spacing.xxl * 1.5, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            hitSlop={theme.hitSlop}
            onPress={() => router.back()}
            style={s.backHit}
          >
            <Text style={s.back}>Retour à la carte</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

/** Chevron rond ‹ › du header maquette — cible tactile 44 px. */
function NavChevron({ dir, onPress }: { dir: 'prev' | 'next'; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={dir === 'prev' ? 'Virage précédent' : 'Virage suivant'}
      hitSlop={theme.hitSlop}
      onPress={onPress}
      style={({ pressed }) => [s.navBtn, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={[s.navGlyph, dir === 'prev' ? s.navGlyphPrev : s.navGlyphNext]} />
    </Pressable>
  );
}

/** Point labellisé du graphe (FREIN / APEX / SORTIE) — position GPS réelle. */
function GraphMarker({
  point,
  color,
  label,
  side,
}: {
  point: { lat: number; lon: number };
  color: string;
  label: string;
  side: 'left' | 'right';
}) {
  const sc = projectToScene(point);
  const dx = side === 'left' ? -6 : 6;
  return (
    <>
      <SvgCircle cx={sc.x} cy={sc.y} r={3.2} fill={color} stroke={GRAPH_BG} strokeWidth={1.2} />
      <SvgText
        x={sc.x + dx}
        y={sc.y - 4}
        fontSize={6}
        fontFamily={fonts.mono}
        fill={color}
        textAnchor={side === 'left' ? 'end' : 'start'}
      >
        {label}
      </SvgText>
    </>
  );
}

/** Tuile vitesse — chiffre roi mono + « km/h », « — » si non mesurée. */
function SpeedTile({ label, color, kmh }: { label: string; color: string; kmh: number | null }) {
  return (
    <View
      accessible
      accessibilityLabel={
        kmh != null
          ? `${label}, ${Math.round(kmh)} kilomètres par heure`
          : `${label}, vitesse non mesurée`
      }
      style={s.tile}
    >
      <Text style={[s.tileLabel, { color }]}>{label}</Text>
      <Text style={s.tileValue}>{kmh != null ? Math.round(kmh) : '—'}</Text>
      <Text style={s.tileUnit}>km/h</Text>
    </View>
  );
}

function Section({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing.xxl }}>
      <View style={[s.headRow, { marginBottom: spacing.lg }]}>
        <View style={s.headDot} accessibilityElementsHidden importantForAccessibility="no" />
        <Text style={s.eyebrow} accessibilityRole="header">
          {eyebrow}
        </Text>
      </View>
      {children}
    </View>
  );
}

function StatRow({
  label,
  value,
  emphasis = false,
  last = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: palette.line,
      }}
    >
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, emphasis && { color: palette.creamMute }]}>{value}</Text>
    </View>
  );
}

function CoachReferenceCard({
  reference,
  apexKmh,
}: {
  reference: CoachCornerReference;
  apexKmh: number | null;
}) {
  const speedCmp =
    reference.targetSpeedKmh != null
      ? compareSpeedToReference(apexKmh, reference.targetSpeedKmh)
      : null;

  return (
    <Card style={{ borderColor: palette.coach, gap: spacing.xs }}>
      {reference.brakingPointM != null ? (
        <Text style={s.coachRefLine}>
          Point de freinage repère : {Math.round(reference.brakingPointM)} m
        </Text>
      ) : null}
      {reference.targetSpeedKmh != null ? (
        <Text style={s.coachRefLine}>
          Vitesse repère : {Math.round(reference.targetSpeedKmh)} km/h
          {speedCmp
            ? ` · votre apex : ${Math.round(apexKmh as number)} km/h (${
                speedCmp.deltaKmh > 0 ? '+' : ''
              }${speedCmp.deltaKmh})`
            : ''}
        </Text>
      ) : null}
      {reference.trajectoryNote ? (
        <Text style={s.coachRefNote}>{reference.trajectoryNote}</Text>
      ) : null}
    </Card>
  );
}

function VirageNotFound() {
  return (
    <Screen scroll={false}>
      <AppBar title="VIRAGE" onBack={() => router.back()} />
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.lg,
        }}
      >
        <Text style={[s.eyebrow, { marginBottom: spacing.md }]}>VIRAGE</Text>
        <Text style={[s.title, { textAlign: 'center' }]} accessibilityRole="header">
          Ce virage n&apos;existe pas.
        </Text>
        <Pressable
          accessibilityRole="button"
          hitSlop={theme.hitSlop}
          onPress={() => router.back()}
          style={[s.backHit, { marginTop: spacing.xxl * 1.5 }]}
        >
          <Text style={s.back}>Retour</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

// Couleur de l'étiquette de marge : tons DONNÉE, jamais un rouge de verdict
// (doctrine — le chiffre central n'est pas un jugement). Le jaune emprunte la
// donnée « fluidité » (dataColors.flow), pas l'or du chrono (canon R1). Le
// « terrain serré » reste neutre crème pour décrire sans condamner.
function colorForZone(zone: MarginZone): string {
  switch (zone) {
    case 'green':
      return palette.green;
    case 'yellow':
      return dataColors.flow;
    case 'red':
      return palette.creamMute;
  }
}

const s = {
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.4,
    color: palette.cream,
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.cardBorderProminent,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  navGlyph: {
    width: 9,
    height: 9,
    borderColor: palette.creamSoft,
  },
  navGlyphPrev: {
    borderLeftWidth: 1.7,
    borderBottomWidth: 1.7,
    transform: [{ rotate: '45deg' }],
    marginLeft: 3,
  },
  navGlyphNext: {
    borderRightWidth: 1.7,
    borderTopWidth: 1.7,
    transform: [{ rotate: '45deg' }],
    marginRight: 3,
  },
  contextEyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 1.6,
    textAlign: 'center' as const,
    color: palette.creamMute,
    marginBottom: spacing.xl,
  },
  graphPanel: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.borderHair,
    overflow: 'hidden' as const,
  },
  graphEmpty: {
    height: 220,
    backgroundColor: GRAPH_BG,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: spacing.xl,
  },
  graphEmptyTitle: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    color: palette.creamMute,
    marginBottom: spacing.md,
  },
  graphEmptyBody: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.body,
    color: palette.creamSoft,
    textAlign: 'center' as const,
    lineHeight: fontSize.body * 1.5,
  },
  tilesRow: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  tile: {
    flex: 1,
    backgroundColor: palette.surface3,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center' as const,
  },
  tileLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
  },
  tileValue: {
    fontFamily: fonts.king,
    fontSize: 27,
    letterSpacing: -1,
    color: palette.cream,
    marginTop: spacing.xs,
  },
  tileUnit: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: palette.creamMute,
    marginTop: 2,
  },
  factRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    backgroundColor: palette.card2,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 44,
  },
  factDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  factTxt: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.creamSoft,
    lineHeight: fontSize.body * 1.45,
  },
  factValue: {
    fontFamily: fonts.monoSemi,
    fontSize: fontSize.body,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2.4,
    textTransform: 'uppercase' as const,
    color: palette.faint,
  },
  headRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  headDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    // Repère de structure neutre — or réservé à la donnée (canon R1).
    backgroundColor: palette.creamMute,
  },
  dataPanel: {
    backgroundColor: palette.card2,
    // Ombre neutre — l'or reste réservé au chrono (canon R1), pas un accent par défaut.
    shadowColor: palette.creamMute,
    shadowOpacity: 0.07,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 0.5,
    color: palette.cream,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.creamSoft,
    lineHeight: fontSize.body * 1.5,
  },
  meta: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.5,
    color: palette.creamMute,
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.creamSoft,
  },
  statValue: {
    fontFamily: fonts.mono,
    fontSize: fontSize.body,
    color: palette.creamSoft,
  },
  manifest: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: fontSize.bodyLg * 1.6,
    color: palette.creamSoft,
  },
  coachNote: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.body,
    fontStyle: 'italic' as const,
    color: palette.cream,
    lineHeight: fontSize.body * 1.6,
  },
  voiceNote: {
    marginTop: spacing.md,
    alignSelf: 'flex-start' as const,
    minHeight: 40,
    justifyContent: 'center' as const,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.coach,
  },
  voiceNoteText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    color: palette.coach,
  },
  coachRefLine: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.cream,
  },
  coachRefNote: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.small,
    fontStyle: 'italic' as const,
    color: palette.creamSoft,
    lineHeight: fontSize.small * 1.5,
  },
  coachCta: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.coach,
    backgroundColor: palette.card2,
    alignItems: 'center' as const,
    marginBottom: spacing.xl,
  },
  coachCtaTxt: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.3,
    textTransform: 'uppercase' as const,
    color: palette.coach,
  },
  back: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: palette.creamMute,
  },
  // Cible tactile confortable pour les liens « Retour » (texte seul).
  backHit: {
    minHeight: 44,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
};
