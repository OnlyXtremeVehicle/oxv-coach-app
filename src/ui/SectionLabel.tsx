import { Text, StyleSheet } from 'react-native';
import { theme } from '@/theme/v2';

export function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.t}>{children}</Text>;
}
const styles = StyleSheet.create({
  t: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
  },
});
