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
 *
 * ---
 *
 * LA TAILLE DEMANDÉE N'EST PAS LA TAILLE RENDUE
 *
 * `size` est un SOUHAIT. Le composant le plafonne à 56 pt au-delà de 7
 * caractères (dossier de conception §IV.3) puis, si la largeur ne suffit pas,
 * replie sous ce plafond pour préserver la réserve de 10 %.
 *
 * Sans cela, `1:41,203` — huit glyphes — se serait fait tronquer sur iPhone SE.
 * Un texte tronqué ne lève aucune erreur : il s'affiche, amputé. Le calcul est
 * dans `src/theme/metriques.ts`, testé au banc sur les six largeurs logiques.
 */

import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { avanceMono, largeurUtile, tailleChiffreRoi } from '@/theme/metriques';
import { theme } from '@/theme/v2';

const { palette, fonts, spacing, monoVariant } = theme;

export interface KingNumberProps {
  /** Valeur déjà formatée, séparateur VIRGULE (ex. « 0,42 », « ±0,42 s », « 1:24,318 »). */
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
  /** Taille du chiffre (défaut 48, plage refonte 46-54). Plafonnée, voir plus bas. */
  size?: number;
  /**
   * Largeur réellement offerte au bloc, quand l'appelant la connaît (colonne,
   * feuille, carte). Omise → la largeur utile de l'écran, marges comprises.
   */
  largeurDisponible?: number;
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
  largeurDisponible,
}: KingNumberProps) {
  const resolved = color ?? (tone === 'amber' ? palette.pilotAmber : palette.gold);
  const { width } = useWindowDimensions();

  /**
   * TAILLE FINALE — plafond §IV.3 puis repli (`src/theme/metriques.ts`).
   *
   * Le plafond seul ne suffit pas : sur iPhone SE, `1:41,203` au plafond de
   * 56 pt occupe 96 % de la largeur utile. Il « rentre », sans la réserve de
   * 10 % qu'exige le dossier — c'est-à-dire qu'il touche le bord dès que la
   * fonte système se substitue à JetBrains Mono. Le repli descend alors sous le
   * plafond.
   *
   * La colonne de droite (unité + légende) est SOUSTRAITE du budget avant le
   * calcul : elle occupe une largeur réelle, et l'ignorer ferait déborder
   * l'ensemble alors que le chiffre seul tenait.
   */
  const colonne =
    unit || label
      ? Math.max(unit ? avanceMono(unit, 11) : 0, label ? avanceMono(label, 10, 1.6) : 0) +
        spacing.sm
      : 0;
  const tendance = trend ? avanceMono(trend, 11) + spacing.md : 0;
  const budget = (largeurDisponible ?? largeurUtile(width)) - colonne - tendance;
  const taille = tailleChiffreRoi(value, size, budget);

  return (
    <View style={s.row}>
      <View style={s.numberRow}>
        <Text
          style={[s.number, { color: resolved, fontSize: taille, lineHeight: taille * 0.96 }]}
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
    // Ligatures de code coupées (`calt`), voir `monoVariant` dans le thème.
    fontVariant: [...monoVariant],
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
