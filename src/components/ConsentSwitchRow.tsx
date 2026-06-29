/**
 * ConsentSwitchRow (V9 §17 System) — ligne canonique de consentement opt-in.
 *
 * Un libellé, une précision optionnelle, un interrupteur. Centralise le motif
 * « partage / consentement » répété dans l'app (carnet, intention, réglages…)
 * avec la convention OXV établie : piste OR à l'état actif (active = consenti),
 * `#26262B` à l'arrêt, pouce crème. Un seul endroit pour la cohérence.
 *
 * Doctrine : opt-in explicite et révocable ; sobre, vouvoiement, pas d'emoji.
 */

import { Switch, Text, View, type ViewStyle } from 'react-native';

import { theme } from '@/theme/v2';

export function ConsentSwitchRow({
  label,
  hint,
  value,
  onValueChange,
  accessibilityLabel,
  style,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  accessibilityLabel?: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[s.row, style]}>
      <View style={s.texts}>
        <Text style={s.label}>{label}</Text>
        {hint ? <Text style={s.hint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityRole="switch"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ checked: value }}
        trackColor={{ false: '#26262B', true: theme.palette.gold }}
        thumbColor={theme.palette.cream}
      />
    </View>
  );
}

const s = {
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.md,
  },
  texts: {
    flex: 1,
  },
  label: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  hint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: 2,
  },
};
