/**
 * Vue Coach — gabarits de commentaire (§10.3c-C).
 *
 * Modèles de texte réutilisables pour accélérer la saisie des annotations.
 * Confort de saisie côté coach ; les annotations restent cadrées par la
 * doctrine au moment où elles sont écrites.
 *
 * Reskin V2 : Screen + AppBar, Card/SectionLabel/Button, typo/couleurs
 * @/theme/v2. Logique (templates, validation, CRUD) inchangée.
 */

import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { type CoachAnnotationTemplate, validateTemplate } from '@/services/coachCurationLogic';
import { createTemplate, deleteTemplate, listMyTemplates } from '@/services/coachCurationService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

export default function CoachGabaritsScreen() {
  const [templates, setTemplates] = useState<CoachAnnotationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [label, setLabel] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const rows = await listMyTemplates();
      setTemplates(rows);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
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

  const listState: ScreenState = loading
    ? 'loading'
    : loadError
      ? 'error'
      : templates.length === 0
        ? 'empty'
        : 'nominal';

  return (
    <Screen scroll={false}>
      <AppBar title="GABARITS" onBack={() => router.back()} />
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
          <View style={{ marginBottom: theme.spacing.md }}>
            <RoleBadge role="coach" />
          </View>
          <Text style={[s.eyebrow, { color: theme.palette.coach }]}>GABARITS</Text>
          <Text style={s.title}>Vos formules.</Text>
          <Text style={s.manifest}>
            Des modèles réutilisables pour annoter plus vite. Vous gardez la main sur chaque mot.
          </Text>

          {/* Liste existante */}
          <View style={{ marginTop: theme.spacing.xxl }}>
            <StateWrapper
              state={listState}
              skeletonLines={5}
              emptyMessage="Aucun gabarit pour l'instant."
              errorCause="La liste des gabarits n'a pas pu être chargée."
              onRetry={reload}
            >
              <View style={{ gap: theme.spacing.sm }}>
                {templates.map((t) => (
                  <Card key={t.id}>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={[s.tplLabel, { flex: 1 }]}>{t.label}</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Supprimer le gabarit ${t.label}`}
                        onPress={() => onDelete(t.id)}
                      >
                        <Text style={s.deleteTxt}>Supprimer</Text>
                      </Pressable>
                    </View>
                    <Text style={s.tplBody}>{t.body}</Text>
                  </Card>
                ))}
              </View>
            </StateWrapper>
          </View>

          {/* Nouveau gabarit */}
          <View style={{ marginTop: theme.spacing.xxl, marginBottom: theme.spacing.md }}>
            <SectionLabel>NOUVEAU GABARIT</SectionLabel>
          </View>
          <Field
            label="Nom du gabarit"
            value={label}
            onChangeText={setLabel}
            placeholder="Sortie de virage"
            maxLength={60}
          />
          <Field
            label="Texte du gabarit"
            value={body}
            onChangeText={setBody}
            placeholder="Le texte du gabarit, sobre et descriptif."
            multiline
            maxLength={1000}
            showCounter
          />

          {error ? <Text style={s.errorTxt}>{error}</Text> : null}

          <View style={{ marginTop: theme.spacing.lg }}>
            <Button
              label={saving ? 'Ajout…' : 'Ajouter le gabarit'}
              onPress={onCreate}
              disabled={saving}
            />
          </View>

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
  tplLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  tplBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamSoft,
    marginTop: theme.spacing.xs,
    lineHeight: theme.fontSize.small * 1.5,
  },
  deleteTxt: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: theme.palette.red,
  },
  errorTxt: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    color: theme.palette.red,
    marginTop: theme.spacing.md,
  },
  backLink: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
};
