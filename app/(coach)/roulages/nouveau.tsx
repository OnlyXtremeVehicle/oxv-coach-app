/**
 * Vue Coach — création d'un roulage (§8 OXV Mirror).
 *
 * Formulaire sobre : titre, date/heure, lieu, places, notes. Validation via
 * la logique pure `validateRoulageInput`. À l'enregistrement, retour à la
 * liste (le nouveau roulage apparaît, prêt à recevoir des invitations).
 *
 * Doctrine : vouvoiement, pas d'injonction, libellés factuels.
 * Reskin V2 : Screen + AppBar, SectionLabel/Button, champs au style V2.
 * Logique inchangée (états, picker date/heure, validation, création).
 */

import { useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';

import { validateRoulageInput } from '@/services/roulagesLogic';
import { createRoulage } from '@/services/roulagesService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
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
    <Screen>
      <AppBar title="NOUVEAU ROULAGE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>COACH OXV</Text>
        <Text style={s.title}>Un roulage à vous.</Text>

        <View style={{ marginTop: theme.spacing.xl }}>
          <Field label="Titre">
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Journée piste, séance privée…"
              placeholderTextColor={theme.palette.creamMute}
              style={inputStyle}
              accessibilityLabel="Titre du roulage"
            />
          </Field>

          <Field label="Date et heure">
            <Pressable accessibilityRole="button" onPress={openPicker} style={inputStyle}>
              <Text style={s.inputText}>{formatDateTime(startsAt.toISOString())}</Text>
            </Pressable>
          </Field>

          <Field label="Lieu (optionnel)">
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="Circuit de Haute Saintonge"
              placeholderTextColor={theme.palette.creamMute}
              style={inputStyle}
              accessibilityLabel="Lieu du roulage"
            />
          </Field>

          <Field label="Places (optionnel)">
            <TextInput
              value={maxPilots}
              onChangeText={setMaxPilots}
              placeholder="Sans limite"
              placeholderTextColor={theme.palette.creamMute}
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
              placeholderTextColor={theme.palette.creamMute}
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
              placeholderTextColor={theme.palette.creamMute}
              multiline
              style={[inputStyle, { minHeight: 88, textAlignVertical: 'top' }]}
              accessibilityLabel="Notes du roulage"
            />
          </Field>

          {error ? <Text style={s.error}>{error}</Text> : null}

          <Button
            label={saving ? 'Enregistrement…' : 'Enregistrer'}
            disabled={saving}
            onPress={onSubmit}
          />

          <View style={{ marginTop: theme.spacing.xxl, alignItems: 'center' }}>
            <Pressable accessibilityRole="button" onPress={() => router.back()}>
              <Text style={s.cancel}>Annuler</Text>
            </Pressable>
          </View>
        </View>

        {pickerOpen ? (
          <DateTimePicker
            value={startsAt}
            mode={Platform.OS === 'ios' ? 'datetime' : pickerMode}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onPickerChange}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const inputStyle = {
  borderWidth: 1,
  borderColor: theme.palette.line,
  borderRadius: theme.radius.md,
  backgroundColor: theme.palette.card2,
  paddingHorizontal: theme.spacing.md,
  paddingVertical: theme.spacing.md,
  color: theme.palette.cream,
  fontFamily: theme.fonts.body,
  fontSize: theme.fontSize.body,
} as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: theme.spacing.lg }}>
      <View style={{ marginBottom: theme.spacing.sm }}>
        <SectionLabel>{label}</SectionLabel>
      </View>
      {children}
    </View>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.coach,
    marginBottom: theme.spacing.md,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
  },
  inputText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  error: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.red,
    marginBottom: theme.spacing.lg,
  },
  cancel: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.micro,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
};
