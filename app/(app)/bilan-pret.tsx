/**
 * Écran #12 — Votre bilan est prêt.
 *
 * Annonce que le bilan est disponible. Doctrine essentielle : on ne
 * force pas la consultation. Deux options strictement équivalentes en
 * poids visuel — `Découvrir` (primaire) et `Plus tard` (secondaire).
 */

import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { confirm as hapticConfirm } from '@/lib/haptics';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

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
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
        paddingHorizontal: spacing.xl,
      }}
    >
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text
          style={[typography.eyebrow, { marginBottom: spacing.lg, color: colors.text.tertiary }]}
        >
          BILAN
        </Text>

        <Text
          style={{
            color: colors.text.primary,
            fontSize: fontSize.display,
            fontWeight: fontWeight.ultralight,
            lineHeight: fontSize.display * 1.15,
            marginBottom: spacing.lg,
          }}
        >
          Votre bilan est prêt.
        </Text>

        <Text style={[typography.manifest, { color: colors.text.secondary }]}>
          Quand vous le souhaitez.
        </Text>
      </View>

      <View style={{ gap: spacing.md, marginBottom: spacing.xl }}>
        <Pressable
          accessibilityRole="button"
          onPress={onDecouvrir}
          style={({ pressed }) => ({
            height: 52,
            borderRadius: borderRadius.lg,
            backgroundColor: colors.accent.red,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text
            style={{
              color: colors.text.primary,
              fontSize: fontSize.body,
              fontWeight: fontWeight.medium,
              letterSpacing: 0.5,
            }}
          >
            Découvrir
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={onPlusTard}
          style={({ pressed }) => ({
            height: 52,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border.medium,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text
            style={{
              color: colors.text.primary,
              fontSize: fontSize.body,
              fontWeight: fontWeight.regular,
            }}
          >
            Plus tard
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
