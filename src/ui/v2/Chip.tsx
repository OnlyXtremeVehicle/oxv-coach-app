/**
 * Chip — filtre/catégorie (patron Uber Eats) : pill hairline, PressScale.
 * Actif = fond `bg.card2` + bord `border.strong` ; inactif = bord `border.card`
 * sans fond. Icône OxvIcon optionnelle, même couleur que le label.
 */

import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { OxvIcon, type OxvIconName } from './icons';
import { PressScale } from './motion';
import { colors, radius, space, type as typo } from './tokens';

export interface ChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: OxvIconName;
  style?: StyleProp<ViewStyle>;
}

export function Chip({ label, active = false, onPress, icon, style }: ChipProps) {
  const color = active ? colors.text.hi : colors.text.mid;

  return (
    // hitSlop : la pill fait ~32 px de haut — on regagne la cible tactile.
    // `selected` : l'état actif n'est sinon porté que par le style visuel.
    <PressScale
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      hitSlop={{ top: 6, bottom: 6 }}
    >
      <View style={[styles.pill, active && styles.pillActive, style]}>
        {icon !== undefined ? <OxvIcon name={icon} size={14} color={color} /> : null}
        <Text style={[styles.label, { color }]}>{label}</Text>
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border.card,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 7,
    alignSelf: 'flex-start',
  },
  pillActive: {
    backgroundColor: colors.bg.card2,
    borderColor: colors.border.strong,
  },
  label: {
    fontFamily: typo.bodyMedium,
    fontSize: 13,
  },
});
