import { Pressable, Text, StyleSheet } from 'react-native';
import { theme } from '@/theme/v2';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
};

export function Button({ label, onPress, variant = 'primary', disabled }: Props) {
  const ghost = variant === 'ghost';
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        ghost ? styles.ghost : styles.primary,
        disabled && styles.disabled,
        pressed && !disabled && { opacity: 0.85 },
      ]}
    >
      <Text
        style={[
          styles.label,
          ghost ? styles.labelGhost : styles.labelPrimary,
          disabled && styles.labelDisabled,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  primary: { backgroundColor: theme.palette.cream },
  ghost: { borderWidth: 1, borderColor: theme.palette.edge, backgroundColor: theme.palette.card2 },
  disabled: { backgroundColor: '#2a2a2e' },
  label: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  labelPrimary: { color: '#000' },
  labelGhost: { color: theme.palette.cream },
  labelDisabled: { color: '#6a6a73' },
});
