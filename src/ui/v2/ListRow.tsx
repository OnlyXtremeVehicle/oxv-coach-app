/**
 * ListRow — LA ligne de liste universelle de (app2), séparateur hairline :
 * OxvIcon optionnelle + label (+ sous-label) + côté droit au choix —
 * `right` (slot libre : switch…), sinon `value` texte, plus un chevron de
 * navigation quand la ligne est pressable. PressScale si `onPress`.
 */

import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { OxvIcon, type OxvIconName } from './icons';
import { PressScale } from './motion';
import { colors, space, type as typo } from './tokens';

export interface ListRowProps {
  label: string;
  icon?: OxvIconName;
  sublabel?: string;
  /** Valeur texte à droite (ignorée si `right` est fourni). */
  value?: string;
  /** Slot libre à droite (switch, badge…) — prime sur `value`/chevron. */
  right?: ReactNode;
  /** Chevron de navigation. Par défaut : visible si `onPress` sans `right`. */
  chevron?: boolean;
  /** Séparateur hairline bas. Par défaut true. */
  divider?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

function Chevron() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path
        d="M9 5 L15.5 12 L9 19"
        stroke={colors.text.dim}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export function ListRow({
  label,
  icon,
  sublabel,
  value,
  right,
  chevron,
  divider = true,
  disabled = false,
  onPress,
  accessibilityLabel,
  style,
}: ListRowProps) {
  const showChevron = chevron ?? (onPress !== undefined && right === undefined);

  // Libellé par défaut : CE QUE LA LIGNE MONTRE, dans l'ordre où l'œil le
  // lit. Le PressScale aplatit ses enfants — avec le seul `label`, le
  // sous-label et la valeur affichés restaient muets au lecteur d'écran.
  // `value` est écartée quand `right` occupe la place : elle n'est pas
  // affichée non plus.
  const defaultA11y = [label, sublabel, right === undefined ? value : undefined]
    .filter((s): s is string => typeof s === 'string' && s.length > 0)
    .join(', ');

  const content = (
    <View style={[styles.row, divider && styles.divider, disabled && styles.dimmed, style]}>
      {icon !== undefined ? <OxvIcon name={icon} size={20} color={colors.text.mid} /> : null}
      <View style={styles.labels}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {sublabel !== undefined ? (
          <Text style={styles.sublabel} numberOfLines={1}>
            {sublabel}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>
        {right !== undefined ? (
          right
        ) : value !== undefined ? (
          <Text style={styles.value} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        {showChevron ? <Chevron /> : null}
      </View>
    </View>
  );

  if (onPress === undefined) {
    // Ligne non pressable : sans regroupement, label et sous-label sont lus
    // comme deux éléments séparés. On ne groupe PAS quand `right` est fourni :
    // le slot peut porter un contrôle (interrupteur…) que le groupe rendrait
    // inatteignable au lecteur d'écran.
    if (right !== undefined) return content;
    return (
      <View accessible accessibilityLabel={accessibilityLabel ?? defaultA11y}>
        {content}
      </View>
    );
  }

  return (
    <PressScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? defaultA11y}
    >
      {content}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 52,
    paddingVertical: space.md,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.hairline,
  },
  dimmed: {
    opacity: 0.5,
  },
  labels: {
    flex: 1,
  },
  label: {
    fontFamily: typo.bodyMedium,
    fontSize: 15,
    color: colors.text.hi,
  },
  sublabel: {
    fontFamily: typo.body,
    fontSize: 12,
    color: colors.text.low,
    marginTop: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  value: {
    fontFamily: typo.mono,
    fontSize: 14,
    color: colors.text.mid,
    fontVariant: ['tabular-nums'],
  },
});
