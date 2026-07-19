/**
 * LECTEUR LÉGAL — sous-écran de VOUS/Documents (lot V2-L4). Route
 * `vous/document/[doc]`. Affiche un document juridique bundlé (Pacte de
 * pilotage · CGU · Politique de confidentialité) pour consultation in-app à
 * tout moment (exigence RGPD : accès permanent).
 *
 * Texte bundlé depuis src/legal/legalDocuments.ts (inchangé). Rendu markdown
 * minimal habillé v2 — corps 15, interligne 1.65 (« le juridique aussi se lit
 * bien »). Emphase inline retirée pour une lecture posée.
 */

import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { LEGAL_DOCUMENTS } from '@/legal/legalDocuments';
import { colors, PressScale, space, StateView, typo, useDoorTransition } from '@/ui/v2';

export default function LegalDocScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const document = doc ? LEGAL_DOCUMENTS[doc] : undefined;

  return (
    <Animated.View style={[styles.root, door]}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <PressScale
          onPress={() => router.back()}
          accessibilityLabel="Retour"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <BackGlyph />
        </PressScale>
        <Text style={styles.headerTitle}>DOCUMENT</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: space.xl,
          paddingTop: space.md,
          paddingBottom: insets.bottom + space.xxl,
        }}
      >
        {document ? (
          <>
            <Text style={styles.title} accessibilityRole="header">
              {document.title}
            </Text>
            {renderMarkdown(document.body)}
          </>
        ) : (
          <StateView state="empty" emptyMessage="Document introuvable." style={styles.empty} />
        )}
      </Animated.ScrollView>
    </Animated.View>
  );
}

/** Rendu markdown sobre habillé v2 (titres, listes, paragraphes, citations). */
function renderMarkdown(body: string) {
  return body.split('\n').map((raw, i) => {
    const line = raw.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
    const t = line.trim();
    const key = `l${i}`;
    if (t === '') return <View key={key} style={styles.gap} />;
    if (t === '---' || t === '***' || t === '___') return <View key={key} style={styles.hr} />;
    if (t.startsWith('### '))
      return (
        <Text key={key} accessibilityRole="header" style={styles.h3}>
          {t.slice(4)}
        </Text>
      );
    if (t.startsWith('## '))
      return (
        <Text key={key} accessibilityRole="header" style={styles.h2}>
          {t.slice(3)}
        </Text>
      );
    if (t.startsWith('# '))
      return (
        <Text key={key} accessibilityRole="header" style={styles.h1}>
          {t.slice(2)}
        </Text>
      );
    if (/^\d+\.\s/.test(t))
      return (
        <Text key={key} style={[styles.para, styles.bullet]}>
          {t}
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

function BackGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        d="M15 5 L8.5 12 L15 19"
        stroke={colors.text.hi}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingBottom: space.sm,
  },
  headerTitle: {
    fontFamily: typo.display,
    fontSize: 16,
    letterSpacing: 2,
    color: colors.text.hi,
  },
  headerSpacer: { width: 20 },
  empty: { marginTop: space.xxl },

  title: {
    fontFamily: typo.display,
    fontSize: 22,
    letterSpacing: 0.5,
    lineHeight: 30,
    color: colors.text.hi,
    marginTop: space.sm,
    marginBottom: space.xl,
  },
  gap: { height: space.sm },
  hr: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.hairline,
    marginVertical: space.lg,
  },
  h1: {
    fontFamily: typo.display,
    fontSize: 18,
    letterSpacing: 0.3,
    color: colors.text.hi,
    marginTop: space.xl,
    marginBottom: space.md,
  },
  h2: {
    fontFamily: typo.bodySemi,
    fontSize: 16,
    color: colors.text.hi,
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  h3: {
    fontFamily: typo.bodyMedium,
    fontSize: 15,
    color: colors.text.mid,
    marginTop: space.md,
    marginBottom: space.xs,
  },
  para: {
    fontFamily: typo.body,
    fontSize: 15,
    lineHeight: 15 * 1.65,
    color: colors.text.mid,
    marginBottom: space.xs,
  },
  bullet: { paddingLeft: space.md },
  quote: { fontStyle: 'italic', color: colors.text.low },
});
