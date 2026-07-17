/**
 * CountUpNumber — anime un chiffre de 0 à `value` en `duration` ms.
 *
 * Sobre : un seul chiffre se construit. Pas de bounce, pas de spring,
 * juste un ease-out cubic pour donner du poids à la révélation.
 *
 * Utilisé pour le chiffre central majeur de l'app (marge globale sur le
 * bilan) où l'affichage brut « 23 % » n'a pas le même impact qu'un
 * « 0 → 23 » qui se construit.
 *
 * Respecte useNativeDriver: false (on anime du texte, pas une transform).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, type TextStyle } from 'react-native';

import { useReduceMotion } from './useReduceMotion';

export interface CountUpNumberProps {
  /** Valeur finale à afficher. */
  value: number;
  /** Durée totale de l'animation en ms. Par défaut 1000. */
  duration?: number;
  /** Style appliqué au Text. */
  style?: TextStyle | TextStyle[];
  /** Suffixe collé (ex: « % », « km/h »). */
  suffix?: string;
  /** Nombre de décimales (0 = entier). Par défaut 0. */
  decimals?: number;
  /**
   * Formatteur du nombre affiché — prime sur `decimals`. Permet de compter
   * dans une unité brute puis de formater (ex: chrono compté en ms, rendu
   * « 1:24.318 » via formatLapTimeMs). Une lambda inline chez l'appelant ne
   * relance PAS l'animation (lue via ref).
   */
  format?: (value: number) => string;
  /** Désactive l'animation (rendu direct). Par défaut false. */
  disabled?: boolean;
}

export function CountUpNumber({
  value,
  duration = 1000,
  style,
  suffix = '',
  decimals = 0,
  format,
  disabled = false,
}: CountUpNumberProps) {
  const reduceMotion = useReduceMotion();
  const off = disabled || reduceMotion;
  const progress = useRef(new Animated.Value(off ? 1 : 0)).current;
  // Formatteur stable : lu via ref pour qu'une lambda inline ne redémarre
  // pas le comptage à chaque re-render de l'appelant.
  const formatRef = useRef(format);
  formatRef.current = format;
  const fmt = useCallback(
    (n: number) => (formatRef.current ? formatRef.current(n) : formatValue(n, decimals)),
    [decimals]
  );
  const [display, setDisplay] = useState<string>(() => fmt(off ? value : 0));

  useEffect(() => {
    if (off) {
      setDisplay(fmt(value));
      return;
    }

    const listener = progress.addListener(({ value: p }) => {
      setDisplay(fmt(p * value));
    });

    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    return () => {
      progress.removeListener(listener);
    };
  }, [value, duration, fmt, off, progress]);

  return (
    <Animated.Text style={style} accessibilityLabel={`${fmt(value)}${suffix}`}>
      {display}
      {suffix}
    </Animated.Text>
  );
}

function formatValue(n: number, decimals: number): string {
  if (decimals === 0) return String(Math.round(n));
  return n.toFixed(decimals);
}
