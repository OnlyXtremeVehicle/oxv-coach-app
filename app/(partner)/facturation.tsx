/**
 * Espace Partenaire — Facturation (PR-81, placeholder honnête).
 *
 * OXV n'encaisse rien dans l'app pour l'instant : les offres AFFICHENT un prix,
 * elles ne le prélèvent pas. Le paiement en ligne (Stripe) viendra dans une phase
 * dédiée. On ne fabrique donc aucune fausse facture ni aucun solde — on dit
 * franchement où on en est, et comment résilier (D1 : résiliation simple).
 * Doctrine : sobre, vouvoiement, pas d'emoji, pas de marketing creux.
 */

import { Text, View } from 'react-native';
import { router } from 'expo-router';

import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

export default function PartnerFacturationScreen() {
  return (
    <Screen>
      <AppBar title="FACTURATION" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>VOTRE COMPTE</Text>
        <Text style={s.title} accessibilityRole="header">
          Rien à régler ici.
        </Text>
        <Text style={s.intro}>
          Votre espace partenaire est ouvert sans frais pour l&apos;instant. Vos offres affichent un
          prix à titre indicatif — OXV ne prélève rien dans l&apos;application.
        </Text>

        <Card style={{ marginTop: theme.spacing.xl }}>
          <Text style={s.cardTitle}>Paiement en ligne</Text>
          <Text style={s.cardBody}>
            Le règlement en ligne (Stripe) arrivera dans une phase dédiée. Vous serez prévenu avant
            toute mise en place, et rien ne changera sans votre accord.
          </Text>
        </Card>

        <Card style={{ marginTop: theme.spacing.sm }}>
          <Text style={s.cardTitle}>Résiliation</Text>
          <Text style={s.cardBody}>
            Vous pouvez suspendre ou fermer votre compte partenaire à tout moment, d&apos;un simple
            message à contact@oxvehicle.fr. Sans engagement, sans préavis.
          </Text>
        </Card>

        <Text style={s.footnote}>
          Une question sur votre compte ? Écrivez à contact@oxvehicle.fr.
        </Text>
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
  cardBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.6,
    marginTop: theme.spacing.sm,
  },
  footnote: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.5,
    marginTop: theme.spacing.xxl,
  },
};
