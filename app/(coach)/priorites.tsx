/**
 * Vue Coach — priorisation du bilan d'un pilote (§10.3c-B).
 *
 * Le coach choisit les virages à mettre en avant pour CE pilote (ordre de
 * lecture) et une note d'intro. Sur le bilan du pilote, cela apparaît sous
 * « Mis en avant par votre coach ». Aucune injonction : un ordre de lecture
 * proposé et attribué.
 *
 * Reskin V2 : Screen + AppBar, Card/SectionLabel/Button, pills de virage,
 * typo/couleurs @/theme/v2. Logique (sélection, note, upsert) inchangée.
 */

import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { BELTOISE_CORNERS } from '@/lib/circuitTopology';
import { toggleCornerIndex } from '@/services/coachCurationLogic';
import { getMyHighlightForPilot, upsertHighlight } from '@/services/coachCurationService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

export default function CoachPrioritesScreen() {
  const params = useLocalSearchParams<{ pilotId?: string }>();
  const pilotId = params.pilotId;

  const [selected, setSelected] = useState<number[]>([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!pilotId) {
      setLoading(false);
      return;
    }
    getMyHighlightForPilot(pilotId).then((h) => {
      if (cancelled) return;
      if (h) {
        setSelected(h.highlightCornerIndexes);
        setNote(h.note ?? '');
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [pilotId]);

  async function onSave() {
    if (!pilotId || saving) return;
    setSaving(true);
    setSaved(false);
    const result = await upsertHighlight(pilotId, {
      highlightCornerIndexes: selected,
      note: note.trim() || null,
    });
    setSaving(false);
    if (result) setSaved(true);
  }

  return (
    <Screen scroll={false}>
      <AppBar title="PRIORITÉS" onBack={() => router.back()} />
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
          <Text style={[s.eyebrow, { color: theme.palette.coach }]}>PRIORITÉS</Text>
          <Text style={s.title}>Le bilan, à votre main.</Text>
          <Text style={s.manifest}>
            Mettez en avant les virages à regarder en premier. Un ordre de lecture, pas une
            consigne.
          </Text>

          {loading ? (
            <Text style={[s.meta, { paddingVertical: theme.spacing.lg }]}>Chargement…</Text>
          ) : (
            <>
              <View style={{ marginTop: theme.spacing.xxl, marginBottom: theme.spacing.md }}>
                <SectionLabel>VIRAGES MIS EN AVANT</SectionLabel>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                {BELTOISE_CORNERS.map((corner) => {
                  const order = selected.indexOf(corner.index);
                  const active = order >= 0;
                  return (
                    <Pressable
                      key={corner.index}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`Virage ${corner.index}, ${corner.name}`}
                      onPress={() => setSelected((prev) => toggleCornerIndex(prev, corner.index))}
                      style={({ pressed }) => [
                        s.pill,
                        active && s.pillOn,
                        { opacity: pressed ? 0.8 : 1 },
                      ]}
                    >
                      <Text style={[s.pillT, active && s.pillTOn]}>
                        {active ? `${order + 1}. ` : ''}
                        {corner.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={{ marginTop: theme.spacing.xxl }}>
                <Field
                  label="Note d'introduction"
                  optional
                  value={note}
                  onChangeText={setNote}
                  placeholder="Un mot pour orienter la lecture du bilan."
                  multiline
                  maxLength={280}
                />
              </View>

              {saved ? (
                <Text style={[s.savedTxt, { marginTop: theme.spacing.md }]}>
                  Priorités enregistrées.
                </Text>
              ) : null}

              <View style={{ marginTop: theme.spacing.lg }}>
                <Button
                  label={saving ? 'Enregistrement…' : 'Enregistrer'}
                  onPress={onSave}
                  disabled={saving || !pilotId}
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
  pill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: theme.palette.card2,
    borderColor: theme.palette.line,
    borderWidth: 1,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  pillOn: { backgroundColor: 'rgba(255,255,255,0.07)', borderColor: theme.palette.coach },
  pillT: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    color: theme.palette.creamMute,
  },
  pillTOn: { color: theme.palette.cream },
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
