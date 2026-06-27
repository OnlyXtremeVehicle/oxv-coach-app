import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '@/theme/v2';

type Props = { options: string[]; value: string; onChange: (v: string) => void };

export function Segmented({ options, value, onChange }: Props) {
  return (
    <View style={styles.seg}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            style={[styles.btn, on && styles.on]}
            hitSlop={6}
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
  btn: { paddingVertical: 6, paddingHorizontal: 10 },
  on: { backgroundColor: 'rgba(255,255,255,0.07)' },
  t: {
    fontFamily: theme.fonts.mono,
    fontSize: 8,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
  },
  tOn: { color: theme.palette.cream },
});
