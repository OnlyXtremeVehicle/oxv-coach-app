import { View, Text, StyleSheet } from 'react-native';
import { theme } from '@/theme/v2';

type Props = { text: string; reliability?: string };

export function DoctrineFooter({ text, reliability }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>{text}</Text>
      {reliability ? (
        <View style={styles.rel}>
          <View style={styles.dot} />
          <Text style={styles.relT}>{reliability}</Text>
        </View>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { borderLeftWidth: 2, borderLeftColor: theme.palette.gold, paddingLeft: 12 },
  text: { fontSize: theme.fontSize.small, lineHeight: 18, color: theme.palette.creamSoft },
  rel: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: theme.dataColors.accel },
  relT: {
    fontFamily: theme.fonts.mono,
    fontSize: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
  },
});
