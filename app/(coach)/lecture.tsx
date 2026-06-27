/**
 * Vue Coach — « Ma lecture » (§10.3c-D, version sûre).
 *
 * Le coach pondère les sous-composantes déjà calculées par OXV (véhicule,
 * pilote, régularité, fluidité). L'app en dérive « La lecture de votre
 * coach », présentée SÉPARÉMENT chez l'élève — jamais à la place de la marge
 * OXV. L'interprétation est portée par le coach, pas par OXV.
 *
 * Reskin V2 : Screen + AppBar, Card/SectionLabel/Button, typo/couleurs
 * @/theme/v2. Logique (pondérations, validation, upsert) inchangée.
 */

import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';

import { DEFAULT_READING_WEIGHTS, validateReadingWeights } from '@/services/coachReadingLogic';
import { getMyReadingWeights, upsertReadingWeights } from '@/services/coachReadingService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';

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
    <Screen scroll={false}>
      <AppBar title="LECTURE" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: theme.spacing.xxl,
          }}
        >
          <Text style={[s.eyebrow, { color: theme.palette.coach }]}>MA LECTURE</Text>
          <Text style={s.title}>Votre grille.</Text>
          <Text style={s.manifest}>
            Pondérez ce qui compte pour vous. Vos élèves verront « La lecture de votre coach », à
            côté de la marge OXV — jamais à sa place.
          </Text>

          {loading ? (
            <Text style={[s.meta, { paddingVertical: theme.spacing.lg }]}>Chargement…</Text>
          ) : (
            <>
              <View style={{ marginTop: theme.spacing.xxl }}>
                <Field
                  label="Véhicule"
                  value={vehicle}
                  onChangeText={setVehicle}
                  keyboardType="numeric"
                  maxLength={5}
                  helper="Poids relatif, 0 ou plus. Les quatre sont normalisés entre eux."
                />
                <Field
                  label="Pilote"
                  value={pilot}
                  onChangeText={setPilot}
                  keyboardType="numeric"
                  maxLength={5}
                  helper="Poids relatif, 0 ou plus."
                />
                <Field
                  label="Régularité"
                  value={regularity}
                  onChangeText={setRegularity}
                  keyboardType="numeric"
                  maxLength={5}
                  helper="Poids relatif, 0 ou plus."
                />
                <Field
                  label="Fluidité"
                  value={smoothness}
                  onChangeText={setSmoothness}
                  keyboardType="numeric"
                  maxLength={5}
                  helper="Poids relatif, 0 ou plus."
                />
              </View>

              <Field
                label="Note"
                optional
                value={note}
                onChangeText={setNote}
                placeholder="Ce que votre lecture met en avant."
                multiline
                maxLength={280}
              />

              {error ? (
                <Text style={[s.errorTxt, { marginTop: theme.spacing.md }]}>{error}</Text>
              ) : null}
              {saved ? (
                <Text style={[s.savedTxt, { marginTop: theme.spacing.md }]}>
                  Lecture enregistrée.
                </Text>
              ) : null}

              <View style={{ marginTop: theme.spacing.lg }}>
                <Button
                  label={saving ? 'Enregistrement…' : 'Enregistrer'}
                  onPress={onSave}
                  disabled={saving}
                />
              </View>
            </>
          )}

          <View style={{ marginTop: theme.spacing.xxl, alignItems: 'center' }}>
            <Pressable accessibilityRole="button" onPress={() => router.back()}>
              <Text style={s.backLink}>Retour</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.coach,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
  },
  manifest: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: theme.palette.creamSoft,
    marginTop: theme.spacing.md,
  },
  meta: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  errorTxt: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    color: theme.palette.red,
  },
  savedTxt: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    color: theme.dataColors.accel,
  },
  backLink: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
};
