/**
 * Galerie « Lectures approfondies » — la vitrine du moteur d'insights.
 *
 * Spec : docs/specs-bundle-v4/02_moteur_insights.md
 * Maquette : docs/specs-bundle-v4/maquette_galerie_insights.html
 *
 * Rassemble les six lectures sur trois niveaux (N2 décomposition, N3
 * régularité, N4 signature) et donne, d'un coup d'œil, la profondeur de
 * l'app. Chaque carte énonce un FAIT chiffré (jamais une consigne), porte la
 * couleur QDI de sa dimension et une mini-sparkline. Tap → écran de détail
 * /(app)/insight/<clé>.
 *
 * ÉTAT (§5 du moteur) : `telemetry_frames` est vide ; toutes les valeurs sont
 * de DÉMONSTRATION jusqu'à la première vraie capture (Valence, juillet 2026).
 * Le bandeau DemoBanner le signale à l'écran.
 *
 * Doctrine : un miroir, pas un directeur (pied de galerie). Couleurs =
 * theme.dataColors (QDI), aucune couleur heritage.
 */

import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { DemoBanner, InsightCard } from '@/components/insights/InsightCard';
import {
  DOCTRINE_FOOTER,
  READINGS,
  TIERS,
  type InsightTier,
} from '@/components/insights/catalogue';
import { Sparkline } from '@/components/insights/sparklines';
import { FadeInSection } from '@/components/motion';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Screen } from '@/ui/Screen';

export default function InsightsScreen() {
  return (
    <Screen>
      <AppBar title="LECTURES APPROFONDIES" onBack={() => router.back()} />
      <View style={styles.body}>
        {/* Héros + marqueur DÉMO révélés en premier (cascade douce). */}
        <FadeInSection>
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>Le moteur d’insights</Text>
            <Text style={styles.h1} accessibilityRole="header">
              Ce que vos données révèlent
            </Text>
            <Text style={styles.subtitle}>
              Six lectures, du constat direct à la signature de votre voiture. Chacune montre un
              fait — jamais une consigne.
            </Text>
          </View>

          {/* Marqueur DÉMO : données réelles dès Valence (§5). */}
          <DemoBanner />
        </FadeInSection>

        {/* Trois familles (tiers) avec leurs cartes — chaque famille révélée
            en cascade après l'en-tête (delays plafonnés à 4 paliers). */}
        {TIERS.map((tier, ti) => (
          <FadeInSection key={tier.id} delay={Math.min(ti + 1, 3) * 80}>
            <TierLabel label={tier.label} />
            {READINGS.filter((r) => r.tier === (tier.id as InsightTier)).map((r) => (
              <InsightCard
                key={r.key}
                name={r.name}
                badge={r.badge}
                dimension={r.dimension}
                fact={r.fact}
                onPress={() => router.push(`/(app)/insight/${r.key}` as never)}
              >
                <Sparkline reading={r.key} />
              </InsightCard>
            ))}
          </FadeInSection>
        ))}

        {/* Pied doctrinal — un miroir, pas un directeur. Rejoint la cascade
            (au lieu d'apparaître sec) en clôture, après les trois familles. */}
        <FadeInSection delay={320}>
          <View style={styles.footer}>
            <Text style={styles.footerText}>{DOCTRINE_FOOTER}</Text>
          </View>
        </FadeInSection>
      </View>
    </Screen>
  );
}

/** Libellé de famille (mono faint) avec filet à droite. */
function TierLabel({ label }: { label: string }) {
  return (
    <View style={styles.tier}>
      <Text style={styles.tierText}>{label}</Text>
      <View style={styles.tierLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  hero: {
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.lg,
  },
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 2.6,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
    marginBottom: theme.spacing.md,
  },
  h1: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: -0.2,
    lineHeight: theme.fontSize.h2 * 1.25,
    color: theme.palette.cream,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: 13.5,
    lineHeight: 13.5 * 1.55,
    color: theme.palette.creamMute,
  },
  tier: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.md,
  },
  tierText: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
  },
  tierLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.palette.line,
  },
  footer: {
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
    borderStyle: 'dashed',
    borderRadius: theme.radius.lg,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: theme.fonts.bodyLight,
    fontStyle: 'italic',
    fontSize: 12,
    lineHeight: 12 * 1.6,
    textAlign: 'center',
    color: theme.palette.creamMute,
  },
});
