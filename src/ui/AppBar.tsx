import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '@/theme/v2';

function Chevron() {
  return <View style={styles.chev} />;
}

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  leading?: React.ReactNode; // ex. <Logo /> sur les écrans racines
  trailing?: React.ReactNode;
};

export function AppBar({ title, subtitle, onBack, leading, trailing }: Props) {
  return (
    <View style={styles.bar}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={theme.hitSlop}>
          <Chevron />
        </Pressable>
      ) : leading ? (
        leading
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      </View>
      {trailing ?? <Text style={styles.dots}>···</Text>}
    </View>
  );
}
const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
  },
  chev: {
    width: 10,
    height: 10,
    borderLeftWidth: 1.7,
    borderBottomWidth: 1.7,
    borderColor: theme.palette.creamMute,
    transform: [{ rotate: '45deg' }],
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    letterSpacing: 1.3,
    color: theme.palette.cream,
  },
  sub: {
    fontFamily: theme.fonts.mono,
    fontSize: 8,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
    marginTop: 3,
  },
  dots: { color: theme.palette.creamMute, fontSize: 19 },
});
