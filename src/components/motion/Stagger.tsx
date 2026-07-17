/**
 * Stagger — cascade l'apparition de ses enfants.
 *
 * Généralise le patron FadeInSection à une liste : chaque enfant apparaît
 * en fondu vers le haut, décalé de `interval` ms par rapport au précédent.
 * Le calcul des délais est dans staggerDelays.ts (logique pure, testée),
 * avec un plafond `maxDelay` pour que les listes longues ne traînent pas.
 *
 * Perf : chaque enfant porte sa propre Animated.View native-driven —
 * réservé aux listes COURTES (sections d'un écran, 3-10 cartes). Pour une
 * FlatList longue, ne pas envelopper les centaines d'items ici.
 *
 * Reduce-motion : géré par FadeInSection (rendu direct, aucun mouvement).
 */

import { Children, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { FadeInSection } from './FadeInSection';
import { staggerDelay } from './staggerDelays';

export interface StaggerProps {
  children: ReactNode;
  /** Délai entre deux enfants consécutifs en ms. Par défaut 80. */
  interval?: number;
  /** Délai avant le premier enfant en ms. Par défaut 0. */
  initialDelay?: number;
  /** Plafond absolu du délai en ms (listes longues). Par défaut 800. */
  maxDelay?: number;
  /** Durée du fondu de chaque enfant en ms. Par défaut 400. */
  duration?: number;
  /** Amplitude de la translation verticale en pixels. Par défaut 8. */
  translateY?: number;
  /** Désactive l'animation (rendu direct). Par défaut false. */
  disabled?: boolean;
  /** Style du conteneur. */
  style?: StyleProp<ViewStyle>;
  /** Style appliqué au wrapper de chaque enfant. */
  itemStyle?: ViewStyle | ViewStyle[];
}

export function Stagger({
  children,
  interval = 80,
  initialDelay = 0,
  maxDelay = 800,
  duration = 400,
  translateY = 8,
  disabled = false,
  style,
  itemStyle,
}: StaggerProps) {
  // toArray écarte null/undefined/booléens : les index restent contigus
  // et la cascade ne « saute » pas un temps sur un enfant conditionnel absent.
  const items = Children.toArray(children);

  return (
    <View style={style}>
      {items.map((child, index) => (
        <FadeInSection
          // toArray fournit des clés stables sur chaque élément.
          key={typeof child === 'object' && 'key' in child && child.key != null ? child.key : index}
          delay={staggerDelay(index, { interval, initialDelay, maxDelay })}
          duration={duration}
          translateY={translateY}
          disabled={disabled}
          style={itemStyle}
        >
          {child}
        </FadeInSection>
      ))}
    </View>
  );
}
