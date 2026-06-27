import {
  Pressable,
  View,
  ViewStyle,
  StyleSheet,
  type GestureResponderEvent,
  type StyleProp,
} from 'react-native';
import { theme } from '@/theme/v2';

type CardProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * Rend la carte actionnable. Absent → simple conteneur (comportement V1
   * inchangé). Présent → retour pressé sobre + rôle bouton + cible ≥ 44 px.
   */
  onPress?: (e: GestureResponderEvent) => void;
  /** Désactive l'action (atténue + non cliquable). Sans effet si non pressable. */
  disabled?: boolean;
  /** Libellé d'accessibilité quand la carte est actionnable. */
  accessibilityLabel?: string;
};

export function Card({ children, style, onPress, disabled, accessibilityLabel }: CardProps) {
  if (onPress) {
    return (
      <Pressable
        onPress={disabled ? undefined : onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: !!disabled }}
        style={({ pressed }) => [
          styles.card,
          styles.pressable,
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed,
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.palette.card,
    borderColor: theme.palette.line,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  // Cible tactile confortable lorsque la carte porte une action.
  pressable: { minHeight: 44 },
  // Affordance pressée cohérente avec le reste du kit (sobre, sans animation).
  pressed: { opacity: 0.92, borderColor: theme.palette.edge },
  disabled: { opacity: 0.5 },
});
