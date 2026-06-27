import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '@/theme/v2';

type Props = {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  /** Désactive le sélecteur entier (atténué + non cliquable). Optionnel. */
  disabled?: boolean;
};

export function Segmented({ options, value, onChange, disabled }: Props) {
  return (
    <View style={[styles.seg, disabled && styles.segDisabled]}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable
            key={o}
            onPress={disabled ? undefined : () => onChange(o)}
            disabled={disabled}
            accessibilityRole="tab"
            accessibilityState={{ selected: on, disabled: !!disabled }}
            style={({ pressed }) => [
              styles.btn,
              on && styles.on,
              pressed && !disabled && styles.pressed,
            ]}
            hitSlop={theme.hitSlop}
          >
            <Text style={[styles.t, on && styles.tOn]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  seg: {
    flexDirection: 'row',
    backgroundColor: theme.palette.card2,
    borderColor: theme.palette.line,
    borderWidth: 1,
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  segDisabled: { opacity: 0.4 },
  // Pastille volontairement compacte ; la cible tactile est étendue par le
  // hitSlop (≈ +16 px) pour rester confortable sans grossir le visuel.
  btn: { paddingVertical: theme.spacing.sm - 2, paddingHorizontal: theme.spacing.md - 2 },
  on: { backgroundColor: 'rgba(255,255,255,0.07)' },
  pressed: { opacity: 0.7 },
  t: {
    fontFamily: theme.fonts.mono,
    fontSize: 8,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
  },
  tOn: { color: theme.palette.cream },
});
