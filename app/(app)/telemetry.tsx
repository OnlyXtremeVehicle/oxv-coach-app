/**
 * Écran Télémétrie — reskin fidèle maquette refonte-v2 §7.8 (08-telemetrie.png).
 *
 * HÉROS (fidèle au PNG) :
 *   - eyebrow « FORCES · TOUR N » (tour réel passé par tours.tsx, sinon SESSION) ;
 *   - diagramme G-G : cercles concentriques neutres, nuage OR (palette.gold),
 *     point EXTRÊME rouge (dataColors.brake) étiqueté « X,X G » (valeur réelle),
 *     axes accél./frein + explication factuelle ;
 *   - 3 canaux empilés : VITESSE (courbe or), FREIN (aires rouges),
 *     GAZ (aires vertes).
 *
 * Les composants partagés GGDiagram/SpeedTrace/ThrottleBrakeTrace rendent en
 * crème et n'exposent pas de props couleur : les graphes sont donc rendus
 * localement ici, avec les MÊMES données de service (loadGGPoints,
 * loadSpeedTracePoints, loadThrottleBrakePoints, loadLapFrames — gLong
 * positif = accélération).
 *
 * SOUS le héros (parti A — rien ne se perd) : repères g max (lat/frein/accél),
 * superposition d'une autre séance sur le canal vitesse, note pédagogique.
 *
 * Doctrine : l'app montre, le pilote interprète. Aucun verbe prescriptif.
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { supabase } from '@/lib/supabase';
import {
  loadGGPoints,
  loadLapFrames,
  loadSpeedTracePoints,
  loadThrottleBrakePoints,
  type SessionFrame,
} from '@/services/sessionTelemetryService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { formatDateShort } from '@/utils/format';

const { palette, dataColors, fonts, fontSize, spacing } = theme;

interface SessionPickerRow {
  id: string;
  startedAt: string;
}

/** Point G-G — même forme que le retour de loadGGPoints. */
interface GGPointData {
  gLat: number;
  gLong: number;
  speedKmh: number | null;
}

/** Point vitesse — même forme que le retour de loadSpeedTracePoints. */
interface SpeedPoint {
  progress: number;
  speedKmh: number;
}

/** Point gaz/frein — même forme que le retour de loadThrottleBrakePoints. */
interface TBPoint {
  progress: number;
  gLong: number;
}

/** Décimales fr : virgule, jamais de point. */
const fmtG1 = (v: number) => v.toFixed(1).replace('.', ',');
const fmtG2 = (v: number) => v.toFixed(2).replace('.', ',');

/** Sous-échantillonnage uniforme pour garder des paths SVG légers. */
function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = arr.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(arr[Math.floor(i * step)]);
  out.push(arr[arr.length - 1]);
  return out;
}

/**
 * Projections frames → points de graphe. Mêmes règles que les fonctions
 * session-entière du service (filtre des null, progress = i/(total−1)),
 * appliquées aux frames d'un tour (loadLapFrames).
 */
function framesToGG(frames: SessionFrame[]): GGPointData[] {
  return frames
    .filter((f) => f.gLat !== null && f.gLong !== null)
    .map((f) => ({ gLat: f.gLat as number, gLong: f.gLong as number, speedKmh: f.speedKmh }));
}

function framesToSpeed(frames: SessionFrame[]): SpeedPoint[] {
  const valid = frames.filter((f) => f.speedKmh !== null);
  if (valid.length < 2) return [];
  const total = valid.length;
  return valid.map((f, i) => ({ progress: i / (total - 1), speedKmh: f.speedKmh as number }));
}

function framesToTB(frames: SessionFrame[]): TBPoint[] {
  const valid = frames.filter((f) => f.gLong !== null);
  if (valid.length < 2) return [];
  const total = valid.length;
  return valid.map((f, i) => ({ progress: i / (total - 1), gLong: f.gLong as number }));
}

export default function TelemetryScreen() {
  const profile = useAuthStore((s2) => s2.profile);
  const params = useLocalSearchParams<{ sessionId?: string; lapNumber?: string }>();

  const [ggPoints, setGGPoints] = useState<GGPointData[]>([]);
  const [trace, setTrace] = useState<SpeedPoint[]>([]);
  const [throttleBrake, setThrottleBrake] = useState<TBPoint[]>([]);
  const [scopeLap, setScopeLap] = useState<number | null>(null);
  const [compareTrace, setCompareTrace] = useState<SpeedPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [compareOptions, setCompareOptions] = useState<SessionPickerRow[]>([]);
  const [comparePickerOpen, setComparePickerOpen] = useState(false);
  const [compareId, setCompareId] = useState<string | null>(null);

  // Charge G-G + traces. Si un tour précis est demandé (navigation depuis
  // Tours), on ne charge que ses frames ; sinon la session entière.
  useEffect(() => {
    if (!params.sessionId) {
      setLoading(false);
      return;
    }
    const sessionId = params.sessionId;
    const requestedLap = params.lapNumber ? Number.parseInt(params.lapNumber, 10) : Number.NaN;
    let cancelled = false;

    (async () => {
      if (Number.isFinite(requestedLap) && requestedLap > 0) {
        const frames = await loadLapFrames(sessionId, requestedLap);
        if (cancelled) return;
        if (frames.length > 0) {
          setGGPoints(framesToGG(frames));
          setTrace(framesToSpeed(frames));
          setThrottleBrake(framesToTB(frames));
          setScopeLap(requestedLap);
          setLoading(false);
          return;
        }
        // Tour sans frames : repli factuel sur la session entière.
      }
      const [gg, st, tb] = await Promise.all([
        loadGGPoints(sessionId),
        loadSpeedTracePoints(sessionId),
        loadThrottleBrakePoints(sessionId),
      ]);
      if (cancelled) return;
      setGGPoints(gg);
      setTrace(st);
      setThrottleBrake(tb);
      setScopeLap(null);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [params.sessionId, params.lapNumber]);

  // Charge la liste des autres sessions du pilote pour le picker compare
  useEffect(() => {
    if (!profile || !params.sessionId) return;
    const sessionA = params.sessionId;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('telemetry_sessions')
        .select('id, started_at')
        .eq('user_id', profile.id)
        .eq('status', 'completed')
        .neq('id', sessionA)
        .order('started_at', { ascending: false })
        .limit(20);
      if (cancelled) return;
      const rows = (data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        startedAt: r.started_at as string,
      }));
      setCompareOptions(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile, params.sessionId]);

  // Charge la trace comparée quand sélectionnée
  useEffect(() => {
    if (!compareId) {
      setCompareTrace(null);
      return;
    }
    let cancelled = false;
    loadSpeedTracePoints(compareId).then((points) => {
      if (!cancelled) setCompareTrace(points);
    });
    return () => {
      cancelled = true;
    };
  }, [compareId]);

  // Repères g max — calculés sur la totalité des points (pas l'échantillon).
  const ggStats = useMemo(() => {
    let maxLat = 0;
    let maxBrake = 0;
    let maxAccel = 0;
    let extreme: GGPointData | null = null;
    let extremeMag = 0;
    for (const p of ggPoints) {
      const lat = Math.abs(p.gLat);
      if (lat > maxLat) maxLat = lat;
      if (p.gLong < 0 && -p.gLong > maxBrake) maxBrake = -p.gLong;
      if (p.gLong > 0 && p.gLong > maxAccel) maxAccel = p.gLong;
      const mag = Math.hypot(p.gLat, p.gLong);
      if (mag > extremeMag) {
        extremeMag = mag;
        extreme = p;
      }
    }
    return { maxLat, maxBrake, maxAccel, extreme, extremeMag };
  }, [ggPoints]);

  const eyebrowText = loading
    ? 'FORCES'
    : scopeLap
      ? `FORCES · TOUR ${scopeLap}`
      : 'FORCES · SESSION';
  const nothingToShow = ggPoints.length === 0 && trace.length < 2 && throttleBrake.length < 2;

  return (
    <Screen>
      <AppBar title="Télémétrie" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        <Text style={s.eyebrow}>{eyebrowText}</Text>

        {loading ? (
          <Text style={s.loading}>Chargement…</Text>
        ) : nothingToShow ? (
          <EmptyText>
            Pas de données télémétriques exploitables pour cette séance. Les graphes apparaissent
            dès qu’une session contient des frames complètes.
          </EmptyText>
        ) : (
          <>
            {/* HÉROS — diagramme G-G + explication (fidèle au PNG) */}
            <View style={s.ggRow}>
              {ggPoints.length === 0 ? (
                <View style={{ flex: 1 }}>
                  <EmptyText>Pas de données d’accélération sur cette séance.</EmptyText>
                </View>
              ) : (
                <GGHero
                  points={ggPoints}
                  extreme={ggStats.extreme}
                  extremeMag={ggStats.extremeMag}
                />
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.ggLabel}>DIAGRAMME G-G</Text>
                <Text style={s.ggBody}>
                  Chaque point = une force subie dans le tour. Plus c’est large, plus vous exploitez
                  l’adhérence.
                </Text>
              </View>
            </View>

            <View style={s.separator} />

            {/* Canal VITESSE — courbe or (couleur maquette) */}
            <View style={s.channel}>
              <ChannelLabel color={palette.gold} label="Vitesse" />
              {trace.length < 2 ? (
                <EmptyText>Pas de données de vitesse exploitables.</EmptyText>
              ) : (
                <SpeedChannel points={trace} compare={compareTrace} />
              )}
            </View>

            {/* Canal FREIN — aires rouges */}
            <View style={s.channel}>
              <ChannelLabel color={dataColors.brake} label="Frein" />
              {throttleBrake.length < 2 ? (
                <EmptyText>Pas de données de freinage exploitables.</EmptyText>
              ) : (
                <GAreaChannel points={throttleBrake} kind="brake" />
              )}
            </View>

            {/* Canal GAZ — aires vertes */}
            <View style={s.channel}>
              <ChannelLabel color={dataColors.accel} label="Gaz" />
              {throttleBrake.length < 2 ? (
                <EmptyText>Pas de données d’accélération exploitables.</EmptyText>
              ) : (
                <GAreaChannel points={throttleBrake} kind="accel" />
              )}
            </View>

            {/* ————— SOUS LE HÉROS — substance conservée ————— */}

            {/* Repères g max (ex-récap du GGDiagram partagé) */}
            {ggPoints.length > 0 ? (
              <Card style={{ marginTop: spacing.xxl }}>
                <Text style={s.cardCaption}>{ggPoints.length} mesures · enveloppe d’adhérence</Text>
                <View style={s.statRow}>
                  <Stat
                    label="LAT MAX"
                    value={ggStats.maxLat > 0 ? `${fmtG2(ggStats.maxLat)} g` : '—'}
                  />
                  <Stat
                    label="FREIN MAX"
                    value={ggStats.maxBrake > 0 ? `${fmtG2(ggStats.maxBrake)} g` : '—'}
                  />
                  <Stat
                    label="ACCÉL MAX"
                    value={ggStats.maxAccel > 0 ? `${fmtG2(ggStats.maxAccel)} g` : '—'}
                  />
                </View>
              </Card>
            ) : null}

            {/* Superposition d'une autre séance sur le canal vitesse */}
            {trace.length >= 2 ? (
              <View style={{ marginTop: spacing.xxl }}>
                <SectionLabel>Comparer</SectionLabel>
                <Text style={s.compareHint}>
                  La trace vitesse d’une autre séance s’affiche en gris sur le canal Vitesse.
                </Text>

                {!comparePickerOpen && !compareId ? (
                  <View style={{ marginTop: spacing.lg }}>
                    <Button
                      label="Superposer une autre session"
                      variant="ghost"
                      onPress={() => setComparePickerOpen(true)}
                    />
                  </View>
                ) : null}

                {compareId ? (
                  <View style={{ marginTop: spacing.lg }}>
                    <Button
                      label="Retirer la superposition"
                      variant="ghost"
                      onPress={() => {
                        setCompareId(null);
                        setComparePickerOpen(false);
                      }}
                    />
                  </View>
                ) : null}

                {comparePickerOpen && !compareId ? (
                  <View style={{ marginTop: spacing.lg, gap: spacing.xs }}>
                    <View style={{ marginBottom: spacing.sm }}>
                      <SectionLabel>Choisir la session à superposer</SectionLabel>
                    </View>
                    {compareOptions.length === 0 ? (
                      <Text style={s.caption}>Aucune autre session disponible.</Text>
                    ) : (
                      compareOptions.map((o) => (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Superposer la session du ${formatDateShort(o.startedAt)}`}
                          hitSlop={theme.hitSlop}
                          key={o.id}
                          onPress={() => {
                            setCompareId(o.id);
                            setComparePickerOpen(false);
                          }}
                          style={({ pressed }) => ({
                            minHeight: 44,
                            justifyContent: 'center',
                            padding: spacing.md,
                            borderRadius: theme.radius.md,
                            borderWidth: 1,
                            borderColor: palette.line,
                            backgroundColor: palette.card2,
                            opacity: pressed ? 0.85 : 1,
                          })}
                        >
                          <Text style={s.pickerRow}>{formatDateShort(o.startedAt)}</Text>
                        </Pressable>
                      ))
                    )}
                  </View>
                ) : null}
              </View>
            ) : null}
          </>
        )}

        {/* Note pédagogique sobre */}
        <Card style={{ marginTop: spacing.xxl }}>
          <Text style={s.note}>
            Le diagramme g-g représente toutes les accélérations vécues. Un cercle plein indique que
            la voiture a exploité l’enveloppe d’adhérence à 360°. Un cercle creux indique des zones
            inexploitées. La lecture appartient au pilote ou à son coach.
          </Text>
        </Card>

        <View style={{ marginTop: spacing.xxl, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            hitSlop={theme.hitSlop}
            onPress={() => router.back()}
            style={s.backHit}
          >
            <Text style={s.backLink}>Retour</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

/* ————————————————— Graphes locaux (couleurs maquette §7.8) ————————————————— */

const GG_SIZE = 148;

/**
 * Diagramme G-G héros : cercles concentriques neutres, nuage OR, point extrême
 * ROUGE étiqueté « X,X G ». Accélération vers le haut (gLong positif = accél,
 * convention service), freinage vers le bas.
 */
function GGHero({
  points,
  extreme,
  extremeMag,
}: {
  points: GGPointData[];
  extreme: GGPointData | null;
  extremeMag: number;
}) {
  const scale = Math.max(1.5, extremeMag * 1.12);
  const half = scale + 0.16;
  const rings = [0.5, 1.0, 1.5, 2.0].filter((r) => r < scale - 0.05);

  const cloud = useMemo(
    () =>
      downsample(
        points.filter((p) => p !== extreme),
        320
      ),
    [points, extreme]
  );

  // Étiquette du point extrême, ancrée vers le centre pour rester lisible.
  const labelAnchor = extreme && extreme.gLat > 0 ? 'end' : 'start';
  const labelX = extreme ? extreme.gLat + (extreme.gLat > 0 ? -0.16 : 0.16) : 0;
  const labelY = extreme
    ? Math.min(Math.max(-extreme.gLong, -scale + 0.34), scale - 0.16) + 0.06
    : 0;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Diagramme G-G : ${points.length} mesures. Force maximale ${fmtG1(extremeMag)} g. Accélération vers le haut, freinage vers le bas.`}
    >
      <Svg width={GG_SIZE} height={GG_SIZE} viewBox={`${-half} ${-half} ${half * 2} ${half * 2}`}>
        {/* Axes neutres */}
        <Line
          x1={-scale}
          y1={0}
          x2={scale}
          y2={0}
          stroke={palette.faint}
          strokeWidth={0.012}
          opacity={0.35}
        />
        <Line
          x1={0}
          y1={-scale}
          x2={0}
          y2={scale}
          stroke={palette.faint}
          strokeWidth={0.012}
          opacity={0.35}
        />

        {/* Cercles concentriques neutres */}
        {rings.map((r) => (
          <Circle
            key={r}
            cx={0}
            cy={0}
            r={r}
            fill="none"
            stroke={palette.faint}
            strokeWidth={0.014}
            opacity={0.45}
          />
        ))}
        <Circle
          cx={0}
          cy={0}
          r={scale}
          fill="none"
          stroke={palette.faint}
          strokeWidth={0.016}
          opacity={0.7}
        />

        {/* Axes accél. (haut) / frein (bas) */}
        <SvgText
          x={0}
          y={-scale + 0.22}
          fontSize={0.15}
          textAnchor="middle"
          fill={palette.eyebrow}
          fontFamily={fonts.mono}
        >
          accél.
        </SvgText>
        <SvgText
          x={0}
          y={scale - 0.1}
          fontSize={0.15}
          textAnchor="middle"
          fill={palette.eyebrow}
          fontFamily={fonts.mono}
        >
          frein
        </SvgText>

        {/* Nuage OR — Y inversé (accélération en haut) */}
        {cloud.map((p, i) => (
          <Circle key={i} cx={p.gLat} cy={-p.gLong} r={0.07} fill={palette.gold} opacity={0.9} />
        ))}

        {/* Point extrême ROUGE + étiquette « X,X G » (valeur réelle max) */}
        {extreme ? (
          <>
            <Circle cx={extreme.gLat} cy={-extreme.gLong} r={0.09} fill={dataColors.brake} />
            <SvgText
              x={labelX}
              y={labelY}
              fontSize={0.17}
              textAnchor={labelAnchor}
              fill={dataColors.brake}
              fontFamily={fonts.monoSemi}
            >
              {`${fmtG1(extremeMag)} G`}
            </SvgText>
          </>
        ) : null}
      </Svg>
    </View>
  );
}

/** Canal vitesse : courbe OR + superposition grise facultative. */
function SpeedChannel({ points, compare }: { points: SpeedPoint[]; compare: SpeedPoint[] | null }) {
  const W = 336;
  const H = 88;
  const PAD = 4;

  const { lo, hi, mainPath, comparePath } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const p of [...points, ...(compare ?? [])]) {
      if (p.speedKmh < min) min = p.speedKmh;
      if (p.speedKmh > max) max = p.speedKmh;
    }
    const vMin = Math.max(0, Math.floor(min / 10) * 10 - 10);
    const vMax = Math.ceil(max / 10) * 10 + 10;

    const xFor = (progress: number) => PAD + progress * (W - PAD * 2);
    const yFor = (speed: number) =>
      PAD + (H - PAD * 2) - ((speed - vMin) / (vMax - vMin)) * (H - PAD * 2);

    const build = (data: SpeedPoint[]) => {
      const pts = downsample(data, 500);
      if (pts.length === 0) return '';
      return (
        `M ${xFor(pts[0].progress).toFixed(1)},${yFor(pts[0].speedKmh).toFixed(1)} ` +
        pts
          .slice(1)
          .map((p) => `L ${xFor(p.progress).toFixed(1)},${yFor(p.speedKmh).toFixed(1)}`)
          .join(' ')
      );
    };

    return {
      lo: min,
      hi: max,
      mainPath: build(points),
      comparePath: compare && compare.length > 0 ? build(compare) : null,
    };
  }, [points, compare]);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Courbe de vitesse : de ${Math.round(lo)} à ${Math.round(hi)} kilomètres heure.`}
    >
      <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
        {comparePath ? (
          <Path
            d={comparePath}
            stroke={palette.creamMute}
            strokeWidth={1.2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        <Path
          d={mainPath}
          stroke={palette.gold}
          strokeWidth={6}
          opacity={0.12}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d={mainPath}
          stroke={palette.gold}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      {comparePath ? (
        <View style={s.legendRow}>
          <LegendDash color={palette.gold} label="Cette séance" />
          <LegendDash color={palette.creamMute} label="Séance superposée" />
        </View>
      ) : null}
    </View>
  );
}

/**
 * Canal frein/gaz : aires pleines depuis la ligne de base (bas), amplitude =
 * |g longitudinal| du côté concerné (gLong positif = accélération).
 */
function GAreaChannel({ points, kind }: { points: TBPoint[]; kind: 'brake' | 'accel' }) {
  const W = 336;
  const H = 60;
  const PAD = 2;
  const baseY = H - PAD;
  const color = kind === 'brake' ? dataColors.brake : dataColors.accel;

  const peak = useMemo(() => {
    let max = 0;
    for (const p of points) {
      const mag = kind === 'brake' ? -p.gLong : p.gLong;
      if (mag > max) max = mag;
    }
    return max;
  }, [points, kind]);

  const areaPath = useMemo(() => {
    const pts = downsample(points, 400);
    const scale = Math.max(0.5, peak * 1.05);
    const xFor = (progress: number) => PAD + progress * (W - PAD * 2);
    const yFor = (mag: number) => baseY - (mag / scale) * (H - PAD * 2);
    const test = (g: number) => (kind === 'brake' ? g < 0 : g > 0);

    const sub: string[] = [];
    let seg: string[] = [];
    let lastX = 0;
    for (const p of pts) {
      if (test(p.gLong)) {
        const x = xFor(p.progress);
        if (seg.length === 0) seg.push(`M ${x.toFixed(1)},${baseY.toFixed(1)}`);
        seg.push(`L ${x.toFixed(1)},${yFor(Math.abs(p.gLong)).toFixed(1)}`);
        lastX = x;
      } else if (seg.length > 0) {
        seg.push(`L ${lastX.toFixed(1)},${baseY.toFixed(1)} Z`);
        sub.push(seg.join(' '));
        seg = [];
      }
    }
    if (seg.length > 0) {
      seg.push(`L ${lastX.toFixed(1)},${baseY.toFixed(1)} Z`);
      sub.push(seg.join(' '));
    }
    return sub.join(' ');
  }, [points, kind, peak, baseY]);

  const channelName = kind === 'brake' ? 'freinage' : 'gaz';

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        peak > 0
          ? `Canal ${channelName} : pointe à ${fmtG2(peak)} g.`
          : `Canal ${channelName} : aucune phase mesurée.`
      }
    >
      <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
        <Line x1={PAD} y1={baseY} x2={W - PAD} y2={baseY} stroke={palette.line} strokeWidth={1} />
        {areaPath ? <Path d={areaPath} fill={color} opacity={0.75} /> : null}
      </Svg>
    </View>
  );
}

/* ————————————————— Petits composants ————————————————— */

function ChannelLabel({ color, label }: { color: string; label: string }) {
  return (
    <View style={s.channelLabelRow}>
      <View style={[s.channelDash, { backgroundColor: color }]} />
      <Text style={[s.channelLabel, { color }]}>{label}</Text>
    </View>
  );
}

function LegendDash({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <View style={{ width: 12, height: 2, backgroundColor: color, borderRadius: 1 }} />
      <Text style={s.legendLabel}>{label}</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <Text style={s.empty}>{children}</Text>;
}

const s = {
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  loading: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    color: palette.creamMute,
    paddingVertical: spacing.lg,
  },
  ggRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.lg,
  },
  ggLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.eyebrow,
    marginBottom: spacing.sm,
  },
  ggBody: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    lineHeight: fontSize.body * 1.55,
    color: palette.creamSoft,
  },
  separator: {
    height: 1,
    backgroundColor: palette.separator,
    marginTop: spacing.xl,
  },
  channel: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  channelLabelRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  channelDash: {
    width: 14,
    height: 3,
    borderRadius: 1.5,
  },
  channelLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
  },
  legendRow: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    gap: spacing.xl,
    marginTop: spacing.sm,
  },
  legendLabel: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamSoft,
  },
  cardCaption: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
    marginBottom: spacing.md,
  },
  statRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-around' as const,
  },
  statLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    color: palette.creamMute,
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  statValue: {
    fontFamily: fonts.mono,
    fontSize: fontSize.body,
    color: palette.cream,
  },
  compareHint: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.5,
    color: palette.creamMute,
    marginTop: spacing.xs,
  },
  caption: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    color: palette.creamMute,
  },
  pickerRow: {
    fontFamily: fonts.body,
    fontSize: fontSize.body,
    color: palette.cream,
  },
  note: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.5,
    color: palette.creamSoft,
  },
  empty: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    padding: spacing.lg,
    textAlign: 'center' as const,
  },
  backLink: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: palette.creamMute,
  },
  // Cible tactile confortable pour le lien « Retour » (texte seul).
  backHit: {
    minHeight: 44,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
};
