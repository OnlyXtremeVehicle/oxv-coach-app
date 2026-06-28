/**
 * Espace Pilote professionnel — tableau de bord (fondation PR-I).
 *
 * Le pilote pro est un pilote (mêmes données, mêmes RLS own-row) avec un espace
 * distinct. Ce hub surface son identité pro et donne accès à ses outils data,
 * partagés avec l'espace pilote (bilan, Data Lab, signature, progression). Les
 * fonctions pro-spécifiques (garage enrichi, jumeau, exports, contrat) viendront
 * par tranches. Doctrine : sobre, vouvoiement, pas d'emoji, or = donnée.
 */

import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Logo } from '@/brand/Logo';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

const TOOLS: { label: string; hint: string; href: string }[] = [
  { label: 'Mon bilan', hint: 'La lecture de votre dernière session', href: '/(app)/bilan' },
  { label: 'Data Lab', hint: 'Relire une session en profondeur', href: '/(app)/data-lab' },
  { label: 'Ma signature', hint: 'Votre empreinte de pilotage', href: '/(app)/signature' },
  { label: 'Ma progression', hint: 'Vos tendances dans le temps', href: '/(app)/progression' },
  { label: 'Mon garage', hint: 'Vos véhicules et leurs réglages', href: '/(app)/garage' },
];

export default function ProPilotHubScreen() {
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const greeting = profile?.first_name ? `Bonjour ${profile.first_name}` : 'Bonjour';

  return (
    <Screen>
      <AppBar title="PILOTE PRO OXV" leading={<Logo size={26} />} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>ESPACE PROFESSIONNEL</Text>
        <Text style={s.title} accessibilityRole="header">
          {greeting}.
        </Text>
        <Text style={s.intro}>
          Vos outils de lecture, au niveau exigé. Le détail de la donnée, la signature, la
          progression — tout ce qui sert votre travail.
        </Text>

        <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.xl }}>
          {TOOLS.map((t) => (
            <Card
              key={t.href}
              onPress={() => router.push(t.href as never)}
              accessibilityLabel={`${t.label}. ${t.hint}`}
            >
              <Text style={s.cardTitle}>{t.label}</Text>
              <Text style={s.cardHint}>{t.hint}</Text>
            </Card>
          ))}
        </View>

        <Card style={{ marginTop: theme.spacing.xl }}>
          <Text style={s.note}>
            Jumeau numérique et exports avancés arrivent dans votre espace pro.
          </Text>
        </Card>

        <View style={{ marginTop: theme.spacing.xxl, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Se déconnecter"
            onPress={() => signOut()}
            hitSlop={theme.hitSlop}
            style={({ pressed }) => ({
              paddingVertical: theme.spacing.sm,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={s.minorLink}>Se déconnecter</Text>
          </Pressable>
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
  note: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.5,
  },
  minorLink: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
};
