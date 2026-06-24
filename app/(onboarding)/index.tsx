/**
 * Écran #01 — Accueil philosophique. Transposition gaming (cockpit factuel).
 *
 * Premier écran à l'ouverture après installation et authentification.
 * Insigne, manifeste minimal, bouton Commencer. Pas de bouton « passer » :
 * l'onboarding est complet ou rien.
 *
 * Cockpit : barre de progression et CTA en OR (accent actif), texte sombre
 * sur l'or. Migration legacy→v2 achevée (thème @/theme/v2 exclusif).
 */

import { Image, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { theme } from '@/theme/v2';

const { palette, fonts, fontSize, spacing, radius } = theme;
const STEP = 1;
const TOTAL = 6;

export default function AccueilPhilosophiqueScreen() {
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: palette.night, paddingHorizontal: spacing.xl }}
    >
      {/* Barre de progression — segment actif en or */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.lg }}>
        {Array.from({ length: TOTAL }).map((_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: radius.sm,
              backgroundColor: i < STEP ? palette.gold : palette.line,
            }}
          />
        ))}
      </View>
      <Text style={[s.eyebrow, { marginTop: spacing.sm }]}>
        ÉTAPE {STEP} / {TOTAL}
      </Text>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Image
          source={require('../../assets/icon.png')}
          style={{ width: 160, height: 160, marginBottom: 40 }}
          resizeMode="contain"
        />
        <Text style={[s.eyebrow, { marginBottom: spacing.lg }]}>OXV MIRROR</Text>
        <Text style={s.manifest}>Bienvenue dans le miroir.</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/(onboarding)/doctrine')}
        style={({ pressed }) => ({
          height: 52,
          borderRadius: radius.lg,
          backgroundColor: palette.gold,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.xl,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text style={s.ctaTxt}>Commencer</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const s = {
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: palette.faint,
  },
  manifest: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.h3,
    fontStyle: 'italic' as const,
    color: palette.creamSoft,
    textAlign: 'center' as const,
    lineHeight: fontSize.h3 * 1.5,
    paddingHorizontal: spacing.md,
  },
  ctaTxt: {
    color: palette.night,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.body,
    letterSpacing: 0.5,
  },
};
