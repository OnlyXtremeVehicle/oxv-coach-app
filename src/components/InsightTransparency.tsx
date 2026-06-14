/**
 * Composants de transparence algorithmique (charte 11).
 *
 * Briques réutilisables portant en production ce que les maquettes prévoient :
 *  - SourceMethodBlock  (T1) : « source / méthode » d'un insight.
 *  - DataQualityBanner  (T2) : fiabilité, bandeau si donnée fragile.
 *  - ProvenanceLine     (T3) : version de méthode + date de calcul.
 *  - BlindspotsBlock    (T5) : « Ce que l'app ne dira jamais » (limites).
 *
 * Doctrine : factuel, vouvoiement, pas d'emoji. Ces blocs RENDENT la méthode
 * et les limites visibles — pas de boîte noire.
 */

import { StyleSheet, Text, View } from 'react-native';

import type { DataQuality } from '@/circuit/sessionInsights';
import { borderRadius, colors, fontSize, spacing, typography } from '@/theme/tokens';

import { isLowReliability } from './insightTransparencyLogic';

export { RELIABILITY_THRESHOLD_PCT, isLowReliability } from './insightTransparencyLogic';

function formatComputedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR');
}

export function DataQualityBanner({
  dataQuality,
}: {
  dataQuality: DataQuality | null | undefined;
}) {
  if (!dataQuality) return null;
  const low = isLowReliability(dataQuality);
  return (
    <View style={[styles.banner, low ? styles.bannerWarn : styles.bannerOk]}>
      <Text style={[styles.bannerText, { color: low ? colors.accent.red : colors.text.tertiary }]}>
        {low
          ? `Fiabilité réduite : ${dataQuality.pct_valid}% des points sont valides. À lire avec prudence.`
          : `Fiabilité : ${dataQuality.pct_valid}% des points valides · ${dataQuality.frames_used} trames.`}
      </Text>
    </View>
  );
}

export function SourceMethodBlock({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.block}>
      <Text style={[typography.eyebrow, styles.blockTitle]}>SOURCE / MÉTHODE</Text>
      {items.map((it) => (
        <Text key={it} style={styles.blockLine}>
          {it}
        </Text>
      ))}
    </View>
  );
}

export function BlindspotsBlock({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.block}>
      <Text style={[typography.eyebrow, styles.blockTitle]}>CE QUE L'APP NE DIRA JAMAIS</Text>
      {items.map((it) => (
        <Text key={it} style={styles.blockLine}>
          {it}
        </Text>
      ))}
    </View>
  );
}

export function ProvenanceLine({
  engineVersion,
  computedAt,
}: {
  engineVersion: string | null | undefined;
  computedAt: string | null | undefined;
}) {
  const date = formatComputedAt(computedAt);
  if (!engineVersion && !date) return null;
  const parts: string[] = [];
  if (engineVersion) parts.push(`Méthode ${engineVersion}`);
  if (date) parts.push(`calculé le ${date}`);
  return <Text style={styles.provenance}>{parts.join(' · ')}</Text>;
}

const styles = StyleSheet.create({
  banner: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 0.5,
    marginBottom: spacing.lg,
  },
  bannerWarn: { borderColor: colors.accent.red, backgroundColor: 'rgba(230,57,70,0.08)' },
  bannerOk: { borderColor: colors.border.subtle, backgroundColor: colors.background.secondary },
  bannerText: { fontSize: fontSize.caption },
  block: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 0.5,
    borderColor: colors.border.subtle,
    backgroundColor: colors.background.secondary,
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  blockTitle: { color: colors.text.tertiary, marginBottom: spacing.xs },
  blockLine: {
    color: colors.text.secondary,
    fontSize: fontSize.caption,
    lineHeight: fontSize.caption * 1.5,
  },
  provenance: {
    color: colors.text.tertiary,
    fontSize: fontSize.caption,
    fontFamily: 'Menlo',
    marginTop: spacing.lg,
    textAlign: 'center',
  },
});
