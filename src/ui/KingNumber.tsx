/**
 * KingNumber — le CHIFFRE ROI d'un écran (refonte NG, docs/refonte-app).
 *
 * Un seul par écran (Principe 5 : un seul chiffre dominant). Grand chiffre
 * Rajdhani or, glow discret de donnée, chiffres tabulaires. À sa droite : une
 * unité optionnelle (« /100 », « s ») + un libellé court, et un fait de tendance
 * facultatif (jamais une prescription).
 *
 * Code couleur : or = donnée (par défaut). Le glow est un halo de donnée, pas une
 * alarme. Le `tone` permet une donnée ambre (marge serrée) — JAMAIS le rouge de
 * marque. La tendance positive est verte, la négative reste neutre (crème) : on
 * n'alarme pas le pilote, on l'informe.
 */

import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme/v2';

const { palette, fonts, spacing } = theme;

export interface KingNumberProps {
  /** Valeur déjà formatée (ex. « 0,4 », « 73 »). Le composant ne calcule rien. */
  value: string;
  /** Unité / dénominateur à droite du chiffre (ex. « s », « /100 »). */
  unit?: string;
  /** Libellé court sous l'unité (ex. « RÉGULARITÉ », « QDI »). */
  label?: string;
  /** Fait de tendance facultatif (ex. « +3 vs médiane »). Descriptif, jamais un ordre. */
  trend?: string;
  /** Tendance positive → vert ; sinon crème neutre. Défaut : neutre. */
  trendPositive?: boolean;
  /** Couleur du chiffre : « gold » (donnée, défaut) ou « amber » (marge serrée). */
  tone?: 'gold' | 'amber';
}

export function KingNumber({
  value,
  unit,
  label,
  trend,
  trendPositive = false,
  tone = 'gold',
}: KingNumberProps) {
  const color = tone === 'amber' ? palette.pilotAmber : palette.gold;

  return (
    <View style={s.row}>
      <View style={s.numberRow}>
        <Text
          style={[s.number, { color, textShadowColor: withAlpha(color) }]}
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

/** Halo de donnée du chiffre roi (glow doux, non alarmant). */
function withAlpha(hex: string): string {
  // Or #FFB703 → glow ambré ; ambre #F2792B → glow ambré. On garde une opacité
  // fixe et discrète, cohérente avec le canon (donnée = chaleur, pas alarme).
  return hex === palette.gold ? 'rgba(255,183,3,0.38)' : 'rgba(242,121,43,0.34)';
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  numberRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  number: {
    fontFamily: fonts.king, // Rajdhani — chiffre roi
    fontSize: 66,
    lineHeight: 60,
    letterSpacing: -1,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 26,
    // fontVariant tabulaire : les chiffres ne dansent pas quand la valeur change.
    fontVariant: ['tabular-nums'],
  },
  side: { justifyContent: 'flex-end', paddingBottom: 8, gap: 2 },
  unit: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: palette.faint,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
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
