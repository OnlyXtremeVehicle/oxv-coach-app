/**
 * LapScrubber — slider tactile pour rejouer un tour frame par frame.
 * Transposition gaming (cockpit factuel).
 *
 *   - Mini-carte avec un point de position (cream) + halo coloré par la vitesse
 *   - Barre horizontale OR (tap pour seek), curseur or
 *   - Boutons ‹ › pour avancer/reculer
 *   - Readouts mono : vitesse, g latéral, g longitudinal, progression %
 *
 * Mode SIMPLE (pilote) : vitesse + position. Mode DÉTAILLÉ : ajoute les g.
 * Pas de play/pause auto en V1 (le pilote scrubbe à son rythme).
 * Migration legacy→v2 achevée.
 */

import { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, Text, View } from 'react-native';

import {
  CircuitMap,
  CornersLayer,
  TrackLayer,
  TrajectoryLayer,
  projectToScene,
} from '@/components/CircuitMap';
import { theme } from '@/theme/v2';

import Svg, { Circle } from 'react-native-svg';

const { palette, fonts, fontSize, spacing, radius } = theme;

export interface ScrubFrame {
  lat: number | null;
  lon: number | null;
  speedKmh: number | null;
  gLat: number | null;
  gLong: number | null;
  elapsedMs: number | null;
}

export interface LapScrubberProps {
  frames: ScrubFrame[];
  /** Affiche les g (mode détaillé). */
  showGs?: boolean;
  /** Hauteur de la mini-carte en pixels. */
  mapHeight?: number;
}

export function LapScrubber({ frames, showGs = false, mapHeight = 280 }: LapScrubberProps) {
  const [index, setIndex] = useState(0);
  const [barWidth, setBarWidth] = useState(0);

  const total = frames.length;
  const safeIndex = Math.max(0, Math.min(total - 1, index));
  const current = frames[safeIndex];
  const progress = total > 1 ? safeIndex / (total - 1) : 0;

  // Trajectoire complète (gris discret) pour situer le point courant
  const trajectoryPoints = useMemo(
    () =>
      frames
        .filter(
          (f): f is ScrubFrame & { lat: number; lon: number } => f.lat !== null && f.lon !== null
        )
        .map((f) => ({ lat: f.lat, lon: f.lon, speed: f.speedKmh })),
    [frames]
  );

  // Position du point courant sur la scène SVG
  const currentScenePoint = useMemo(() => {
    if (!current || current.lat === null || current.lon === null) return null;
    return projectToScene({ lat: current.lat, lon: current.lon });
  }, [current]);

  const onBarLayout = (e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width);

  // Tap → seek à la position relative dans la barre
  const onBarPress = (locationX: number) => {
    if (barWidth <= 0 || total <= 1) return;
    const ratio = Math.max(0, Math.min(1, locationX / barWidth));
    setIndex(Math.round(ratio * (total - 1)));
  };

  if (total === 0) {
    return (
      <View
        style={{
          padding: spacing.xxl,
          borderRadius: radius.lg,
          borderWidth: 0.5,
          borderColor: palette.line,
          backgroundColor: palette.card2,
          alignItems: 'center',
        }}
      >
        <Text style={s.caption}>Pas de frames télémétriques sur ce tour.</Text>
      </View>
    );
  }

  return (
    <View>
      {/* Mini-carte avec point courant superposé */}
      <CircuitMap height={mapHeight}>
        <TrackLayer animate={false} opacity={0.35} strokeWidth={4} />
        {trajectoryPoints.length > 1 ? (
          <TrajectoryLayer points={trajectoryPoints} colorMode="uniform" />
        ) : null}
        <CornersLayer colorMode="neutral" showLabels radius={10} />
        {currentScenePoint ? (
          <>
            {/* Halo coloré par la vitesse */}
            <Circle
              cx={currentScenePoint.x}
              cy={currentScenePoint.y}
              r={18}
              fill={haloColor(current.speedKmh)}
              opacity={0.25}
            />
            {/* Point principal (cream, neutre — le halo porte la donnée) */}
            <Circle
              cx={currentScenePoint.x}
              cy={currentScenePoint.y}
              r={8}
              fill={palette.cream}
              stroke={palette.night}
              strokeWidth={2}
            />
          </>
        ) : null}
      </CircuitMap>

      {/* Readout chiffré */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-around',
          marginTop: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: palette.card2,
          borderRadius: radius.md,
        }}
      >
        <Readout
          label="VITESSE"
          value={current.speedKmh !== null ? `${Math.round(current.speedKmh)}` : '—'}
          unit="km/h"
        />
        {showGs ? (
          <>
            <Readout label="G LAT" value={current.gLat !== null ? current.gLat.toFixed(2) : '—'} />
            <Readout
              label="G LONG"
              value={current.gLong !== null ? current.gLong.toFixed(2) : '—'}
            />
          </>
        ) : null}
        <Readout label="POSITION" value={`${Math.round(progress * 100)}`} unit="%" />
      </View>

      {/* Barre de scrub */}
      <View style={{ marginTop: spacing.lg }}>
        <Pressable
          accessibilityRole="adjustable"
          onPress={(e) => onBarPress(e.nativeEvent.locationX)}
          onLayout={onBarLayout}
          style={{
            height: 36,
            justifyContent: 'center',
          }}
        >
          {/* Rail */}
          <View
            style={{
              height: 4,
              backgroundColor: palette.card2,
              borderRadius: 2,
            }}
          />
          {/* Remplissage — or (progression active) */}
          <View
            style={{
              position: 'absolute',
              top: 16,
              left: 0,
              height: 4,
              width: `${progress * 100}%`,
              backgroundColor: palette.gold,
              borderRadius: 2,
            }}
          />
          {/* Curseur — or, anneau night */}
          <View
            style={{
              position: 'absolute',
              top: 8,
              left: progress * (barWidth || 0) - 10,
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: palette.gold,
              borderWidth: 2,
              borderColor: palette.night,
            }}
          />
        </Pressable>

        {/* Boutons fine-tune */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: spacing.sm,
          }}
        >
          <StepBtn label="‹‹ 10" onPress={() => setIndex((i) => Math.max(0, i - 10))} />
          <StepBtn label="‹ 1" onPress={() => setIndex((i) => Math.max(0, i - 1))} />
          <Text style={[s.index, { alignSelf: 'center' }]}>
            {safeIndex + 1} / {total}
          </Text>
          <StepBtn label="1 ›" onPress={() => setIndex((i) => Math.min(total - 1, i + 1))} />
          <StepBtn label="10 ››" onPress={() => setIndex((i) => Math.min(total - 1, i + 10))} />
        </View>
      </View>
    </View>
  );
}

function Readout({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={[s.eyebrow, { marginBottom: 4 }]}>{label}</Text>
      <Text style={s.readoutValue}>
        {value}
        {unit ? <Text style={s.readoutUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

function StepBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
        borderRadius: radius.md,
        borderWidth: 0.5,
        borderColor: palette.line,
        opacity: pressed ? 0.5 : 1,
      })}
    >
      <Text style={s.stepLabel}>{label}</Text>
    </Pressable>
  );
}

function haloColor(speed: number | null): string {
  if (speed === null) return palette.creamMute;
  if (speed < 80) return theme.dataColors.brake; // bleu lent
  if (speed < 140) return palette.cream; // neutre
  return '#F2792B'; // ambre pilote (rouge-perf neutralisé) — vitesse haute
}

/**
 * Wrapper Svg racine — ajoute un Svg pour afficher Circle hors d'un layer
 * CircuitMap.
 */
export function PositionMarker({
  scenePoint,
  speedKmh,
  size = 80,
}: {
  scenePoint: { x: number; y: number };
  speedKmh: number | null;
  size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox={`${scenePoint.x - 30} ${scenePoint.y - 30} 60 60`}>
      <Circle
        cx={scenePoint.x}
        cy={scenePoint.y}
        r={18}
        fill={haloColor(speedKmh)}
        opacity={0.25}
      />
      <Circle
        cx={scenePoint.x}
        cy={scenePoint.y}
        r={8}
        fill={palette.cream}
        stroke={palette.night}
        strokeWidth={2}
      />
    </Svg>
  );
}

const s = {
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },
  readoutValue: { color: palette.cream, fontSize: fontSize.value, fontFamily: fonts.mono },
  readoutUnit: { color: palette.creamMute, fontSize: fontSize.small, fontFamily: fonts.mono },
  caption: { color: palette.creamMute, fontFamily: fonts.body, fontSize: fontSize.small },
  index: { color: palette.creamMute, fontSize: fontSize.small, fontFamily: fonts.mono },
  stepLabel: { color: palette.creamSoft, fontSize: fontSize.small, fontFamily: fonts.mono },
};
