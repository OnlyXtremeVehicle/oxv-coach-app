/**
 * Vue Coach — création d'un roulage (§8 OXV Mirror).
 *
 * Formulaire sobre : titre, date/heure, lieu, places, notes. Validation via
 * la logique pure `validateRoulageInput`. À l'enregistrement, retour à la
 * liste (le nouveau roulage apparaît, prêt à recevoir des invitations).
 *
 * Doctrine : vouvoiement, pas d'injonction, libellés factuels.
 */

import { useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';

import { validateRoulageInput } from '@/services/roulagesLogic';
import { createRoulage } from '@/services/roulagesService';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';
import { formatDateTime } from '@/utils/format';

function defaultStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(9, 0, 0, 0);
  return d;
}

export default function NouveauRoulageScreen() {
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState<Date>(defaultStart);
  const [location, setLocation] = useState('');
  const [maxPilots, setMaxPilots] = useState('');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openPicker() {
    setPickerMode('date');
    setPickerOpen(true);
  }

  function onPickerChange(event: { type: string }, selected?: Date) {
    // Android : annulation explicite.
    if (event.type === 'dismissed') {
      setPickerOpen(false);
      return;
    }
    if (!selected) {
      setPickerOpen(false);
      return;
    }
    if (Platform.OS === 'android' && pickerMode === 'date') {
      // Conserver la date, enchaîner sur l'heure.
      const merged = new Date(startsAt);
      merged.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      setStartsAt(merged);
      setPickerMode('time');
      return;
    }
    if (Platform.OS === 'android' && pickerMode === 'time') {
      const merged = new Date(startsAt);
      merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      setStartsAt(merged);
      setPickerOpen(false);
      return;
    }
    // iOS : mode datetime unique.
    setStartsAt(selected);
  }

  async function onSubmit() {
    const parsedMax = maxPilots.trim() === '' ? null : Number(maxPilots.trim());
    // Prix saisi en euros (virgule ou point) → centimes entiers.
    const priceTrimmed = price.trim().replace(',', '.');
    const parsedPrice = priceTrimmed === '' ? null : Math.round(Number(priceTrimmed) * 100);
    const input = {
      title,
      startsAt: startsAt.toISOString(),
      location: location.trim() || null,
      maxPilots: parsedMax,
      pricePerPilot: Number.isNaN(parsedPrice as number) ? null : parsedPrice,
      notes: notes.trim() || null,
    };

    const validationError = validateRoulageInput(input, new Date().toISOString());
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSaving(true);
    const created = await createRoulage(input);
    setSaving(false);

    if (!created) {
      setError("L'enregistrement a échoué. Réessayez dans un instant.");
      return;
    }
    router.replace('/(coach)/roulages' as never);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.accent.coach }]}>NOUVEAU ROULAGE</Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.xl }]}>
          Un roulage à vous.
        </Text>

        <Field label="Titre">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Journée piste, séance privée…"
            placeholderTextColor={colors.text.tertiary}
            style={inputStyle}
            accessibilityLabel="Titre du roulage"
          />
        </Field>

        <Field label="Date et heure">
          <Pressable accessibilityRole="button" onPress={openPicker} style={inputStyle}>
            <Text style={{ color: colors.text.primary, fontSize: fontSize.body }}>
              {formatDateTime(startsAt.toISOString())}
            </Text>
          </Pressable>
        </Field>

        <Field label="Lieu (optionnel)">
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="Circuit de Haute Saintonge"
            placeholderTextColor={colors.text.tertiary}
            style={inputStyle}
            accessibilityLabel="Lieu du roulage"
          />
        </Field>

        <Field label="Places (optionnel)">
          <TextInput
            value={maxPilots}
            onChangeText={setMaxPilots}
            placeholder="Sans limite"
            placeholderTextColor={colors.text.tertiary}
            keyboardType="number-pad"
            style={inputStyle}
            accessibilityLabel="Nombre de places"
          />
        </Field>

        <Field label="Prix par place en euros (optionnel)">
          <TextInput
            value={price}
            onChangeText={setPrice}
            placeholder="Gratuit"
            placeholderTextColor={colors.text.tertiary}
            keyboardType="decimal-pad"
            style={inputStyle}
            accessibilityLabel="Prix par place en euros"
          />
        </Field>

        <Field label="Notes (optionnel)">
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Informations pratiques pour vos pilotes."
            placeholderTextColor={colors.text.tertiary}
            multiline
            style={[inputStyle, { minHeight: 88, textAlignVertical: 'top' }]}
            accessibilityLabel="Notes du roulage"
          />
        </Field>

        {error ? (
          <Text
            style={{
              color: colors.accent.red,
              fontSize: fontSize.caption,
              marginBottom: spacing.lg,
            }}
          >
            {error}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={onSubmit}
          style={({ pressed }) => ({
            padding: spacing.lg,
            borderRadius: borderRadius.md,
            backgroundColor: colors.accent.coach,
            alignItems: 'center',
            opacity: saving ? 0.5 : pressed ? 0.85 : 1,
          })}
        >
          <Text
            style={{
              color: colors.background.primary,
              fontSize: fontSize.body,
              fontWeight: fontWeight.medium,
            }}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Text>
        </Pressable>

        <View style={{ marginTop: spacing.xxl, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>Annuler</Text>
          </Pressable>
        </View>

        {pickerOpen ? (
          <DateTimePicker
            value={startsAt}
            mode={Platform.OS === 'ios' ? 'datetime' : pickerMode}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onPickerChange}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const inputStyle = {
  borderWidth: 0.5,
  borderColor: colors.border.medium,
  borderRadius: borderRadius.md,
  backgroundColor: colors.background.secondary,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.md,
  color: colors.text.primary,
  fontSize: fontSize.body,
} as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={[typography.eyebrow, { color: colors.text.tertiary, marginBottom: spacing.sm }]}>
        {label.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}
