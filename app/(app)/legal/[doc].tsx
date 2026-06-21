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
 * Reskin V2 : Screen + AppBar, typographie de la charte. Le texte juridique
 * et la logique de rendu markdown sont inchangés.
 */

import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { LEGAL_DOCUMENTS } from '@/legal/legalDocuments';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Screen } from '@/ui/Screen';

export default function LegalDocScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const document = doc ? LEGAL_DOCUMENTS[doc] : undefined;

  return (
    <Screen>
      <AppBar title="DOCUMENT" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        {document ? (
          <>
            <Text style={styles.screenTitle}>{document.title}</Text>
            {renderMarkdown(document.body)}
          </>
        ) : (
          <Text style={styles.manifest}>Document introuvable.</Text>
        )}
      </View>
    </Screen>
  );
}

function renderMarkdown(body: string) {
  return body.split('\n').map((raw, i) => {
    // Retire l'emphase markdown inline (**gras**, `code`) pour une lecture sobre.
    const line = raw.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
    const t = line.trim();
    const key = `l${i}`;

    if (t === '') return <View key={key} style={{ height: theme.spacing.sm }} />;
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
  screenTitle: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.2,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xxl,
  },
  manifest: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic',
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: theme.palette.creamSoft,
    marginTop: theme.spacing.xxl,
  },
  h1: {
    fontFamily: theme.fonts.display,
    color: theme.palette.cream,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.md,
  },
  h2: {
    fontFamily: theme.fonts.bodySemi,
    color: theme.palette.cream,
    fontSize: theme.fontSize.bodyLg,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  h3: {
    fontFamily: theme.fonts.bodyMedium,
    color: theme.palette.creamSoft,
    fontSize: theme.fontSize.body,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  para: {
    fontFamily: theme.fonts.bodyLight,
    color: theme.palette.creamSoft,
    fontSize: theme.fontSize.body,
    lineHeight: theme.fontSize.body * 1.6,
    marginBottom: theme.spacing.xs,
  },
  bullet: {
    paddingLeft: theme.spacing.md,
  },
  quote: {
    fontStyle: 'italic',
    color: theme.palette.creamMute,
  },
  hr: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.palette.line,
    marginVertical: theme.spacing.lg,
  },
});
