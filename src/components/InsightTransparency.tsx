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
  // Langage v2 : LIGNE D'ÉTAT à pastille (comme le menu Data Lab) — verte si
  // fiable, NEUTRE si fragile. L'or est réservé au chrono (canon), jamais à un
  // avertissement de méthode.
  return (
    <View style={styles.stateRow}>
      <View
        style={[styles.stateDot, { backgroundColor: low ? palette.faint : theme.dataColors.accel }]}
      />
      <Text style={[styles.stateText, low && { color: palette.creamSoft }]}>
        {low
          ? `Fiabilité réduite : ${dataQuality.pct_valid} % des points valides. À lire avec prudence.`
          : `Fiabilité : ${dataQuality.pct_valid} % des points valides · ${dataQuality.frames_used} trames.`}
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
  // Ligne d'état (v2) : pastille + texte muted, sans encadré lourd.
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    minHeight: 20,
  },
  stateDot: { width: 7, height: 7, borderRadius: 4 },
  stateText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.45,
  },
  // Tuile v2 : surface, hairline, caption mono fine.
  block: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  blockTitle: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: palette.eyebrow,
    marginBottom: spacing.xs,
  },
  blockLine: {
    color: palette.creamSoft,
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    lineHeight: fontSize.small * 1.55,
  },
  provenance: {
    color: palette.eyebrow,
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
});
