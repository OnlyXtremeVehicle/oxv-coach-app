/**
 * OXVPromiseBlock (V9 §17 Narration) — la promesse fondatrice, posée là où le
 * pilote lit sa donnée.
 *
 * « L'app est un miroir. Elle vous montre. Elle ne vous dirige pas. » Rappelle
 * la doctrine au moment de la lecture, sans jamais prescrire. Présentation pure,
 * sobre : ni or ni rouge, vouvoiement, pas d'emoji.
 */

import { Text, View } from 'react-native';

import { theme } from '@/theme/v2';

const LINES = [
  'L’app est un miroir. Elle vous montre.',
  'Elle ne vous dirige pas.',
  'La piste est à vous. Les décisions aussi.',
];

export function OXVPromiseBlock({ compact }: { compact?: boolean }) {
  return (
    <View style={[s.block, compact ? s.compact : null]} accessibilityRole="text">
      <Text style={s.eyebrow}>LA PROMESSE OXV</Text>
      {LINES.map((line) => (
        <Text key={line} style={s.line}>
          {line}
        </Text>
      ))}
    </View>
  );
}

const s = {
  block: {
    borderTopWidth: 1,
    borderTopColor: theme.palette.line,
    paddingTop: theme.spacing.xl,
  },
  compact: {
    paddingTop: theme.spacing.lg,
  },
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
    marginBottom: theme.spacing.md,
  },
  line: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.body,
    fontStyle: 'italic' as const,
    color: theme.palette.creamSoft,
    lineHeight: theme.fontSize.body * 1.5,
  },
};
