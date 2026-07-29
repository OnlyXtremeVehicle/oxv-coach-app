/**
 * Field — champ de saisie du kit V2, DA Instrument.
 *
 * ---
 *
 * CE QU'IL REPREND DU CHAMP V1
 *
 * Le contrat, à l'identique — `label`, `helper`, `error`, `unit`, `optional`,
 * `showCounter`, plus toutes les props de `TextInput`. Un portage doit être un
 * changement d'import, pas une réécriture d'appel.
 *
 * Et l'anti-motif qu'il tuait : le « champ orphelin sous un titre pâle ». Le
 * label est LISIBLE, en casse normale, collé à l'input — jamais une étiquette
 * faible et flottante qu'on prend pour un séparateur.
 *
 * ---
 *
 * CE QU'IL REFUSE DE REPRENDRE : L'OR AU FOCUS
 *
 * Le champ V1 éclaire sa bordure en OR quand il reçoit le focus. En V2, l'or
 * `heritage` code le tier Heritage et le chrono — les jetons L0 l'écrivent :
 * *« heritage.gold = tier Heritage EXCLUSIVEMENT (jamais un chrome
 * générique) »*. Une bordure de saisie est du chrome.
 *
 * L'accent rouge est écarté pour une autre raison : il n'y en a qu'UN par zone
 * d'écran, et le dépenser sur un focus le retirerait au geste qui engage.
 *
 * Le focus se marque donc par une bordure PLUS FRANCHE, sans teinte — le même
 * `border.strong` que la Chip active. La force du trait suffit à dire « c'est
 * ici », et rien n'est emprunté à une autre signification.
 *
 * L'erreur, elle, garde l'accent : elle est rare, elle interrompt, et c'est
 * exactement le rôle d'un accent.
 */

import { forwardRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { colors, radius, space, type as typo } from './tokens';

export interface FieldProps extends Omit<TextInputProps, 'placeholderTextColor' | 'style'> {
  /** Étiquette visible au-dessus du champ — jamais un simple placeholder. */
  label: string;
  /** Marque « optionnel », discrète, à droite de l'étiquette. */
  optional?: boolean;
  /** Aide courte sous le champ : explique un terme, donne la plage attendue. */
  helper?: string;
  /** Erreur en ligne. Masque l'aide tant qu'elle est présente. */
  error?: string | null;
  /** Unité affichée à droite dans le champ (« km », « m », « s »). */
  unit?: string;
  /** Compteur de caractères — demande `maxLength`. */
  showCounter?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export const Field = forwardRef<TextInput, FieldProps>(function Field(
  {
    label,
    optional,
    helper,
    error,
    unit,
    showCounter,
    containerStyle,
    multiline,
    value,
    maxLength,
    onFocus,
    onBlur,
    editable = true,
    ...rest
  },
  ref
) {
  const [focused, setFocused] = useState(false);

  // L'erreur prime sur le focus : un champ fautif reste fautif pendant qu'on
  // le corrige, et c'est ce qu'il faut voir.
  const borderColor = error ? colors.accent : focused ? colors.border.strong : colors.border.card;

  const count = typeof value === 'string' ? value.length : 0;

  // Le type de l'événement est DÉRIVÉ de `TextInputProps` plutôt que nommé en
  // dur : React Native renomme périodiquement ces types, et un nom figé casse
  // à chaque renommage.
  const handleFocus: NonNullable<TextInputProps['onFocus']> = (e) => {
    setFocused(true);
    onFocus?.(e);
  };
  const handleBlur: NonNullable<TextInputProps['onBlur']> = (e) => {
    setFocused(false);
    onBlur?.(e);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          {label}
          {optional ? <Text style={styles.optional}> · optionnel</Text> : null}
        </Text>
        {showCounter && maxLength ? (
          <Text style={styles.counter}>
            {count}/{maxLength}
          </Text>
        ) : null}
      </View>

      <View style={[styles.inputRow, { borderColor }, multiline ? styles.inputRowMultiline : null]}>
        <TextInput
          ref={ref}
          value={value}
          maxLength={maxLength}
          multiline={multiline}
          editable={editable}
          placeholderTextColor={colors.text.dim}
          onFocus={handleFocus}
          onBlur={handleBlur}
          accessibilityLabel={label}
          style={[
            styles.input,
            multiline ? styles.inputMultiline : null,
            editable ? null : styles.inputDisabled,
          ]}
          {...rest}
        />
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : helper ? (
        <Text style={styles.helper}>{helper}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { marginBottom: space.lg },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Collé à l'input : quatre points. C'est ce qui distingue une étiquette de
    // champ d'un titre de section, et qui tue le « champ orphelin ».
    marginBottom: space.xs,
  },
  label: {
    fontFamily: typo.bodyMedium,
    fontSize: 14,
    color: colors.text.hi,
    letterSpacing: 0.2,
  },
  optional: {
    fontFamily: typo.body,
    fontSize: 12,
    color: colors.text.dim,
  },
  counter: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.text.dim,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.cell,
    backgroundColor: colors.bg.card2,
    paddingHorizontal: space.md,
    // 52 pt : au-delà de la cible tactile de 44, parce qu'on y écrit.
    minHeight: 52,
  },
  inputRowMultiline: {
    alignItems: 'stretch',
    minHeight: 96,
  },
  input: {
    flex: 1,
    color: colors.text.hi,
    fontFamily: typo.body,
    fontSize: 15,
    paddingVertical: space.md,
  },
  inputMultiline: {
    textAlignVertical: 'top',
    paddingTop: space.md,
  },
  inputDisabled: { color: colors.text.low },
  unit: {
    fontFamily: typo.mono,
    fontSize: 12,
    color: colors.text.mid,
    marginLeft: space.sm,
    letterSpacing: 0.5,
  },
  helper: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text.low,
    marginTop: space.xs,
  },
  error: {
    fontFamily: typo.body,
    fontSize: 12,
    color: colors.accent,
    marginTop: space.xs,
  },
});
