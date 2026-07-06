/**
 * CockpitPanel — panneau « cockpit » de la refonte NG (docs/refonte-app).
 *
 * Carte à coins équerrés (corner brackets) : le cadre d'instrument qui porte le
 * chiffre roi ou une donnée dominante. Rayon HUD 6px (angle d'instrument, pas de
 * carte web arrondie). Fond carte2, filet discret. Les équerres sont dorées
 * (donnée) par défaut, ou neutres via `plain`.
 *
 * Se greffe sur le kit sans le toucher : c'est un conteneur, pas un remplaçant de
 * Card. On l'emploie pour LE panneau dominant d'un écran, pas pour toute liste.
 */

import { StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';

import { theme } from '@/theme/v2';

const { palette, radius } = theme;

export interface CockpitPanelProps extends ViewProps {
  /** Équerres neutres (line) au lieu de dorées — pour un panneau non-donnée. */
  plain?: boolean;
  style?: ViewStyle | ViewStyle[];
}

export function CockpitPanel({ children, plain = false, style, ...rest }: CockpitPanelProps) {
  const bracketColor = plain ? palette.line : palette.edge;
  return (
    <View style={[s.panel, style]} {...rest}>
      {children}
      {/* 4 équerres — décoratives, donc masquées de l'arbre d'accessibilité. */}
      <Bracket corner="tl" color={bracketColor} />
      <Bracket corner="tr" color={bracketColor} />
      <Bracket corner="bl" color={bracketColor} />
      <Bracket corner="br" color={bracketColor} />
    </View>
  );
}

function Bracket({ corner, color }: { corner: 'tl' | 'tr' | 'bl' | 'br'; color: string }) {
  const isTop = corner === 'tl' || corner === 'tr';
  const isLeft = corner === 'tl' || corner === 'bl';
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[
        s.bracket,
        {
          borderColor: color,
          [isTop ? 'top' : 'bottom']: -1,
          [isLeft ? 'left' : 'right']: -1,
          borderTopWidth: isTop ? 1.5 : 0,
          borderBottomWidth: isTop ? 0 : 1.5,
          borderLeftWidth: isLeft ? 1.5 : 0,
          borderRightWidth: isLeft ? 0 : 1.5,
        } as ViewStyle,
      ]}
    />
  );
}

const s = StyleSheet.create({
  panel: {
    backgroundColor: palette.card2,
    borderRadius: radius.hud,
    borderWidth: 1,
    borderColor: palette.line,
    padding: theme.spacing.lg,
    overflow: 'visible',
  },
  bracket: {
    position: 'absolute',
    width: 14,
    height: 14,
  },
});
