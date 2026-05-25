/**
 * LapScrubber — slider tactile pour rejouer un tour frame par frame.
 *
 * UI sobre :
 *   - Mini-carte du circuit avec un point qui matérialise la position
 *     courante (cercle blanc + halo coloré par la vitesse)
 *   - Barre horizontale (tap pour seek)
 *   - Boutons ‹ ›‹ pour avancer / reculer d'1 frame
 *   - 3 chiffres en bas : vitesse, g latéral, g longitudinal
 *   - Progression dans le tour en % (sobre)
 *
 * Mode SIMPLE (pilote particulier) : juste vitesse + position
 * Mode DÉTAILLÉ (coach / admin / pilote détaillé) : ajoute les g
 *
 * Pas de play/pause auto en V1 (volontaire — le pilote scrubbe à son
 * rythme pour analyser). À ajouter si demandé.
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
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

import Svg, { Circle } from 'react-native-svg';

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
          borderRadius: borderRadius.lg,
          borderWidth: 0.5,
          borderColor: colors.border.subtle,
          backgroundColor: colors.background.secondary,
          alignItems: 'center',
        }}
      >
        <Text style={[typography.caption, { color: colors.text.tertiary }]}>
          Pas de frames télémétriques sur ce tour.
        </Text>
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
            {/* Halo */}
            <Circle
              cx={currentScenePoint.x}
              cy={currentScenePoint.y}
              r={18}
              fill={haloColor(current.speedKmh)}
              opacity={0.25}
            />
            {/* Point principal */}
            <Circle
              cx={currentScenePoint.x}
              cy={currentScenePoint.y}
              r={8}
              fill={colors.text.primary}
              stroke={colors.background.primary}
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
          backgroundColor: colors.background.secondary,
          borderRadius: borderRadius.md,
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
              backgroundColor: colors.background.elevated,
              borderRadius: 2,
            }}
          />
          {/* Remplissage */}
          <View
            style={{
              position: 'absolute',
              top: 16,
              left: 0,
              height: 4,
              width: `${progress * 100}%`,
              backgroundColor: colors.text.primary,
              borderRadius: 2,
            }}
          />
          {/* Curseur */}
          <View
            style={{
              position: 'absolute',
              top: 8,
              left: progress * (barWidth || 0) - 10,
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: colors.text.primary,
              borderWidth: 2,
              borderColor: colors.background.primary,
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
          <Text
            style={{
              color: colors.text.tertiary,
              fontSize: fontSize.caption,
              fontFamily: 'Menlo',
              alignSelf: 'center',
            }}
          >
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
      <Text style={[typography.eyebrow, { color: colors.text.tertiary, marginBottom: 4 }]}>
        {label}
      </Text>
      <Text
        style={{
          color: colors.text.primary,
          fontSize: fontSize.title,
          fontWeight: fontWeight.light,
          fontFamily: 'Menlo',
        }}
      >
        {value}
        {unit ? (
          <Text
            style={{
              fontSize: fontSize.caption,
              color: colors.text.tertiary,
              fontFamily: 'Menlo',
            }}
          >
            {' '}
            {unit}
          </Text>
        ) : null}
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
        borderRadius: borderRadius.md,
        borderWidth: 0.5,
        borderColor: colors.border.subtle,
        opacity: pressed ? 0.5 : 1,
      })}
    >
      <Text
        style={{
          color: colors.text.secondary,
          fontSize: fontSize.caption,
          fontFamily: 'Menlo',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function haloColor(speed: number | null): string {
  if (speed === null) return colors.text.tertiary;
  if (speed < 80) return '#4A8FCC'; // bleu lent
  if (speed < 140) return colors.text.primary;
  return colors.accent.red;
}

/**
 * Wrapper sortir Svg pour le SVG racine — ce composant ajoute un Svg pour
 * pouvoir afficher Circle dehors d'un layer CircuitMap.
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
        fill={colors.text.primary}
        stroke={colors.background.primary}
        strokeWidth={2}
      />
    </Svg>
  );
}
