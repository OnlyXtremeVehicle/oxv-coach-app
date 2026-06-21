import { View, Text, StyleSheet } from 'react-native';
import { theme } from '@/theme/v2';

export function Chip({ label, dotColor }: { label: string; dotColor?: string }) {
  return (
    <View style={styles.chip}>
      {dotColor ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
      <Text style={styles.t}>{label}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: theme.palette.card2,
    borderColor: theme.palette.line,
    borderWidth: 1,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  t: {
    fontFamily: theme.fonts.mono,
    fontSize: 8,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
  },
});
