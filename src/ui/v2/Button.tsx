/**
 * Button — l'action d'un écran app2. Kit V2, DA Instrument.
 *
 * ---
 *
 * POURQUOI IL ARRIVE MAINTENANT
 *
 * Le kit V2 n'avait pas de bouton. Chaque écran de `app/(app2)` composait le
 * sien au `PressScale` + `View` stylée, et le portage des écrans V1 restants
 * butait dessus : ils importent tous `@/ui/Button`, qui appartient au kit V1 et
 * porte l'autre fond (#0B0B0D contre #14151A).
 *
 * Ce composant reprend fidèlement le contrat du bouton V1 — `label`, `onPress`,
 * `variant`, `disabled`, `loading` — pour que le portage soit un changement
 * d'import, pas une réécriture d'appel.
 *
 * ---
 *
 * TROIS VARIANTES, ET LA RÈGLE D'ACCENT
 *
 *   `primary` — crème pleine, texte sombre. L'action principale.
 *   `ghost`   — bord seul. Les actions secondaires, en nombre.
 *   `accent`  — le rouge de marque. **UN SEUL par zone d'écran** (règle des
 *               jetons L0). À réserver au geste qui engage.
 *
 * L'or `heritage` n'est PAS une variante : il code le chrono et le record, pas
 * une commande.
 *
 * ---
 *
 * `loading` N'EST PAS `disabled`
 *
 * Un bouton qui travaille reste plein — il n'est pas indisponible, il est
 * occupé. L'atténuation visuelle de `disabled` dirait « vous ne pouvez pas »,
 * là où la vérité est « c'est en cours ». Les lecteurs d'écran reçoivent `busy`
 * dans un cas, `disabled` dans l'autre.
 *
 * Le libellé reste lisible pendant le chargement : le remplacer par un
 * indicateur seul ferait perdre ce qu'on était en train de faire.
 */

import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { PressScale } from './motion';
import { colors, radius, space, type as typo } from './tokens';

export type ButtonVariant = 'primary' | 'ghost' | 'accent';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  /** Action en cours : indicateur + libellé conservé, bouton non cliquable. */
  loading?: boolean;
  /**
   * Nom accessible, quand le libellé seul est ambigu — « Refuser » répété sur
   * dix cartes, par exemple. Par défaut, le libellé fait le nom.
   */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  accessibilityLabel,
  style,
}: ButtonProps) {
  // `loading` verrouille l'interaction au même titre que `disabled`, sans en
  // emprunter l'atténuation : le bouton reste plein, il travaille.
  const inerte = disabled === true || loading === true;
  const couleurTexte =
    variant === 'primary' ? colors.bg.base : variant === 'accent' ? '#FFFFFF' : colors.text.hi;

  return (
    <PressScale
      onPress={inerte ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled === true, busy: loading === true }}
      // Le bouton fait 44 pt de haut : la cible tactile est déjà atteinte.
      style={style}
    >
      <View
        style={[
          styles.base,
          variant === 'primary' && styles.primary,
          variant === 'ghost' && styles.ghost,
          variant === 'accent' && styles.accent,
          disabled === true && styles.disabled,
        ]}
      >
        {loading === true ? (
          <ActivityIndicator size="small" color={couleurTexte} style={styles.indicateur} />
        ) : null}
        <Text style={[styles.label, { color: couleurTexte }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    minHeight: 44,
    paddingHorizontal: space.lg,
    borderRadius: radius.cell,
    borderWidth: 1,
  },
  primary: {
    backgroundColor: colors.text.hi,
    borderColor: colors.text.hi,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: colors.border.strong,
  },
  accent: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  /**
   * Indisponible, et pas « occupé » : l'atténuation dit « vous ne pouvez pas ».
   * `loading` ne la porte donc jamais.
   */
  disabled: {
    opacity: 0.4,
  },
  indicateur: {
    // L'indicateur se pose à côté du libellé sans le déplacer.
    marginLeft: -space.xs,
  },
  label: {
    fontFamily: typo.bodySemi,
    fontSize: 15,
    letterSpacing: 0.2,
  },
});
