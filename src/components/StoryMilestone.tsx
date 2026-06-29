/**
 * StoryMilestone (V9 §17 Narration) — un jalon sobre du récit de saison.
 *
 * Frise verticale minimale : un repère, un fait, une précision. Présentation
 * pure (aucune donnée calculée ici). Doctrine : factuel, vouvoiement, pas
 * d'emoji ; l'or et le rouge n'apparaissent pas (un jalon n'est pas une donnée
 * de perf ni un acte de marque).
 */

import { Text, View } from 'react-native';

import { theme } from '@/theme/v2';
import type { StoryMilestone as Milestone } from '@/services/seasonStoryLogic';

export function StoryMilestone({ milestone, last }: { milestone: Milestone; last?: boolean }) {
  return (
    <View style={s.row} accessibilityRole="text">
      {/* Rail : un point + le trait qui relie au jalon suivant. */}
      <View style={s.rail}>
        <View style={s.dot} />
        {last ? null : <View style={s.line} />}
      </View>
      <View style={s.content}>
        <Text style={s.marker}>{milestone.marker}</Text>
        <Text style={s.title}>{milestone.title}</Text>
        {milestone.detail ? <Text style={s.detail}>{milestone.detail}</Text> : null}
      </View>
    </View>
  );
}

const DOT = 8;

const s = {
  row: {
    flexDirection: 'row' as const,
    gap: theme.spacing.md,
  },
  rail: {
    width: DOT,
    alignItems: 'center' as const,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: theme.palette.creamMute,
    marginTop: 5,
  },
  line: {
    flex: 1,
    width: 1,
    backgroundColor: theme.palette.line,
    marginTop: theme.spacing.xs,
  },
  content: {
    flex: 1,
    paddingBottom: theme.spacing.xl,
  },
  marker: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
  },
  title: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
    marginTop: theme.spacing.xs,
    lineHeight: theme.fontSize.body * 1.35,
  },
  detail: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: 2,
  },
};
