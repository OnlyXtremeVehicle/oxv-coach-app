/**
 * KingNumber — le CHIFFRE ROI d'un écran (refonte V3, handoff §5).
 *
 * Un seul par écran (un seul chiffre dominant). Grand chiffre en JetBrains Mono,
 * tabular-nums, letter-spacing serré. Sa COULEUR est celle de la donnée qu'il
 * représente : violet pour la régularité, or pour le chrono/record, etc. — via
 * la prop `color`. Pas de halo « gaming » : un chiffre net (refonte calme).
 *
 * À sa droite : une unité optionnelle (« s », « /100 ») + un libellé court, et un
 * fait de tendance facultatif (descriptif, jamais une prescription). La tendance
 * positive est verte, la négative reste neutre (crème) — on informe, on n'alarme.
 */

import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme/v2';

const { palette, fonts, spacing } = theme;

export interface KingNumberProps {
  /** Valeur déjà formatée (ex. « 0,42 », « ±0,42 s », « 1:24.318 »). */
  value: string;
  /** Unité / dénominateur à droite du chiffre (ex. « s », « /100 »). */
  unit?: string;
  /** Libellé court sous l'unité (ex. « RÉGULARITÉ »). */
  label?: string;
  /** Fait de tendance facultatif (ex. « +3 vs médiane »). Descriptif, jamais un ordre. */
  trend?: string;
  /** Tendance positive → vert ; sinon crème neutre. Défaut : neutre. */
  trendPositive?: boolean;
  /**
   * Couleur du chiffre = couleur de sa DONNÉE (ex. dataColors.regularity violet,
   * palette.gold pour un chrono). Prioritaire sur `tone`. Défaut : or.
   */
  color?: string;
  /** Raccourci historique : « gold » (défaut) ou « amber ». Ignoré si `color`. */
  tone?: 'gold' | 'amber';
  /** Taille du chiffre (défaut 48, plage refonte 46-54). */
  size?: number;
}

export function KingNumber({
  value,
  unit,
  label,
  trend,
  trendPositive = false,
  color,
  tone = 'gold',
  size = 48,
}: KingNumberProps) {
  const resolved = color ?? (tone === 'amber' ? palette.pilotAmber : palette.gold);

  return (
    <View style={s.row}>
      <View style={s.numberRow}>
        <Text
          style={[s.number, { color: resolved, fontSize: size, lineHeight: size * 0.96 }]}
          accessibilityRole="text"
          allowFontScaling={false}
        >
          {value}
        </Text>
        {unit || label ? (
          <View style={s.side}>
            {unit ? <Text style={s.unit}>{unit}</Text> : null}
            {label ? <Text style={s.label}>{label}</Text> : null}
          </View>
        ) : null}
      </View>

      {trend ? (
        <Text style={[s.trend, trendPositive ? { color: palette.green } : null]}>{trend}</Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  numberRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  number: {
    fontFamily: fonts.king, // JetBrains Mono bold — chiffre roi
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'], // les chiffres ne dansent pas quand la valeur change
  },
  side: { justifyContent: 'flex-end', paddingBottom: 6, gap: 2 },
  unit: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: palette.eyebrow,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: palette.eyebrow,
  },
  trend: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: palette.creamMute,
    paddingBottom: 6,
  },
});
