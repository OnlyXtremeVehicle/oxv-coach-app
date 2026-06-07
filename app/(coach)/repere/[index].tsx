/**
 * Vue Coach — éditeur d'un repère de virage (§10.3c-A).
 *
 * Point de freinage de référence, vitesse repère, note de trajectoire pour
 * un virage. Ces repères apparaissent chez l'élève, étiquetés « Repère de
 * votre coach ». Vocabulaire « repère », jamais « consigne » (doctrine).
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

import { getCorner } from '@/lib/circuitTopology';
import { validateCornerReference } from '@/services/coachReferenceLogic';
import { listMyCornerReferences, upsertCornerReference } from '@/services/coachReferenceService';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

export default function RepereEditorScreen() {
  const params = useLocalSearchParams<{ index?: string }>();
  const cornerIndex = Number(params.index ?? '1');
  const corner = getCorner(cornerIndex);

  const [brakingPoint, setBrakingPoint] = useState('');
  const [targetSpeed, setTargetSpeed] = useState('');
  const [trajectoryNote, setTrajectoryNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listMyCornerReferences().then((rows) => {
      if (cancelled) return;
      const existing = rows.find((r) => r.cornerIndex === cornerIndex);
      if (existing) {
        setBrakingPoint(existing.brakingPointM != null ? String(existing.brakingPointM) : '');
        setTargetSpeed(existing.targetSpeedKmh != null ? String(existing.targetSpeedKmh) : '');
        setTrajectoryNote(existing.trajectoryNote ?? '');
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [cornerIndex]);

  function parseNum(s: string): number | null {
    const t = s.trim().replace(',', '.');
    if (t === '') return null;
    const n = Number(t);
    return Number.isNaN(n) ? null : n;
  }

  async function onSave() {
    const input = {
      brakingPointM: parseNum(brakingPoint),
      targetSpeedKmh: parseNum(targetSpeed),
      trajectoryNote: trajectoryNote.trim() || null,
    };
    const validationError = validateCornerReference(input);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSaving(true);
    setSaved(false);
    const result = await upsertCornerReference(cornerIndex, input);
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
          <Text style={[typography.eyebrow, { color: colors.accent.coach }]}>
            REPÈRE · VIRAGE {String(cornerIndex).padStart(2, '0')}
          </Text>
          <Text
            style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.xxl }]}
          >
            {corner?.name ?? `Virage ${cornerIndex}`}
          </Text>

          {loading ? (
            <Text style={[typography.caption, { paddingVertical: spacing.lg }]}>Chargement…</Text>
          ) : (
            <>
              <Field
                label="Point de freinage repère (m)"
                value={brakingPoint}
                onChangeText={setBrakingPoint}
                placeholder="ex. 110"
                keyboardType="decimal-pad"
              />
              <Field
                label="Vitesse repère (km/h)"
                value={targetSpeed}
                onChangeText={setTargetSpeed}
                placeholder="ex. 90"
                keyboardType="decimal-pad"
              />
              <Field
                label="Trajectoire"
                value={trajectoryNote}
                onChangeText={setTrajectoryNote}
                placeholder="Corde tardive, large à la sortie…"
                multiline
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
                  Repère enregistré.
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

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  keyboardType?: 'decimal-pad';
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
        keyboardType={keyboardType}
        multiline={multiline}
        maxLength={multiline ? 280 : 12}
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
