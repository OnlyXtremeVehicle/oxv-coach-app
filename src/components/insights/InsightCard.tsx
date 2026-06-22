/**
 * Pièces réutilisables de la galerie « Lectures approfondies ».
 *
 * - `DemoBanner` : marqueur DÉMO (état §5 du moteur — `telemetry_frames` vide,
 *   données réelles dès Valence). À afficher en haut de la galerie ET de chaque
 *   détail.
 * - `InsightCard` : carte de lecture (barre QDI à gauche, nom mono, badge,
 *   constat factuel avec nombre en mono coloré, sparkline en `children`).
 * - `ConstatTag` : tag doctrinal « un constat, pas une consigne ».
 *
 * Pass B importe ces trois composants tels quels — aucune duplication.
 *
 * Doctrine : la carte n'énonce qu'un FAIT (`fact`), jamais une consigne. La
 * couleur vient de la dimension QDI (theme.dataColors), jamais heritageGold.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme/v2';
import {
  CONSTAT_TAG,
  DEMO_NOTICE,
  dimensionColor,
  type QdiDimension,
} from '@/components/insights/catalogue';

/**
 * Bandeau DÉMO bordé, discret. Rappelle que la donnée affichée est une
 * maquette jusqu'à la première vraie capture (Valence).
 */
export function DemoBanner({ notice = DEMO_NOTICE }: { notice?: string }) {
  return (
    <View style={styles.demo} accessibilityRole="text">
      <View style={styles.demoDot} />
      <Text style={styles.demoText}>{notice}</Text>
    </View>
  );
}

/** Tag doctrinal mono faint sous chaque lecture détaillée. */
export function ConstatTag({ label = CONSTAT_TAG }: { label?: string }) {
  return <Text style={styles.constat}>{label}</Text>;
}

interface InsightCardProps {
  name: string;
  badge: string;
  dimension: QdiDimension;
  /** Constat factuel ; le segment entre **double astérisques** sort en mono coloré. */
  fact: string;
  /** Sparkline SVG de la lecture (fournie par l'appelant). */
  children: React.ReactNode;
  onPress: () => void;
}

/**
 * Carte de la galerie. Tap → ouverture du détail de la lecture.
 * La barre verticale gauche et le nombre marquant portent la couleur QDI.
 */
export function InsightCard({ name, badge, dimension, fact, children, onPress }: InsightCardProps) {
  const color = dimensionColor(dimension);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      {/* Barre QDI de la dimension (gauche) */}
      <View style={[styles.bar, { backgroundColor: color }]} />

      <View style={styles.cardTop}>
        <Text style={styles.name}>{name}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      </View>

      <Text style={styles.fact}>{renderFact(fact, color)}</Text>

      <View style={styles.spark}>{children}</View>
    </Pressable>
  );
}

/**
 * Rend le constat : le segment **…** devient un nombre en mono à la couleur
 * QDI ; le reste reste en corps léger. Pas de markdown lourd, juste l'emphase
 * du chiffre (« un seul chiffre par écran », doctrine CLAUDE.md §5).
 */
function renderFact(fact: string, color: string) {
  const parts = fact.split('**');
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <Text key={`b${i}`} style={[styles.factNum, { color }]}>
        {part}
      </Text>
    ) : (
      <Text key={`t${i}`}>{part}</Text>
    )
  );
}

const styles = StyleSheet.create({
  demo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.palette.line,
    borderRadius: theme.radius.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  demoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.palette.gold,
  },
  demoText: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: theme.palette.faint,
  },
  constat: {
    fontFamily: theme.fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: theme.palette.faint,
  },
  card: {
    backgroundColor: theme.palette.card,
    borderColor: theme.palette.line,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    overflow: 'hidden',
  },
  cardPressed: {
    borderColor: theme.palette.edge,
    opacity: 0.92,
  },
  bar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  name: {
    fontFamily: theme.fonts.mono,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.palette.cream,
    flexShrink: 1,
    paddingRight: theme.spacing.sm,
  },
  badge: {
    borderWidth: 1,
    borderColor: theme.palette.line,
    borderRadius: theme.radius.pill,
    paddingVertical: 3,
    paddingHorizontal: theme.spacing.sm,
  },
  badgeText: {
    fontFamily: theme.fonts.mono,
    fontSize: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
  },
  fact: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: 13,
    lineHeight: 13 * 1.5,
    color: theme.palette.creamSoft,
    marginBottom: theme.spacing.md,
  },
  factNum: {
    fontFamily: theme.fonts.monoMedium,
  },
  spark: {
    height: 34,
    width: '100%',
  },
});
