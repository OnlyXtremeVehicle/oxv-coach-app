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

import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

export default function AccueilPhilosophiqueScreen() {
  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
        paddingHorizontal: spacing.xl,
      }}
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Image
          source={require('../../assets/icon.png')}
          style={{ width: 160, height: 160, marginBottom: spacing.xxxl }}
          resizeMode="contain"
        />
        <Text
          style={[typography.eyebrow, { marginBottom: spacing.lg, color: colors.text.tertiary }]}
        >
          OXV COACH
        </Text>
        <Text style={[typography.manifest, { textAlign: 'center', paddingHorizontal: spacing.md }]}>
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
            fontSize: fontSize.body,
            fontWeight: fontWeight.medium,
            letterSpacing: 0.5,
          }}
        >
          Commencer
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}
