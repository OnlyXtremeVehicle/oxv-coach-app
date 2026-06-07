/**
 * Écran Coach — paramètres contextuels d'une session d'élève (§10.3).
 *
 * Le coach arrive avec {pilotId, sessionId} et renseigne le contexte que le
 * capteur ne capte pas : niveau de l'élève (sur cette séance), objectif
 * travaillé, matériel utilisé, conditions météo vécues. Ce contexte est
 * destiné à l'élève — il apparaît sur son bilan.
 *
 * Doctrine : c'est le coach (professionnel agréé) qui apporte ce contexte ;
 * OXV ne fournit que l'outil. Ton sobre, vouvoiement, aucun jugement imposé.
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
import { router, useLocalSearchParams } from 'expo-router';

import { contextHasContent } from '@/services/coachContextLogic';
import { getSessionContext, upsertSessionContext } from '@/services/coachSessionContextService';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

export default function CoachContexteScreen() {
  const params = useLocalSearchParams<{ pilotId?: string; sessionId?: string }>();
  const pilotId = params.pilotId;
  const sessionId = params.sessionId;

  const [pilotLevel, setPilotLevel] = useState('');
  const [objective, setObjective] = useState('');
  const [equipment, setEquipment] = useState('');
  const [weatherNote, setWeatherNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!sessionId) {
      setLoading(false);
      return;
    }
    getSessionContext(sessionId).then((ctx) => {
      if (cancelled) return;
      if (ctx) {
        setPilotLevel(ctx.pilotLevel ?? '');
        setObjective(ctx.objective ?? '');
        setEquipment(ctx.equipment ?? '');
        setWeatherNote(ctx.weatherNote ?? '');
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const input = { pilotLevel, objective, equipment, weatherNote };
  const hasContent = contextHasContent(input);

  async function onSave() {
    if (!pilotId || !sessionId || saving) return;
    setSaving(true);
    setSaved(false);
    const result = await upsertSessionContext(pilotId, sessionId, input);
    setSaving(false);
    if (result) {
      setSaved(true);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
          <Text style={[typography.eyebrow, { color: colors.accent.coach }]}>CONTEXTE</Text>
          <Text style={[typography.screenTitle, { marginTop: spacing.md }]}>La séance.</Text>
          <Text
            style={[typography.caption, { color: colors.text.tertiary, marginBottom: spacing.xxl }]}
          >
            Ce que le capteur ne capte pas. Visible par votre pilote sur son bilan.
          </Text>

          {loading ? (
            <Text style={[typography.caption, { paddingVertical: spacing.lg }]}>Chargement…</Text>
          ) : (
            <>
              <Field
                label="Niveau sur cette séance"
                value={pilotLevel}
                onChangeText={setPilotLevel}
                placeholder="Confortable, en progression, terrain serré…"
              />
              <Field
                label="Objectif travaillé"
                value={objective}
                onChangeText={setObjective}
                placeholder="Constance, points de référence, courbe rapide…"
              />
              <Field
                label="Matériel"
                value={equipment}
                onChangeText={setEquipment}
                placeholder="Véhicule, pneus, réglages utilisés…"
              />
              <Field
                label="Météo vécue"
                value={weatherNote}
                onChangeText={setWeatherNote}
                placeholder="Piste sèche, humide, vent, température…"
                multiline
              />

              {saved ? (
                <Text
                  style={{
                    color: colors.margin.green,
                    fontSize: fontSize.caption,
                    marginBottom: spacing.md,
                  }}
                >
                  Contexte enregistré.
                </Text>
              ) : null}

              <Pressable
                accessibilityRole="button"
                disabled={saving || !pilotId || !sessionId}
                onPress={onSave}
                style={({ pressed }) => ({
                  padding: spacing.lg,
                  borderRadius: borderRadius.md,
                  backgroundColor: colors.accent.coach,
                  alignItems: 'center',
                  opacity: saving || !pilotId || !sessionId ? 0.5 : pressed ? 0.85 : 1,
                })}
              >
                <Text
                  style={{
                    color: colors.background.primary,
                    fontSize: fontSize.body,
                    fontWeight: fontWeight.medium,
                  }}
                >
                  {saving ? 'Enregistrement…' : hasContent ? 'Enregistrer' : 'Effacer le contexte'}
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

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={[typography.eyebrow, { color: colors.text.tertiary, marginBottom: spacing.sm }]}>
        {label.toUpperCase()}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text.tertiary}
        multiline={multiline}
        maxLength={280}
        accessibilityLabel={label}
        style={{
          borderWidth: 0.5,
          borderColor: colors.border.medium,
          borderRadius: borderRadius.md,
          backgroundColor: colors.background.secondary,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          color: colors.text.primary,
          fontSize: fontSize.body,
          minHeight: multiline ? 72 : undefined,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
    </View>
  );
}
