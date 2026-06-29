/**
 * AIReviewBanner (V9 §17 Coach) — cadre une suggestion assistée par IA en
 * attente de validation humaine.
 *
 * Posé au-dessus du brouillon dans l'Assistant IA coach : il rappelle que le
 * texte est PRÉ-RÉDIGÉ et FILTRÉ côté serveur, et qu'il n'atteint le pilote
 * qu'après la validation du coach. L'IA propose, le coach décide.
 *
 * Doctrine : descriptif, sobre, accent coach neutre (jamais l'or = donnée ni le
 * rouge = marque). Vouvoiement, pas d'emoji.
 */

import { Text, View } from 'react-native';

import { theme } from '@/theme/v2';

export function AIReviewBanner() {
  return (
    <View style={s.banner} accessibilityRole="text">
      <View style={s.head}>
        <View style={s.dot} />
        <Text style={s.title}>Suggestion assistée par IA</Text>
      </View>
      <Text style={s.body}>
        Pré-rédigée et filtrée côté serveur. Relisez, éditez, puis décidez — rien n’atteint le
        pilote sans votre validation.
      </Text>
    </View>
  );
}

const s = {
  banner: {
    borderLeftWidth: 2,
    borderLeftColor: theme.palette.coach,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.palette.card2,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  head: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.palette.coach,
  },
  title: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
    color: theme.palette.coach,
  },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.55,
    marginTop: theme.spacing.sm,
  },
};
