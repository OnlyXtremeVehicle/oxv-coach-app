/**
 * RollingCounter — chiffres d'odomètre : chaque digit roule verticalement
 * vers sa nouvelle valeur (spring doux), les séparateurs restent statiques.
 *
 * `accentMillis` colore les millièmes (tout ce qui suit le dernier point)
 * en couleur accent — le détail chrono de la DA Instrument.
 *
 * Logique pure dans motionMath : digitsOf (découpage), diffDigits (cases
 * changées — sert à cascader les digits modifiés depuis la droite, effet
 * odomètre), digitStripOffset (translation de la bande 0-9).
 *
 * Police mono par défaut : largeur de digit constante, aucun jitter.
 * Reduce-motion : mise à jour directe, aucun roulement.
 */

import { useEffect, useMemo, useRef } from 'react';
import { Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { useReduceMotion } from './useReduceMotion';

import { diffDigits, digitsOf, digitStripOffset } from './motionMath';
import { colors, motion, type as typo } from '../tokens';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

/** Cascade entre deux digits modifiés (le moins significatif part en premier). */
const ROLL_CASCADE_MS = 30;
const ROLL_CASCADE_MAX_MS = 90;

export interface RollingCounterProps {
  /** Valeur affichée, séparateurs compris (ex. '1:41.203'). */
  value: string;
  /** Par défaut 34. */
  fontSize?: number;
  /** Par défaut colors.text.hi. */
  color?: string;
  /** Millièmes (après le dernier point) en couleur accent. */
  accentMillis?: boolean;
  /** Par défaut colors.accent. */
  accentColor?: string;
  /** Par défaut type.mono (JetBrains Mono). */
  fontFamily?: string;
  style?: StyleProp<ViewStyle>;
}

interface DigitRollProps {
  digit: number;
  cellHeight: number;
  delay: number;
  textStyle: TextStyle;
  reduce: boolean;
}

function DigitRoll({ digit, cellHeight, delay, textStyle, reduce }: DigitRollProps) {
  const offset = useSharedValue(digitStripOffset(digit, cellHeight));

  useEffect(() => {
    const target = digitStripOffset(digit, cellHeight);
    if (reduce) {
      offset.value = target;
      return;
    }
    offset.value =
      delay > 0
        ? withDelay(delay, withSpring(target, motion.springSoft))
        : withSpring(target, motion.springSoft);
  }, [digit, cellHeight, delay, reduce, offset]);

  const rollStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }));

  return (
    <View style={{ height: cellHeight, overflow: 'hidden' }}>
      <Animated.View style={rollStyle}>
        {DIGITS.map((d) => (
          <Text
            key={d}
            style={[textStyle, { height: cellHeight, lineHeight: cellHeight }]}
            allowFontScaling={false}
          >
            {d}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

export function RollingCounter({
  value,
  fontSize = 34,
  color = colors.text.hi,
  accentMillis = false,
  accentColor = colors.accent,
  fontFamily = typo.mono,
  style,
}: RollingCounterProps) {
  const reduce = useReduceMotion();
  const cells = useMemo(() => digitsOf(value, accentMillis), [value, accentMillis]);
  const cellHeight = Math.round(fontSize * 1.24);

  // Cases changées depuis le rendu précédent → cascade odomètre
  // (le digit le plus à droite roule en premier).
  const prevValue = useRef(value);
  const delays = useMemo(() => {
    const changed = diffDigits(prevValue.current, value);
    const out = new Array<number>(cells.length).fill(0);
    let rank = 0;
    for (let i = cells.length - 1; i >= 0; i--) {
      if (changed[i] && cells[i].digit !== null) {
        out[i] = Math.min(rank * ROLL_CASCADE_MS, ROLL_CASCADE_MAX_MS);
        rank++;
      }
    }
    return out;
  }, [value, cells]);
  useEffect(() => {
    prevValue.current = value;
  }, [value]);

  return (
    <View
      style={[{ flexDirection: 'row', alignItems: 'center' }, style]}
      accessible
      accessibilityLabel={value}
    >
      {cells.map((cell, index) => {
        const textStyle: TextStyle = {
          fontFamily,
          fontSize,
          color: cell.accent ? accentColor : color,
          fontVariant: ['tabular-nums'],
          textAlign: 'center',
        };
        if (cell.digit === null) {
          return (
            <Text
              key={`s${index}`}
              style={[textStyle, { height: cellHeight, lineHeight: cellHeight }]}
              allowFontScaling={false}
            >
              {cell.char}
            </Text>
          );
        }
        // La clé embarque la longueur : un changement de format ('59.9' →
        // '1:00.0') remonte des bandes neuves plutôt qu'un morph hasardeux.
        return (
          <DigitRoll
            key={`d${cells.length}-${index}`}
            digit={cell.digit}
            cellHeight={cellHeight}
            delay={delays[index]}
            textStyle={textStyle}
            reduce={reduce}
          />
        );
      })}
    </View>
  );
}
