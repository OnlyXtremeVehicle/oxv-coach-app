/**
 * Onglet Session — hub du flux (Équipement → Placement → Capture → Retour → Bilan).
 *
 * Oriente vers l'étape courante selon `useAppStateStore` (PR 4, ticket E1) : une
 * action principale contextuelle, puis le flux pour se repérer. Aucune logique de
 * capture ici (les écrans d'étape la portent). Doctrine : sobre, vouvoiement,
 * pas d'emoji ; silence en piste géré par l'écran de roulage.
 */

import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useAppStateStore } from '@/store/useAppStateStore';
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
  const state = useAppStateStore((st) => st.state);

  // Étape courante dérivée de l'état (E1). L'onglet oriente, il ne déroule pas
  // un menu : l'action principale est l'étape du moment.
  const currentHref =
    state === 'S6_roulage'
      ? '/(app)/roulage'
      : state === 'S5_approche'
        ? '/(app)/equipement'
        : null;
  const primary =
    state === 'S6_roulage'
      ? { label: 'Reprendre le roulage', href: '/(app)/roulage' }
      : state === 'S5_approche'
        ? { label: "Connecter l'équipement", href: '/(app)/equipement' }
        : { label: 'Préparer ma session', href: '/(app)/equipement' };

  return (
    <Screen>
      <AppBar title="SESSION" />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>VOTRE SORTIE</Text>
        <Text style={s.title} accessibilityRole="header">
          Préparer, rouler, revenir.
        </Text>
        <Text style={s.intro}>{INTRO}</Text>

        {/* Action principale = l'étape du moment. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={primary.label}
          onPress={() => router.push(primary.href as never)}
          style={({ pressed }) => [s.primaryBtn, { opacity: pressed ? 0.9 : 1 }]}
        >
          <Text style={s.primaryBtnText}>{primary.label}</Text>
        </Pressable>

        {/* Le flux, pour se repérer. */}
        <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
          {STEPS.map((step) => {
            const isCurrent = step.href === currentHref;
            return (
              <Card
                key={step.href}
                onPress={() => router.push(step.href as never)}
                accessibilityLabel={`${step.label}. ${step.hint}${
                  isCurrent ? '. Étape en cours.' : ''
                }`}
              >
                <Text style={s.cardTitle}>{step.label}</Text>
                <Text style={s.cardHint}>{step.hint}</Text>
              </Card>
            );
          })}
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
  // Action principale contextuelle (canon : crème pleine largeur, texte sombre).
  primaryBtn: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    height: 54,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: theme.spacing.xl,
  },
  primaryBtnText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 15,
    color: '#050505',
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
