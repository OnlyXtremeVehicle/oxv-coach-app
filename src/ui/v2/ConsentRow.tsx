/**
 * ConsentRow — la ligne canonique de consentement opt-in. Kit V2, DA Instrument.
 *
 * Porté depuis `src/components/ConsentSwitchRow.tsx` (kit V1) au lot J5.
 *
 * Un libellé, une précision, un interrupteur. Le motif « partager / consentir »
 * se répète dans l'application — carnet, intention, réglages — et il doit se
 * lire pareil partout : opt-in explicite, révocable, sobre.
 *
 * ---
 *
 * CE QU'IL CHANGE À LA VERSION V1 : LA COULEUR DE LA PISTE ACTIVE
 *
 * Le composant V1 peignait la piste en VERT à l'état consenti. Le kit V2 n'a
 * pas de vert générique : `qdi.acceleration` code la branche accélération, et
 * l'emprunter pour un consentement ferait dire à une couleur de donnée
 * autre chose que sa donnée.
 *
 * L'état actif prend donc `text.hi` — la même valeur que le bouton primaire,
 * qui est déjà la couleur de « ce qui est engagé ». Un consentement n'a pas
 * besoin d'une teinte à lui : il a besoin d'être visiblement DISTINCT de
 * l'état au repos, et de le rester pour qui ne distingue pas les couleurs.
 * L'interrupteur porte de toute façon son état aux lecteurs d'écran.
 */

import { StyleSheet, Switch, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, space, type as typo } from './tokens';

export interface ConsentRowProps {
  label: string;
  /** Précision courte : portée du partage, révocabilité. */
  hint?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function ConsentRow({
  label,
  hint,
  value,
  onValueChange,
  accessibilityLabel,
  style,
}: ConsentRowProps) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.textes}>
        <Text style={styles.label}>{label}</Text>
        {hint !== undefined ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityRole="switch"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ checked: value }}
        trackColor={{ false: colors.bg.card2, true: colors.text.hi }}
        thumbColor={colors.bg.base}
        ios_backgroundColor={colors.bg.card2}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // L'interrupteur est sa propre cible ; l'écart évite qu'un appui sur le
    // texte paraisse devoir le basculer.
    gap: space.md,
    minHeight: 44,
  },
  textes: { flex: 1 },
  label: { fontFamily: typo.body, fontSize: 15, color: colors.text.hi },
  hint: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text.mid,
    marginTop: 2,
  },
});
