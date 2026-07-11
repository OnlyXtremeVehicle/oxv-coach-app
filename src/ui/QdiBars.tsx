/**
 * QdiBars — aperçu QDI en 5 barres colorées (refonte V3, handoff §7.1 Paddock).
 *
 * Un mini-graphe : une barre par branche (Trajectoire · Fluidité · Freinage ·
 * Accélération · Régularité), hauteur = valeur 0-100, dans la COULEUR de la
 * branche. La branche la plus haute peut porter un discret « point fort » au-
 * dessus. Aucun chiffre : c'est une silhouette, pas un score. Un libellé coloré
 * court sous chaque barre. Une branche null → barre au ras (données absentes).
 */

import { StyleSheet, Text, View } from 'react-native';

import type { QdiBranches } from '@/services/qdiLogic';
import { theme } from '@/theme/v2';

const { dataColors, palette, fonts } = theme;

const BRANCHES: { key: keyof QdiBranches; short: string; color: string }[] = [
  { key: 'trajectoire', short: 'TRAJ', color: dataColors.trajectory },
  { key: 'fluidite', short: 'FLUI', color: dataColors.flow },
  { key: 'freinage', short: 'FREIN', color: dataColors.brake },
  { key: 'acceleration', short: 'ACCÉL', color: dataColors.accel },
  { key: 'regularite', short: 'RÉGUL', color: dataColors.regularity },
];

export function QdiBars({
  branches,
  height = 72,
  highlightStrongest = true,
}: {
  branches: QdiBranches;
  /** Hauteur de la zone des barres (px). */
  height?: number;
  /** Marque la branche la plus haute d'un « point fort ». */
  highlightStrongest?: boolean;
}) {
  const values = BRANCHES.map((b) => branches[b.key]);
  // Indice de la branche la plus forte (parmi celles qui ont une valeur).
  let strongest = -1;
  let max = -1;
  values.forEach((v, i) => {
    if (typeof v === 'number' && v > max) {
      max = v;
      strongest = i;
    }
  });

  return (
    <View
      style={s.wrap}
      accessibilityRole="image"
      accessibilityLabel="Aperçu QDI : cinq branches de conduite"
    >
      <View style={[s.bars, { height }]}>
        {BRANCHES.map((b, i) => {
          const v = values[i];
          const pct = typeof v === 'number' ? Math.max(4, Math.min(100, v)) : 3;
          const strong = highlightStrongest && i === strongest;
          return (
            <View key={b.key} style={s.col}>
              {strong ? <Text style={[s.strong, { color: b.color }]}>point fort</Text> : null}
              <View style={s.track}>
                <View
                  style={{
                    height: `${pct}%`,
                    backgroundColor: typeof v === 'number' ? b.color : palette.line,
                    borderRadius: 3,
                    width: '100%',
                  }}
                />
              </View>
            </View>
          );
        })}
      </View>
      <View style={s.labels}>
        {BRANCHES.map((b) => (
          <Text key={b.key} style={[s.label, { color: b.color }]}>
            {b.short}
          </Text>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { width: '100%' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  col: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  track: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  strong: {
    fontFamily: fonts.mono,
    fontSize: 8,
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  labels: { flexDirection: 'row', gap: 10, marginTop: 6 },
  label: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 8.5,
    letterSpacing: 0.6,
    textAlign: 'center',
  },
});
