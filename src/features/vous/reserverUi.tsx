/**
 * Fragments UI partagés du flux réservation (lot V2-L4, mission D, flux A1).
 *
 * Regroupe les vues réutilisées par les trois écrans `reserver/*` :
 *   - ReserverClosedView : l'écran « Réservations à l'ouverture » (flag OFF),
 *     jauge fondateurs + CTA candidature ;
 *   - PlacesGaugeBar : la jauge 20 segments (pris = text.dim, restants = accent
 *     — « la rareté se voit »), ou « LISTE D'ATTENTE » si complet ;
 *   - CircuitFallback : tracé de circuit Skia, fallback de HeroPhoto (aucune
 *     photo de circuit en base — jamais d'image stock).
 *
 * Aucune donnée fabriquée : les valeurs viennent des props (elles-mêmes issues
 * de bookingCatalogService). Doctrine : sobre, vouvoyé, un seul accent rouge.
 */

import { StyleSheet, Text, View } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { router } from 'expo-router';

import {
  FOUNDER_TOTAL,
  foundersProgressLabel,
  placesLabel,
  type PlacesGauge,
} from '@/services/bookingCatalogLogic';
import {
  Chip,
  EMPTY_CIRCUIT_PATH,
  GlowStroke,
  OxvIcon,
  PressScale,
  colors,
  radius,
  space,
  typo,
} from '@/ui/v2';

/** Tracé de circuit Skia — fallback visuel de HeroPhoto (aucune photo stock). */
export function CircuitFallback() {
  return (
    <Canvas style={styles.fallbackCanvas}>
      <GlowStroke path={EMPTY_CIRCUIT_PATH} strokeWidth={2} />
    </Canvas>
  );
}

/**
 * Jauge de places : segments pris (text.dim) puis restants (accent). Complet →
 * pastille « LISTE D'ATTENTE » (bord border.strong). Sous la jauge, « n places ».
 */
export function PlacesGaugeBar({ gauge }: { gauge: PlacesGauge }) {
  if (gauge.isWaitlist) {
    return (
      <View style={styles.waitlistPill}>
        <Text style={styles.waitlistLabel}>LISTE D'ATTENTE</Text>
      </View>
    );
  }
  const segments = Array.from({ length: gauge.segments });
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={placesLabel(gauge)}
      style={styles.gaugeBlock}
    >
      <View style={styles.gaugeRow}>
        {segments.map((_, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              { backgroundColor: i < gauge.filledSegments ? colors.text.dim : colors.accent },
            ]}
          />
        ))}
      </View>
      <Text style={styles.gaugeLabel}>{placesLabel(gauge)}</Text>
    </View>
  );
}

/** Chips d'offres (Access/Signature…) — statiques, même couleur que le label. */
export function OfferChips({ labels }: { labels: string[] }) {
  if (labels.length === 0) return null;
  return (
    <View style={styles.chipRow}>
      {labels.map((l) => (
        <Chip key={l} label={l} />
      ))}
    </View>
  );
}

/**
 * Écran « Réservations à l'ouverture » (drapeau app_payments OFF) : jauge
 * fondateurs 12/30 (or, borne dure) + CTA candidature → Sheet fondateur.
 */
export function ReserverClosedView({ foundersCount }: { foundersCount: number }) {
  const filled = Math.max(0, Math.min(Math.floor(foundersCount), FOUNDER_TOTAL));
  const segments = Array.from({ length: FOUNDER_TOTAL });
  return (
    <View style={styles.closedRoot}>
      <OxvIcon name="insigne" size={40} color={colors.heritage.gold} />
      <Text style={styles.closedEyebrow}>RÉSERVATIONS</Text>
      <Text style={styles.closedTitle}>À l'ouverture.</Text>
      <Text style={styles.closedBody}>
        Les réservations ouvriront avec les premiers membres fondateurs. Trente membres, jamais
        plus.
      </Text>

      <View style={styles.foundersGaugeRow}>
        {segments.map((_, i) => (
          <View
            key={i}
            style={[
              styles.foundersSeg,
              { backgroundColor: i < filled ? colors.heritage.gold : colors.border.strong },
            ]}
          />
        ))}
      </View>
      <Text style={styles.foundersLabel}>{foundersProgressLabel(foundersCount)}</Text>

      <PressScale
        onPress={() => router.navigate('/(app2)/vous/fondateur' as never)}
        accessibilityLabel="Candidater comme membre fondateur"
        containerStyle={styles.ctaContainer}
        style={styles.ctaBtn}
      >
        <Text style={styles.ctaLabel}>CANDIDATER</Text>
      </PressScale>
    </View>
  );
}

const styles = StyleSheet.create({
  fallbackCanvas: { width: 156, height: 87 },

  // Jauge de places
  gaugeBlock: { gap: space.sm },
  gaugeRow: { flexDirection: 'row', gap: 3 },
  segment: { flex: 1, height: 6, borderRadius: 2 },
  gaugeLabel: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.text.mid,
  },
  waitlistPill: {
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  waitlistLabel: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.text.mid,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },

  // Écran fermé
  closedRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    gap: space.md,
  },
  closedEyebrow: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.heritage.gold,
    marginTop: space.md,
  },
  closedTitle: {
    fontFamily: typo.display,
    fontSize: 24,
    letterSpacing: 0.5,
    color: colors.text.hi,
  },
  closedBody: {
    fontFamily: typo.body,
    fontSize: 14,
    lineHeight: 22,
    color: colors.text.mid,
    textAlign: 'center',
    maxWidth: 300,
  },
  foundersGaugeRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: space.lg,
    alignSelf: 'stretch',
  },
  foundersSeg: { flex: 1, height: 6, borderRadius: 2 },
  foundersLabel: {
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 0.6,
    color: colors.text.mid,
  },
  ctaContainer: { marginTop: space.xl },
  ctaBtn: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: space.xxl,
    paddingVertical: space.md,
  },
  ctaLabel: {
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.accent,
  },
});
