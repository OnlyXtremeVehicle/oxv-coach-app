/**
 * Messages — fil coach↔pilote (onglet Messages, cadrage COACH §1).
 *
 * Placeholder honnête : la messagerie temps réel (attribuée, sans coordonnées)
 * est une pièce à construire (PR live). L'onglet existe pour poser la nav ; on
 * n'invente pas un fil vide en le faisant passer pour fonctionnel.
 */

import { Text, View } from 'react-native';
import { router } from 'expo-router';

import { EmptyState } from '@/components/instruments';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Screen } from '@/ui/Screen';

const { palette, spacing, fonts, fontSize } = theme;

export default function MessagesScreen() {
  return (
    <Screen>
      <AppBar title="MESSAGES" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        <Text
          style={{
            fontFamily: fonts.mono,
            fontSize: fontSize.eyebrow,
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: palette.coachAlert,
            marginTop: spacing.sm,
          }}
        >
          MESSAGERIE
        </Text>
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: fontSize.h2,
            letterSpacing: 0.5,
            color: palette.cream,
            marginTop: spacing.md,
            marginBottom: spacing.lg,
          }}
          accessibilityRole="header"
        >
          Le fil avec vos pilotes.
        </Text>
        <EmptyState
          label="Bientôt"
          message="La messagerie attribuée (sans coordonnées) arrive avec le direct. Vos échanges resteront dans l'app, jamais un numéro qui fuite."
        />
      </View>
    </Screen>
  );
}
