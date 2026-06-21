import { Text, StyleSheet } from 'react-native';
import { theme } from '@/theme/v2';
import { Card } from './Card';

// Un fait maître : libellé + valeur en mono (voix de l'instrument) + note neutre.
type Props = { label: string; value: string; unit?: string; note?: string };

export function Fact({ label, value, unit, note }: Props) {
  return (
    <Card style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 13 }}>
      <Text style={s.lab}>{label}</Text>
      <Text style={s.val}>
        {value}
        {unit ? <Text style={s.unit}> {unit}</Text> : null}
      </Text>
      {note ? <Text style={s.note}>{note}</Text> : null}
    </Card>
  );
}
const s = StyleSheet.create({
  lab: {
    fontSize: 11,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
    letterSpacing: 0.3,
  },
  val: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.value,
    color: theme.palette.cream,
    marginTop: 4,
  },
  unit: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  note: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
    marginTop: 6,
  },
});
