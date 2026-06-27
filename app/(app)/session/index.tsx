/**
 * Onglet Session — hub du flux (Équipement → Placement → Capture → Retour → Bilan).
 *
 * PR 1 : hub minimal qui liste les étapes existantes. Le câblage par état (ouvrir
 * directement l'étape courante selon `useAppStateStore`) vient en PR 4 ; aucune
 * logique de capture ici. Doctrine : sobre, vouvoiement, pas d'emoji.
 */

import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

const INTRO = "L'app capture en silence. Elle vous parle après la session, jamais pendant.";

const STEPS: { label: string; hint: string; href: string }[] = [
  { label: 'Équipement', hint: 'Jumeler le boîtier OXV', href: '/(app)/equipement' },
  { label: 'Placement', hint: 'Où poser le boîtier', href: '/(app)/placement' },
  { label: 'En piste', hint: "L'app s'efface pendant le roulage", href: '/(app)/roulage' },
  { label: 'Retour stands', hint: 'Vos données sont préservées', href: '/(app)/pilotage-fini' },
];

export default function SessionHubScreen() {
  return (
    <Screen>
      <AppBar title="SESSION" />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>VOTRE SORTIE</Text>
        <Text style={s.title} accessibilityRole="header">
          Préparer, rouler, revenir.
        </Text>
        <Text style={s.intro}>{INTRO}</Text>

        <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.xl }}>
          {STEPS.map((step) => (
            <Card
              key={step.href}
              onPress={() => router.push(step.href as never)}
              accessibilityLabel={`${step.label}. ${step.hint}`}
            >
              <Text style={s.cardTitle}>{step.label}</Text>
              <Text style={s.cardHint}>{step.hint}</Text>
            </Card>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
    marginTop: theme.spacing.md,
  },
  intro: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.6,
    marginTop: theme.spacing.md,
  },
  cardTitle: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  cardHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
};
