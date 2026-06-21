import { View, Text, StyleSheet } from 'react-native';
import { theme } from '@/theme/v2';
import { Card } from './Card';

type Props = { label: string; value: string; unit?: string; source?: string };

export function KpiCard({ label, value, unit, source }: Props) {
  return (
    <Card style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 13 }}>
      <Text style={styles.lab}>{label}</Text>
      <Text style={styles.val}>
        {value}
        {unit ? <Text style={styles.unit}> {unit}</Text> : null}
      </Text>
      {source ? (
        <View style={styles.src}>
          <View style={styles.dot} />
          <Text style={styles.srcT}>{source}</Text>
        </View>
      ) : null}
    </Card>
  );
}
const styles = StyleSheet.create({
  lab: {
    fontSize: theme.fontSize.micro,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
  },
  val: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.value,
    color: theme.palette.cream,
    marginTop: 4,
  },
  unit: { fontSize: theme.fontSize.small, color: theme.palette.creamMute },
  src: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: theme.dataColors.accel },
  srcT: {
    fontFamily: theme.fonts.mono,
    fontSize: 8,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
  },
});
