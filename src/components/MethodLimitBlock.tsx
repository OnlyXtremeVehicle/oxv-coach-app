/**
 * MethodLimitBlock (V9 §17 Exports) — ce que dit (et ne dit pas) la carte, posé
 * sur l'écran de partage AVANT le geste.
 *
 * Rappelle, juste avant d'exporter, la portée honnête de l'image : une lecture
 * de la séance telle que mesurée par l'app — pas un temps officiel, pas un
 * record, pas un classement. Le pilote partage en connaissance de cause.
 *
 * Doctrine : descriptif, miroir, sobre ; ni or ni rouge (ce n'est ni une donnée
 * ni la marque). Vouvoiement, pas d'emoji.
 */

import { Text, View, type ViewStyle } from 'react-native';

import { theme } from '@/theme/v2';

export function MethodLimitBlock({ style }: { style?: ViewStyle }) {
  return (
    <View style={[s.block, style]} accessibilityRole="text">
      <Text style={s.title}>CE QUE DIT CETTE CARTE</Text>
      <Text style={s.body}>
        Une lecture de votre séance, telle que mesurée par l’app. Le meilleur tour est un fait — pas
        un temps officiel, pas un record, pas un classement.
      </Text>
    </View>
  );
}

const s = {
  block: {
    borderWidth: 1,
    borderColor: theme.palette.line,
    borderRadius: theme.radius.md,
    backgroundColor: theme.palette.card2,
    padding: theme.spacing.lg,
  },
  title: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginBottom: theme.spacing.sm,
  },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.6,
  },
};
