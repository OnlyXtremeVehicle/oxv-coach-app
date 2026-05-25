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

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, type TextStyle } from 'react-native';

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
  /** Désactive l'animation (rendu direct). Par défaut false. */
  disabled?: boolean;
}

export function CountUpNumber({
  value,
  duration = 1000,
  style,
  suffix = '',
  decimals = 0,
  disabled = false,
}: CountUpNumberProps) {
  const progress = useRef(new Animated.Value(disabled ? 1 : 0)).current;
  const [display, setDisplay] = useState<string>(disabled ? formatValue(value, decimals) : '0');

  useEffect(() => {
    if (disabled) {
      setDisplay(formatValue(value, decimals));
      return;
    }

    const listener = progress.addListener(({ value: p }) => {
      const current = p * value;
      setDisplay(formatValue(current, decimals));
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
  }, [value, duration, decimals, disabled, progress]);

  return (
    <Animated.Text style={style} accessibilityLabel={`${formatValue(value, decimals)}${suffix}`}>
      {display}
      {suffix}
    </Animated.Text>
  );
}

function formatValue(n: number, decimals: number): string {
  if (decimals === 0) return String(Math.round(n));
  return n.toFixed(decimals);
}
