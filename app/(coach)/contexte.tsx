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
 *
 * Reskin V2 : Screen + AppBar, SectionLabel/Button du kit. Logique inchangée.
 */

import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { contextHasContent } from '@/services/coachContextLogic';
import { getSessionContext, upsertSessionContext } from '@/services/coachSessionContextService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

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
    <Screen>
      <AppBar title="CONTEXTE" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
          <Text style={s.title}>La séance.</Text>
          <Text style={s.subtitle}>
            Ce que le capteur ne capte pas. Visible par votre pilote sur son bilan.
          </Text>

          {loading ? (
            <Text style={s.caption}>Chargement…</Text>
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

              {saved ? <Text style={s.savedNote}>Contexte enregistré.</Text> : null}

              <Button
                label={
                  saving ? 'Enregistrement…' : hasContent ? 'Enregistrer' : 'Effacer le contexte'
                }
                onPress={onSave}
                disabled={saving || !pilotId || !sessionId}
              />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
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
    <View style={{ marginBottom: theme.spacing.lg }}>
      <View style={{ marginBottom: theme.spacing.sm }}>
        <SectionLabel>{label.toUpperCase()}</SectionLabel>
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.palette.creamMute}
        multiline={multiline}
        maxLength={280}
        accessibilityLabel={label}
        style={[s.input, multiline ? s.inputMultiline : null]}
      />
    </View>
  );
}

const s = {
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    marginTop: theme.spacing.sm,
  },
  subtitle: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xxl,
    lineHeight: theme.fontSize.small * 1.5,
  },
  caption: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    paddingVertical: theme.spacing.lg,
  },
  savedNote: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: theme.dataColors.accel,
    marginBottom: theme.spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.palette.line,
    borderRadius: theme.radius.md,
    backgroundColor: theme.palette.card2,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    color: theme.palette.cream,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    textAlignVertical: 'center' as const,
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top' as const,
  },
};
