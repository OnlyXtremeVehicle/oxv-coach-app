/**
 * Composants de transparence algorithmique (charte 11). Transposition gaming.
 *
 *  - SourceMethodBlock (T1) : « source / méthode » d'un insight.
 *  - DataQualityBanner (T2) : fiabilité ; bandeau OR (avertissement) si fragile.
 *  - ProvenanceLine    (T3) : version de méthode + date de calcul.
 *  - BlindspotsBlock   (T5) : « Ce que l'app ne dira jamais » (limites).
 *
 * Doctrine : factuel, vouvoiement, pas d'emoji. Rend la méthode et les
 * limites visibles — pas de boîte noire. Migration legacy→v2 achevée.
 */

import { StyleSheet, Text, View } from 'react-native';

import type { DataQuality } from '@/circuit/sessionInsights';
import { theme } from '@/theme/v2';

import { isLowReliability } from './insightTransparencyLogic';

export { RELIABILITY_THRESHOLD_PCT, isLowReliability } from './insightTransparencyLogic';

const { palette, fonts, fontSize, spacing, radius } = theme;

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
      <Text style={[styles.bannerText, { color: low ? palette.gold : palette.creamMute }]}>
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
      <Text style={styles.blockTitle}>SOURCE / MÉTHODE</Text>
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
      <Text style={styles.blockTitle}>CE QUE L&apos;APP NE DIRA JAMAIS</Text>
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
    borderRadius: radius.md,
    borderWidth: 0.5,
    marginBottom: spacing.lg,
  },
  bannerWarn: { borderColor: palette.gold, backgroundColor: 'rgba(255,183,3,0.08)' },
  bannerOk: { borderColor: palette.line, backgroundColor: palette.card2 },
  bannerText: { fontSize: fontSize.small },
  block: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: palette.line,
    backgroundColor: palette.card2,
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  blockTitle: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: palette.creamMute,
    marginBottom: spacing.xs,
  },
  blockLine: {
    color: palette.creamSoft,
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.5,
  },
  provenance: {
    color: palette.creamMute,
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
});
