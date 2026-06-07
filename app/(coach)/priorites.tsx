/**
 * Vue Coach — priorisation du bilan d'un pilote (§10.3c-B).
 *
 * Le coach choisit les virages à mettre en avant pour CE pilote (ordre de
 * lecture) et une note d'intro. Sur le bilan du pilote, cela apparaît sous
 * « Mis en avant par votre coach ». Aucune injonction : un ordre de lecture
 * proposé et attribué.
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

import { BELTOISE_CORNERS } from '@/lib/circuitTopology';
import { toggleCornerIndex } from '@/services/coachCurationLogic';
import { getMyHighlightForPilot, upsertHighlight } from '@/services/coachCurationService';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
          <Text style={[typography.eyebrow, { color: colors.accent.coach }]}>PRIORITÉS</Text>
          <Text style={[typography.screenTitle, { marginTop: spacing.md }]}>
            Le bilan, à votre main.
          </Text>
          <Text
            style={[typography.caption, { color: colors.text.tertiary, marginBottom: spacing.xxl }]}
          >
            Mettez en avant les virages à regarder en premier. Un ordre de lecture, pas une
            consigne.
          </Text>

          {loading ? (
            <Text style={[typography.caption, { paddingVertical: spacing.lg }]}>Chargement…</Text>
          ) : (
            <>
              <Text
                style={[
                  typography.eyebrow,
                  { color: colors.text.tertiary, marginBottom: spacing.md },
                ]}
              >
                VIRAGES MIS EN AVANT
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
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
                      style={({ pressed }) => ({
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        borderRadius: borderRadius.md,
                        borderWidth: active ? 1 : 0.5,
                        borderColor: active ? colors.accent.coach : colors.border.subtle,
                        backgroundColor: active
                          ? colors.background.elevated
                          : colors.background.secondary,
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <Text
                        style={{
                          color: active ? colors.text.primary : colors.text.secondary,
                          fontSize: fontSize.caption,
                          fontWeight: active ? fontWeight.medium : fontWeight.regular,
                        }}
                      >
                        {active ? `${order + 1}. ` : ''}
                        {corner.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text
                style={[
                  typography.eyebrow,
                  { color: colors.text.tertiary, marginTop: spacing.xxl, marginBottom: spacing.sm },
                ]}
              >
                NOTE D&apos;INTRODUCTION (OPTIONNEL)
              </Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Un mot pour orienter la lecture du bilan."
                placeholderTextColor={colors.text.tertiary}
                multiline
                maxLength={280}
                accessibilityLabel="Note d'introduction"
                style={{
                  borderWidth: 0.5,
                  borderColor: colors.border.medium,
                  borderRadius: borderRadius.md,
                  backgroundColor: colors.background.secondary,
                  padding: spacing.md,
                  color: colors.text.primary,
                  fontSize: fontSize.body,
                  minHeight: 88,
                  textAlignVertical: 'top',
                  marginBottom: spacing.lg,
                }}
              />

              {saved ? (
                <Text
                  style={{
                    color: colors.margin.green,
                    fontSize: fontSize.caption,
                    marginBottom: spacing.md,
                  }}
                >
                  Priorités enregistrées.
                </Text>
              ) : null}

              <Pressable
                accessibilityRole="button"
                disabled={saving || !pilotId}
                onPress={onSave}
                style={({ pressed }) => ({
                  padding: spacing.lg,
                  borderRadius: borderRadius.md,
                  backgroundColor: colors.accent.coach,
                  alignItems: 'center',
                  opacity: saving || !pilotId ? 0.5 : pressed ? 0.85 : 1,
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
