/**
 * Vue Coach — éditeur d'un repère de virage (§10.3c-A).
 *
 * Point de freinage de référence, vitesse repère, note de trajectoire pour
 * un virage. Ces repères apparaissent chez l'élève, étiquetés « Repère de
 * votre coach ». Vocabulaire « repère », jamais « consigne » (doctrine).
 *
 * Reskin V2 : Screen + AppBar, SectionLabel/Button, typo/couleurs
 * @/theme/v2. Logique (chargement, validation, upsert) inchangée.
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
import { router, useLocalSearchParams } from 'expo-router';

import { getCorner } from '@/lib/circuitTopology';
import { validateCornerReference } from '@/services/coachReferenceLogic';
import { listMyCornerReferences, upsertCornerReference } from '@/services/coachReferenceService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

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
    <Screen scroll={false}>
      <AppBar
        title="REPÈRE"
        subtitle={`VIRAGE ${String(cornerIndex).padStart(2, '0')}`}
        onBack={() => router.back()}
      />
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
          <Text style={[s.eyebrow, { color: theme.palette.coach }]}>
            REPÈRE · VIRAGE {String(cornerIndex).padStart(2, '0')}
          </Text>
          <Text style={s.title}>{corner?.name ?? `Virage ${cornerIndex}`}</Text>

          {loading ? (
            <Text style={[s.meta, { paddingVertical: theme.spacing.lg }]}>Chargement…</Text>
          ) : (
            <View style={{ marginTop: theme.spacing.xxl }}>
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
                <Text style={[s.errorTxt, { marginBottom: theme.spacing.md }]}>{error}</Text>
              ) : null}
              {saved ? (
                <Text style={[s.savedTxt, { marginBottom: theme.spacing.md }]}>
                  Repère enregistré.
                </Text>
              ) : null}

              <Button
                label={saving ? 'Enregistrement…' : 'Enregistrer'}
                onPress={onSave}
                disabled={saving}
              />
            </View>
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
    <View style={{ marginBottom: theme.spacing.lg }}>
      <View style={{ marginBottom: theme.spacing.sm }}>
        <SectionLabel>{label.toUpperCase()}</SectionLabel>
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.palette.creamMute}
        keyboardType={keyboardType}
        multiline={multiline}
        maxLength={multiline ? 280 : 12}
        accessibilityLabel={label}
        style={[
          s.input,
          multiline
            ? { minHeight: 72, textAlignVertical: 'top' as const }
            : { textAlignVertical: 'center' as const },
        ]}
      />
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
  meta: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  input: {
    backgroundColor: theme.palette.card2,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    color: theme.palette.cream,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
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
