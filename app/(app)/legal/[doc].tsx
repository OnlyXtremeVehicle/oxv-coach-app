/**
 * Viewer légal — affiche les documents juridiques embarqués (Pacte de
 * pilotage, CGU, Politique de confidentialité) pour consultation in-app à
 * tout moment (exigence RGPD : consentement éclairé + accès permanent).
 *
 * Le texte est bundlé depuis docs/juridique/ via src/legal/legalDocuments.ts
 * (re-générer avec genlegal.js à chaque mise à jour des documents).
 *
 * Rendu markdown volontairement minimal et sobre (titres, listes,
 * paragraphes) — l'emphase inline est retirée pour une lecture posée.
 */

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { LEGAL_DOCUMENTS } from '@/legal/legalDocuments';
import { colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

export default function LegalDocScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const document = doc ? LEGAL_DOCUMENTS[doc] : undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>DOCUMENT</Text>

        {document ? (
          <>
            <Text
              style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.xxl }]}
            >
              {document.title}
            </Text>
            {renderMarkdown(document.body)}
          </>
        ) : (
          <Text style={[typography.manifest, { marginTop: spacing.xxl }]}>
            Document introuvable.
          </Text>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={{ marginTop: spacing.xxxl, alignItems: 'center' }}
        >
          <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>Retour</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function renderMarkdown(body: string) {
  return body.split('\n').map((raw, i) => {
    // Retire l'emphase markdown inline (**gras**, `code`) pour une lecture sobre.
    const line = raw.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
    const t = line.trim();
    const key = `l${i}`;

    if (t === '') return <View key={key} style={{ height: spacing.sm }} />;
    if (t === '---' || t === '***' || t === '___') return <View key={key} style={styles.hr} />;
    if (t.startsWith('### '))
      return (
        <Text key={key} style={styles.h3}>
          {t.slice(4)}
        </Text>
      );
    if (t.startsWith('## '))
      return (
        <Text key={key} style={styles.h2}>
          {t.slice(3)}
        </Text>
      );
    if (t.startsWith('# '))
      return (
        <Text key={key} style={styles.h1}>
          {t.slice(2)}
        </Text>
      );
    if (t.startsWith('- ') || t.startsWith('* '))
      return (
        <Text key={key} style={[styles.para, styles.bullet]}>
          {`•  ${t.slice(2)}`}
        </Text>
      );
    if (/^>\s?/.test(t))
      return (
        <Text key={key} style={[styles.para, styles.quote]}>
          {t.replace(/^>\s?/, '')}
        </Text>
      );
    return (
      <Text key={key} style={styles.para}>
        {t}
      </Text>
    );
  });
}

const styles = StyleSheet.create({
  h1: {
    color: colors.text.primary,
    fontSize: fontSize.title,
    fontWeight: fontWeight.regular,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  h2: {
    color: colors.text.primary,
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  h3: {
    color: colors.text.secondary,
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  para: {
    color: colors.text.secondary,
    fontSize: fontSize.body,
    fontWeight: fontWeight.light,
    lineHeight: fontSize.body * 1.6,
    marginBottom: spacing.xs,
  },
  bullet: {
    paddingLeft: spacing.md,
  },
  quote: {
    fontStyle: 'italic',
    color: colors.text.tertiary,
  },
  hr: {
    height: 0.5,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing.lg,
  },
});
