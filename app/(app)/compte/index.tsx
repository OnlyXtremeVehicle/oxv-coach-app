/**
 * Compte — accessible par l'icône en haut à droite (JAMAIS un onglet, cf.
 * `00_PLATEFORME_OXV §4`). Range le secondaire : profil, objectifs,
 * notifications, réglages, données & confidentialité (RGPD + légal). Discret,
 * jamais devant le Bilan. Doctrine : sobre, vouvoiement, pas d'emoji.
 */

import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

const LINKS: { label: string; hint: string; href: string }[] = [
  { label: 'Mon profil', hint: 'Niveau, véhicule, réseaux', href: '/(app)/profil' },
  { label: 'Mes objectifs', hint: 'Vos repères personnels', href: '/(app)/objectifs' },
  { label: 'Notifications', hint: 'À traiter, à découvrir', href: '/(app)/notifications' },
  { label: 'Réglages', hint: "Préférences de l'application", href: '/(app)/settings' },
  {
    label: 'Données & confidentialité',
    hint: 'Export, suppression, documents légaux',
    href: '/(app)/donnees-securite',
  },
];

export default function CompteHubScreen() {
  return (
    <Screen>
      <AppBar title="COMPTE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>VOTRE COMPTE</Text>
        <Text style={s.title} accessibilityRole="header">
          Vous gérer.
        </Text>

        <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.xl }}>
          {LINKS.map((link) => (
            <Card
              key={link.href}
              onPress={() => router.push(link.href as never)}
              accessibilityLabel={`${link.label}. ${link.hint}`}
            >
              <Text style={s.cardTitle}>{link.label}</Text>
              <Text style={s.cardHint}>{link.hint}</Text>
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
