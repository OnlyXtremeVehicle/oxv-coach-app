/**
 * DataConfidenceBanner (PR-53) — bandeau honnête du niveau de confiance de
 * LECTURE d'une session (complète / partielle / limitée) + raisons factuelles.
 *
 * Présentationnel et pur : reçoit un `DataConfidence` déjà calculé par
 * `computeDataConfidence` (logique testée, PR-52). Réutilisé par le Bilan et le
 * Data Lab pour une même vérité affichée aux deux endroits.
 *
 * Doctrine d'honnêteté : c'est la qualité de la DONNÉE qui est qualifiée, jamais
 * le pilote. Sobre — ni or ni rouge (le vert ne marque ici qu'une lecture
 * complète, pas une performance). Vouvoiement, pas d'emoji.
 */

import { Text, View } from 'react-native';

import { type DataConfidence } from '@/services/dataConfidenceLogic';
import { theme } from '@/theme/v2';

const COLOR: Record<DataConfidence['level'], string> = {
  complete: theme.palette.green,
  partial: theme.palette.creamMute,
  limited: theme.palette.faint,
};

export function DataConfidenceBanner({ confidence }: { confidence: DataConfidence | null }) {
  if (!confidence) return null;
  return (
    <View
      style={s.row}
      accessibilityRole="text"
      accessibilityLabel={
        confidence.reasons.length > 0
          ? `${confidence.label}. ${confidence.reasons.join(', ')}`
          : confidence.label
      }
    >
      <View
        style={[s.dot, { backgroundColor: COLOR[confidence.level] }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <View style={{ flex: 1 }}>
        <Text style={s.label}>{confidence.label}</Text>
        {confidence.reasons.length > 0 ? (
          <Text style={s.reasons}>{confidence.reasons.join(' · ')}</Text>
        ) : null}
      </View>
    </View>
  );
}

const s = {
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.5,
    color: theme.palette.cream,
  },
  reasons: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: 2,
    lineHeight: theme.fontSize.small * 1.4,
  },
};
