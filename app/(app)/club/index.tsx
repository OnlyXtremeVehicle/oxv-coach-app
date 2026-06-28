/**
 * Onglet Club — « qui vous entoure » : coach affilié, découverte, partenaires,
 * carte OXV, communauté.
 *
 * PR 1 : hub minimal vers les écrans existants. « Mon coach » est le plus
 * proéminent (affiliation mise en avant). Aucun réseau social généraliste.
 * Doctrine : sobre, vouvoiement, pas d'emoji.
 *
 * Fusion territoire (FAIT, décision Gabin 2026-06, cf.
 * `roadmap/rapports/pr-08-fusion-carte-oxv.md`) : « La carte OXV » (`carte-oxv`)
 * est l'écran UNIQUE du territoire (carte + liste, source `social_pings`).
 * `social`, `social-carte` et `lieux` sont désormais des coquilles `<Redirect>`
 * vers lui ; le modèle `places` est déprécié. `amis` reste distinct (amitiés).
 */

import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

const INTRO =
  'Votre écosystème piste : votre coach, les partenaires autour de vos sorties, votre communauté.';

const LINKS: { label: string; hint: string; href: string }[] = [
  { label: 'Mon coach', hint: 'Votre coach affilié et ses notes', href: '/(app)/mon-coach' },
  { label: 'Découvrir un coach', hint: 'Les coachs OXV', href: '/(app)/coachs' },
  { label: 'Mes demandes', hint: 'Vos demandes de séance', href: '/(app)/mes-demandes' },
  { label: 'La carte OXV', hint: 'Lieux, partenaires et événements', href: '/(app)/carte-oxv' },
  {
    label: 'Partenaires',
    hint: 'Offres et services autour de vos sorties',
    href: '/(app)/partenaires',
  },
  { label: 'Communauté', hint: 'Vos comparaisons consenties', href: '/(app)/amis' },
  { label: 'Belles routes', hint: 'Balades et points de vue', href: '/(app)/belle-route' },
];

export default function ClubHubScreen() {
  return (
    <Screen>
      <AppBar title="CLUB" />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>VOTRE ÉCOSYSTÈME</Text>
        <Text style={s.title} accessibilityRole="header">
          Qui vous entoure.
        </Text>
        <Text style={s.intro}>{INTRO}</Text>

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
