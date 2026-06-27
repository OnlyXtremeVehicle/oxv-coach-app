/**
 * Field — champ de saisie unifié OXV. Tue l'anti-pattern « champ sous le texte » :
 * un label LISIBLE (creamSoft, casse normale, police body) collé à l'input —
 * jamais un SectionLabel faint flottant qu'on prend pour un séparateur. La
 * bordure s'éclaire en or au focus (or = actif), l'erreur s'affiche en ligne,
 * l'aide explique le jargon, un compteur et une unité sont optionnels.
 *
 * Doctrine : le mono est réservé aux CHIFFRES → les labels sont en body.
 * Accessibilité : label réellement associé, cible ≥ 52 px, contraste tenu.
 *
 * Accepte toutes les props de TextInput (value, onChangeText, keyboardType,
 * secureTextEntry, multiline, maxLength…) en plus de label/helper/error/unit.
 */

import { forwardRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputFocusEventData,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { theme } from '@/theme/v2';

const { palette, fonts, fontSize, spacing, radius } = theme;

export interface FieldProps extends Omit<TextInputProps, 'placeholderTextColor' | 'style'> {
  /** Étiquette visible au-dessus du champ (jamais seulement un placeholder). */
  label: string;
  /** Marque « optionnel » discrète à droite du label. */
  optional?: boolean;
  /** Aide courte sous le champ (explique un terme, donne la plage attendue). */
  helper?: string;
  /** Erreur en ligne sous le champ (rouge). Masque l'aide quand présente. */
  error?: string | null;
  /** Unité affichée à droite dans le champ (« km/h », « m », « s »). */
  unit?: string;
  /** Affiche un compteur de caractères (nécessite maxLength). */
  showCounter?: boolean;
  /** Style du conteneur. */
  containerStyle?: ViewStyle | ViewStyle[];
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
  const borderColor = error ? palette.red : focused ? palette.gold : palette.line;
  const count = typeof value === 'string' ? value.length : 0;

  const handleFocus = (e: NativeSyntheticEvent<TextInputFocusEventData>) => {
    setFocused(true);
    onFocus?.(e);
  };
  const handleBlur = (e: NativeSyntheticEvent<TextInputFocusEventData>) => {
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
          placeholderTextColor={palette.faint}
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
  container: { marginBottom: spacing.lg },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // collé à l'input (4px) — fin du « champ orphelin sous un titre pâle »
    marginBottom: spacing.xs,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.body,
    color: palette.creamSoft,
    letterSpacing: 0.2,
  },
  optional: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.faint,
  },
  counter: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: palette.faint,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    backgroundColor: palette.card2,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  inputRowMultiline: {
    alignItems: 'stretch',
    minHeight: 96,
  },
  input: {
    flex: 1,
    color: palette.cream,
    fontFamily: fonts.body,
    fontSize: fontSize.bodyLg,
    paddingVertical: spacing.md,
  },
  inputMultiline: {
    textAlignVertical: 'top',
    paddingTop: spacing.md,
  },
  inputDisabled: { color: palette.creamMute },
  unit: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginLeft: spacing.sm,
    letterSpacing: 0.5,
  },
  helper: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: spacing.xs,
    lineHeight: fontSize.small * 1.4,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.red,
    marginTop: spacing.xs,
  },
});
