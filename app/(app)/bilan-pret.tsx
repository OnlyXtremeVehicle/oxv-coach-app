/**
 * Écran #12 — Votre bilan est prêt.
 *
 * Annonce que le bilan est disponible. Doctrine essentielle : on ne
 * force pas la consultation. Deux options strictement équivalentes en
 * poids visuel — `Découvrir` (primaire) et `Plus tard` (secondaire).
 *
 * Reskin V2 : Screen (scroll={false}) + typo/couleurs @/theme/v2. Logique
 * inchangée (navigation, haptique, deux CTA équivalents).
 */

import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { confirm as hapticConfirm } from '@/lib/haptics';
import { theme } from '@/theme/v2';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

export default function BilanPretScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();

  const onDecouvrir = () => {
    hapticConfirm();
    router.replace({
      pathname: '/(app)/bilan',
      params: params.sessionId ? { sessionId: params.sessionId } : {},
    });
  };

  const onPlusTard = () => {
    router.replace('/(app)');
  };

  return (
    <Screen scroll={false}>
      <View style={{ flex: 1, paddingHorizontal: theme.spacing.lg }}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <View style={{ marginBottom: theme.spacing.lg }}>
            <SectionLabel>Bilan</SectionLabel>
          </View>

          <Text style={s.title}>Votre bilan est prêt.</Text>

          <Text style={s.manifest}>Quand vous le souhaitez.</Text>
        </View>

        <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.xl }}>
          <Pressable
            accessibilityRole="button"
            onPress={onDecouvrir}
            style={({ pressed }) => ({
              height: 52,
              borderRadius: theme.radius.lg,
              backgroundColor: theme.palette.red,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={s.ctaPrimary}>Découvrir</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={onPlusTard}
            style={({ pressed }) => ({
              height: 52,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: theme.palette.edge,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={s.ctaGhost}>Plus tard</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const s = {
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.display,
    letterSpacing: 0.5,
    lineHeight: theme.fontSize.display * 1.15,
    color: theme.palette.cream,
    marginBottom: theme.spacing.lg,
  },
  manifest: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: theme.palette.creamSoft,
  },
  ctaPrimary: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
    color: theme.palette.cream,
  },
  ctaGhost: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
    color: theme.palette.cream,
  },
};
