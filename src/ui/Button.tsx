import { ActivityIndicator, Pressable, Text, View, StyleSheet } from 'react-native';
import { theme } from '@/theme/v2';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
  /**
   * Action en cours : spinner + libellé conservé, bouton non cliquable et marqué
   * `busy` pour les lecteurs d'écran. N'altère pas l'API existante (optionnel).
   */
  loading?: boolean;
};

export function Button({ label, onPress, variant = 'primary', disabled, loading }: Props) {
  const ghost = variant === 'ghost';
  // `loading` verrouille l'interaction au même titre que `disabled`, sans en
  // emprunter l'atténuation visuelle (le bouton reste « plein », il travaille).
  const inert = disabled || loading;
  const spinnerColor = ghost ? theme.palette.cream : '#000';
  return (
    <Pressable
      onPress={inert ? undefined : onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        ghost ? styles.ghost : styles.primary,
        disabled && styles.disabled,
        pressed && !inert && styles.pressed,
      ]}
    >
      {/* Le libellé reste lisible pendant le chargement ; le spinner se pose à
          côté sans déplacer le texte (centrage stable). */}
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={spinnerColor}
            style={styles.spinner}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : null}
        <Text
          style={[
            styles.label,
            ghost ? styles.labelGhost : styles.labelPrimary,
            disabled && styles.labelDisabled,
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.lg - 2,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48, // cible tactile ≥ 44 px
  },
  content: { flexDirection: 'row', alignItems: 'center' },
  spinner: { marginRight: theme.spacing.sm },
  primary: { backgroundColor: theme.palette.cream },
  ghost: { borderWidth: 1, borderColor: theme.palette.edge, backgroundColor: theme.palette.card2 },
  // Retour pressé sobre : légère atténuation (grammaire d'affordance, pas d'anim).
  pressed: { opacity: 0.85 },
  // Surface « atténuée » dédiée à l'état désactivé (gris neutre, hors palette de
  // données — ne réutilise pas une couleur sémantique). Inchangée depuis la V1.
  disabled: { backgroundColor: '#2A2A2E' },
  label: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  labelPrimary: { color: '#000' },
  labelGhost: { color: theme.palette.cream },
  labelDisabled: { color: '#6A6A73' }, // gris d'état désactivé, inchangé V1
});
