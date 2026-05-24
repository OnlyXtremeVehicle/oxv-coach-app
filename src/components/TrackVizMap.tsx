/**
 * TrackVizMap — composant SVG qui superpose un tracé réel (samples) sur
 * la polyline de référence du circuit, avec heatmap par vitesse.
 *
 * Adapté du composant partagé par Gabin en sem 11. Différences :
 *   - Tokens OXV (colors.margin.{green|yellow|red}, typography.*)
 *   - Pas de "verdict" / "score" affiché
 *   - Surlignage d'un segment quand sélectionné (pour zoom virage)
 */

import { useMemo } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { TrackProjection } from '@/trackviz/geometry';
import { HAUTE_SAINTONGE_TRACK } from '@/trackviz/hauteSaintonge';
import type { ScenePoint, TrackVizSample, TrackVizSegmentAnalysis } from '@/trackviz/types';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

interface TrackVizMapProps {
  samples: TrackVizSample[];
  segments: TrackVizSegmentAnalysis[];
  /** Si fourni, surligne le segment correspondant en blanc épais. */
  selectedSegmentIndex?: number | null;
  height?: number;
}

const WIDTH = 340;
const DEFAULT_HEIGHT = 220;
const PAD = 18;

function boundsFor(points: ScenePoint[]) {
  return points.reduce(
    (acc, point) => ({
      minX: Math.min(acc.minX, point.x),
      maxX: Math.max(acc.maxX, point.x),
      minY: Math.min(acc.minY, point.y),
      maxY: Math.max(acc.maxY, point.y),
    }),
    {
      minX: points[0]?.x ?? 0,
      maxX: points[0]?.x ?? 1,
      minY: points[0]?.y ?? 0,
      maxY: points[0]?.y ?? 1,
    }
  );
}

function createScaler(points: ScenePoint[], height: number) {
  const b = boundsFor(points);
  const spanX = b.maxX - b.minX || 1;
  const spanY = b.maxY - b.minY || 1;
  const scale = Math.min((WIDTH - PAD * 2) / spanX, (height - PAD * 2) / spanY);
  const offsetX = (WIDTH - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;
  return (point: ScenePoint) => ({
    x: offsetX + (point.x - b.minX) * scale,
    y: offsetY + (point.y - b.minY) * scale,
  });
}

function pathFrom(points: ScenePoint[]): string {
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
}

/**
 * Mapping vitesse → couleur doctrine OXV (rouge lent, jaune charge,
 * vert rapide). Cohérent avec marginZoneOf et la palette globale.
 */
function heatColor(speed: number, min: number, max: number): string {
  const range = Math.max(max - min, 1);
  const t = Math.max(0, Math.min(1, (speed - min) / range));
  if (t < 0.45) return colors.margin.red;
  if (t < 0.72) return colors.margin.yellow;
  return colors.margin.green;
}

export function TrackVizMap({
  samples,
  segments,
  selectedSegmentIndex,
  height = DEFAULT_HEIGHT,
}: TrackVizMapProps) {
  const model = useMemo(() => {
    const projection = new TrackProjection(HAUTE_SAINTONGE_TRACK);
    const trackScene = HAUTE_SAINTONGE_TRACK.map((p) => projection.toScene(p));
    const sampleScene = samples.map((s) =>
      projection.toScene({ lat: s.latitude, lon: s.longitude })
    );
    const scaler = createScaler([...trackScene, ...sampleScene], height);
    const track = trackScene.map(scaler);
    const trace = sampleScene.map(scaler);
    const speeds = samples.map((s) => Number(s.speed_kmh) || 0);
    const minSpeed = speeds.length > 0 ? Math.min(...speeds) : 0;
    const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 1;

    let selectedTrace: ScenePoint[] = [];
    if (selectedSegmentIndex != null) {
      const seg = segments.find((s) => s.segmentIndex === selectedSegmentIndex);
      if (seg) {
        selectedTrace = samples
          .filter((s) => s.progress >= seg.startProgress && s.progress <= seg.endProgress)
          .map((s) => scaler(projection.toScene({ lat: s.latitude, lon: s.longitude })));
      }
    }

    return { track, trace, selectedTrace, minSpeed, maxSpeed };
  }, [samples, segments, selectedSegmentIndex, height]);

  return (
    <View
      style={{
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        borderWidth: 0.5,
        borderColor: colors.border.subtle,
        padding: spacing.md,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.sm,
        }}
      >
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>TRAJECTOIRE</Text>
        <Text style={[typography.caption, { color: colors.text.tertiary }]}>
          {samples.length.toLocaleString('fr-FR')} pts
        </Text>
      </View>

      <Svg width="100%" height={height} viewBox={`0 0 ${WIDTH} ${height}`}>
        {/* Tracé de référence en pointillés */}
        <Path
          d={pathFrom(model.track)}
          stroke={colors.text.tertiary}
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="4,5"
        />

        {/* Trajectoire du pilote, colorisée par vitesse */}
        {model.trace.slice(1).map((point, i) => {
          const prev = model.trace[i];
          const sample = samples[i + 1];
          return (
            <Line
              key={`${sample.elapsed_ms}-${i}`}
              x1={prev.x}
              y1={prev.y}
              x2={point.x}
              y2={point.y}
              stroke={heatColor(sample.speed_kmh, model.minSpeed, model.maxSpeed)}
              strokeWidth={3}
              strokeLinecap="round"
              opacity={0.88}
            />
          );
        })}

        {/* Surlignage du segment sélectionné en blanc épais */}
        {model.selectedTrace.length > 1 ? (
          <Path
            d={pathFrom(model.selectedTrace)}
            stroke={colors.text.primary}
            strokeWidth={5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.95}
          />
        ) : null}

        {/* Point de départ */}
        {model.trace.length > 0 ? (
          <Circle
            cx={model.trace[0].x}
            cy={model.trace[0].y}
            r={4}
            fill={colors.margin.green}
            stroke={colors.background.primary}
            strokeWidth={1.5}
          />
        ) : null}
      </Svg>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.md,
          marginTop: spacing.sm,
        }}
      >
        <LegendDot color={colors.margin.red} label="lent" />
        <LegendDot color={colors.margin.yellow} label="charge" />
        <LegendDot color={colors.margin.green} label="rapide" />
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
        }}
      />
      <Text
        style={{
          color: colors.text.tertiary,
          fontSize: fontSize.eyebrow,
          fontFamily: 'Menlo',
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          fontWeight: fontWeight.regular,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
