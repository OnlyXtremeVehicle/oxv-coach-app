/**
 * Vue Coach — gabarits de commentaire (§10.3c-C).
 *
 * Modèles de texte réutilisables pour accélérer la saisie des annotations.
 * Confort de saisie côté coach ; les annotations restent cadrées par la
 * doctrine au moment où elles sont écrites.
 */

import { useCallback, useState } from 'react';
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
import { router, useFocusEffect } from 'expo-router';

import { type CoachAnnotationTemplate, validateTemplate } from '@/services/coachCurationLogic';
import { createTemplate, deleteTemplate, listMyTemplates } from '@/services/coachCurationService';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

export default function CoachGabaritsScreen() {
  const [templates, setTemplates] = useState<CoachAnnotationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    const rows = await listMyTemplates();
    setTemplates(rows);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      reload().catch(() => {
        if (!cancelled) setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [reload])
  );

  async function onCreate() {
    const input = { label, body };
    const validationError = validateTemplate(input);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSaving(true);
    const result = await createTemplate(input);
    setSaving(false);
    if (result) {
      setLabel('');
      setBody('');
      await reload();
    }
  }

  async function onDelete(id: string) {
    await deleteTemplate(id);
    await reload();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
          <Text style={[typography.eyebrow, { color: colors.accent.coach }]}>GABARITS</Text>
          <Text style={[typography.screenTitle, { marginTop: spacing.md }]}>Vos formules.</Text>
          <Text
            style={[typography.caption, { color: colors.text.tertiary, marginBottom: spacing.xxl }]}
          >
            Des modèles réutilisables pour annoter plus vite. Vous gardez la main sur chaque mot.
          </Text>

          {/* Liste existante */}
          {loading ? (
            <Text style={[typography.caption, { paddingVertical: spacing.lg }]}>Chargement…</Text>
          ) : templates.length === 0 ? (
            <Text
              style={[
                typography.caption,
                { color: colors.text.tertiary, marginBottom: spacing.xl },
              ]}
            >
              Aucun gabarit pour l&apos;instant.
            </Text>
          ) : (
            <View style={{ gap: spacing.sm, marginBottom: spacing.xxl }}>
              {templates.map((t) => (
                <View
                  key={t.id}
                  style={{
                    padding: spacing.md,
                    borderRadius: borderRadius.md,
                    borderWidth: 0.5,
                    borderColor: colors.border.subtle,
                    backgroundColor: colors.background.secondary,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: colors.text.primary,
                        fontSize: fontSize.body,
                        fontWeight: fontWeight.medium,
                        flex: 1,
                      }}
                    >
                      {t.label}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Supprimer le gabarit ${t.label}`}
                      onPress={() => onDelete(t.id)}
                    >
                      <Text style={{ color: colors.accent.red, fontSize: fontSize.caption }}>
                        Supprimer
                      </Text>
                    </Pressable>
                  </View>
                  <Text
                    style={{
                      color: colors.text.secondary,
                      fontSize: fontSize.caption,
                      marginTop: spacing.xs,
                      lineHeight: fontSize.caption * 1.5,
                    }}
                  >
                    {t.body}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Nouveau gabarit */}
          <Text
            style={[typography.eyebrow, { color: colors.accent.coach, marginBottom: spacing.md }]}
          >
            NOUVEAU GABARIT
          </Text>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="Nom (ex. Sortie de virage)"
            placeholderTextColor={colors.text.tertiary}
            maxLength={60}
            accessibilityLabel="Nom du gabarit"
            style={inputStyle}
          />
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Le texte du gabarit, sobre et descriptif."
            placeholderTextColor={colors.text.tertiary}
            multiline
            maxLength={1000}
            accessibilityLabel="Texte du gabarit"
            style={[inputStyle, { minHeight: 96, textAlignVertical: 'top', marginTop: spacing.md }]}
          />

          {error ? (
            <Text
              style={{
                color: colors.accent.red,
                fontSize: fontSize.caption,
                marginTop: spacing.md,
              }}
            >
              {error}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={onCreate}
            style={({ pressed }) => ({
              marginTop: spacing.lg,
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
              {saving ? 'Ajout…' : 'Ajouter le gabarit'}
            </Text>
          </Pressable>

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
