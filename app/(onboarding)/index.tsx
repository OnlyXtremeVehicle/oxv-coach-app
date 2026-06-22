/**
 * Écran #01 — Accueil philosophique.
 *
 * Premier écran à l'ouverture après installation et authentification.
 * Insigne, manifeste minimal, bouton Commencer. Pas de bouton "passer" :
 * l'onboarding est complet ou rien.
 */

import { Image, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { borderRadius, colors, fontSize, spacing, typography } from '@/theme/tokens';
import { theme } from '@/theme/v2';

export default function AccueilPhilosophiqueScreen() {
  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
        paddingHorizontal: spacing.xl,
      }}
    >
      <View style={{ flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.lg }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: borderRadius.sm,
              backgroundColor: i < 1 ? colors.accent.red : colors.border.subtle,
            }}
          />
        ))}
      </View>
      <Text
        style={[
          typography.eyebrow,
          { fontFamily: theme.fonts.mono, color: theme.palette.faint, marginTop: spacing.sm },
        ]}
      >
        ÉTAPE 1 / 6
      </Text>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Image
          source={require('../../assets/icon.png')}
          style={{ width: 160, height: 160, marginBottom: spacing.xxxl }}
          resizeMode="contain"
        />
        <Text
          style={[
            typography.eyebrow,
            { fontFamily: theme.fonts.mono, marginBottom: spacing.lg, color: theme.palette.faint },
          ]}
        >
          OXV MIRROR
        </Text>
        <Text
          style={[
            typography.manifest,
            {
              fontFamily: theme.fonts.bodyLight,
              textAlign: 'center',
              paddingHorizontal: spacing.md,
            },
          ]}
        >
          Bienvenue dans le miroir.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/(onboarding)/doctrine')}
        style={({ pressed }) => ({
          height: 52,
          borderRadius: borderRadius.lg,
          backgroundColor: colors.accent.red,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.xl,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text
          style={{
            color: colors.text.primary,
            fontFamily: theme.fonts.bodyMedium,
            fontSize: fontSize.body,
            letterSpacing: 0.5,
          }}
        >
          Commencer
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}
