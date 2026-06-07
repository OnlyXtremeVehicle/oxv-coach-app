/**
 * Vue Coach — « Ma lecture » (§10.3c-D, version sûre).
 *
 * Le coach pondère les sous-composantes déjà calculées par OXV (véhicule,
 * pilote, régularité, fluidité). L'app en dérive « La lecture de votre
 * coach », présentée SÉPARÉMENT chez l'élève — jamais à la place de la marge
 * OXV. L'interprétation est portée par le coach, pas par OXV.
 */

import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { DEFAULT_READING_WEIGHTS, validateReadingWeights } from '@/services/coachReadingLogic';
import { getMyReadingWeights, upsertReadingWeights } from '@/services/coachReadingService';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

export default function CoachLectureScreen() {
  const [vehicle, setVehicle] = useState(String(DEFAULT_READING_WEIGHTS.wVehicle));
  const [pilot, setPilot] = useState(String(DEFAULT_READING_WEIGHTS.wPilot));
  const [regularity, setRegularity] = useState(String(DEFAULT_READING_WEIGHTS.wRegularity));
  const [smoothness, setSmoothness] = useState(String(DEFAULT_READING_WEIGHTS.wSmoothness));
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMyReadingWeights().then((w) => {
      if (cancelled) return;
      if (w) {
        setVehicle(String(w.wVehicle));
        setPilot(String(w.wPilot));
        setRegularity(String(w.wRegularity));
        setSmoothness(String(w.wSmoothness));
        setNote(w.note ?? '');
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function parseW(s: string): number {
    const n = Number(s.trim().replace(',', '.'));
    return Number.isNaN(n) ? -1 : n;
  }

  async function onSave() {
    const input = {
      wVehicle: parseW(vehicle),
      wPilot: parseW(pilot),
      wRegularity: parseW(regularity),
      wSmoothness: parseW(smoothness),
      note: note.trim() || null,
    };
    const validationError = validateReadingWeights(input);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSaving(true);
    setSaved(false);
    const result = await upsertReadingWeights(input);
    setSaving(false);
    if (result) setSaved(true);
    else setError("L'enregistrement a échoué. Réessayez dans un instant.");
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
          <Text style={[typography.eyebrow, { color: colors.accent.coach }]}>MA LECTURE</Text>
          <Text style={[typography.screenTitle, { marginTop: spacing.md }]}>Votre grille.</Text>
          <Text
            style={[typography.caption, { color: colors.text.tertiary, marginBottom: spacing.xxl }]}
          >
            Pondérez ce qui compte pour vous. Vos élèves verront « La lecture de votre coach », à
            côté de la marge OXV — jamais à sa place.
          </Text>

          {loading ? (
            <Text style={[typography.caption, { paddingVertical: spacing.lg }]}>Chargement…</Text>
          ) : (
            <>
              <WeightField label="Véhicule" value={vehicle} onChangeText={setVehicle} />
              <WeightField label="Pilote" value={pilot} onChangeText={setPilot} />
              <WeightField label="Régularité" value={regularity} onChangeText={setRegularity} />
              <WeightField label="Fluidité" value={smoothness} onChangeText={setSmoothness} />

              <Text
                style={[
                  typography.eyebrow,
                  { color: colors.text.tertiary, marginTop: spacing.md, marginBottom: spacing.sm },
                ]}
              >
                NOTE (OPTIONNEL)
              </Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Ce que votre lecture met en avant."
                placeholderTextColor={colors.text.tertiary}
                multiline
                maxLength={280}
                accessibilityLabel="Note de lecture"
                style={{
                  borderWidth: 0.5,
                  borderColor: colors.border.medium,
                  borderRadius: borderRadius.md,
                  backgroundColor: colors.background.secondary,
                  padding: spacing.md,
                  color: colors.text.primary,
                  fontSize: fontSize.body,
                  minHeight: 72,
                  textAlignVertical: 'top',
                  marginBottom: spacing.lg,
                }}
              />

              {error ? (
                <Text
                  style={{
                    color: colors.accent.red,
                    fontSize: fontSize.caption,
                    marginBottom: spacing.md,
                  }}
                >
                  {error}
                </Text>
              ) : null}
              {saved ? (
                <Text
                  style={{
                    color: colors.margin.green,
                    fontSize: fontSize.caption,
                    marginBottom: spacing.md,
                  }}
                >
                  Lecture enregistrée.
                </Text>
              ) : null}

              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={onSave}
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
            </>
          )}

          <View style={{ marginTop: spacing.xxl, alignItems: 'center' }}>
            <Pressable accessibilityRole="button" onPress={() => router.back()}>
              <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>
                Retour
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function WeightField({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
      }}
    >
      <Text style={{ color: colors.text.primary, fontSize: fontSize.body }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        maxLength={5}
        accessibilityLabel={`Pondération ${label}`}
        style={{
          width: 88,
          borderWidth: 0.5,
          borderColor: colors.border.medium,
          borderRadius: borderRadius.md,
          backgroundColor: colors.background.secondary,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          color: colors.text.primary,
          fontSize: fontSize.body,
          textAlign: 'right',
          fontFamily: 'Menlo',
        }}
      />
    </View>
  );
}
