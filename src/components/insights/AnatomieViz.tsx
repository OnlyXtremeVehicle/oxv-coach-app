/**
 * AnatomieViz — Anatomie de virage (lecture N2.1).
 *
 * Maquette : docs/specs-bundle-v4/maquette_insight_N2-1_anatomie.html
 * Spec     : 02_moteur_insights.md §2.1.
 *
 * Décompose un virage en trois temps : freinage (bleu) / corde (rouge,
 * minimum de vitesse au pic de G latéral) / réaccélération (vert). Profil de
 * vitesse en SVG + trois cartouches chiffrées + trois lignes de phase.
 *
 * DÉMO : valeurs figées du virage 3 (95 m / 78 km/h / 140 m), telemetry_frames
 * vide jusqu'à Valence. Composant autonome, aucune télémétrie réelle.
 *
 * Doctrine : décrit le virage tel qu'il a été roulé. Aucune consigne.
 */

import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';

import { theme } from '@/theme/v2';

const C = theme.dataColors;

interface Phase {
  color: string;
  label: string;
  /** Le segment **…** sort en mono. */
  text: string;
  value: string;
}

// Données DÉMO du virage 3 (maquette N2-1).
const PHASES: Phase[] = [
  {
    color: C.brake,
    label: 'Freinage',
    text: 'Freinage sur **95 m**, de 182 à 78 km/h',
    value: '−1,08 g',
  },
  {
    color: C.trajectory,
    label: 'Corde',
    text: 'Vitesse mini à la corde : **78 km/h**',
    value: '1,12 g lat.',
  },
  {
    color: C.accel,
    label: 'Réaccél.',
    text: 'Réaccélération sur **140 m** jusqu’à la prochaine zone',
    value: '+0,74 g',
  },
];

const ZONES = [
  { label: 'Freinage', value: '95 m', color: C.brake, fill: 'rgba(96,165,250,0.10)' },
  { label: 'Corde', value: '78 km/h', color: C.trajectory, fill: 'rgba(230,57,70,0.10)' },
  { label: 'Réaccél.', value: '140 m', color: C.accel, fill: 'rgba(74,222,128,0.10)' },
];

export function AnatomieViz() {
  return (
    <View>
      <View style={styles.card}>
        <View style={styles.cap}>
          <Text style={styles.capText}>Virage 3 · profil de vitesse</Text>
          <Text style={styles.capText}>moyenne sur 18 tours</Text>
        </View>

        <Svg width="100%" height={120} viewBox="0 0 320 120">
          {/* Zones de fond : freinage / corde / réaccél. */}
          <Rect x={0} y={0} width={110} height={120} fill="rgba(96,165,250,0.06)" />
          <Rect x={110} y={0} width={60} height={120} fill="rgba(230,57,70,0.06)" />
          <Rect x={170} y={0} width={150} height={120} fill="rgba(74,222,128,0.06)" />
          {/* Courbe de vitesse : descend, plancher, remonte. */}
          <Path
            d="M6,20 C50,24 85,58 110,82 C130,98 145,98 170,86 C210,66 260,38 314,22"
            fill="none"
            stroke={theme.palette.cream}
            strokeWidth={2}
          />
          {/* Point de corde (minimum de vitesse). */}
          <Circle cx={140} cy={96} r={4} fill={C.trajectory} />
          <SvgText x={120} y={114} fontSize={8} fill={C.trajectory} fontFamily={theme.fonts.mono}>
            78 km/h
          </SvgText>
          <SvgText x={8} y={14} fontSize={8} fill={C.brake} fontFamily={theme.fonts.mono}>
            182 km/h
          </SvgText>
        </Svg>

        <View style={styles.zones}>
          {ZONES.map((z) => (
            <View key={z.label} style={[styles.zone, { backgroundColor: z.fill }]}>
              <Text style={styles.zoneLabel}>{z.label}</Text>
              <Text style={[styles.zoneValue, { color: z.color }]}>{z.value}</Text>
            </View>
          ))}
        </View>
      </View>

      {PHASES.map((p) => (
        <View key={p.label} style={styles.phase}>
          <View style={[styles.dot, { backgroundColor: p.color }]} />
          <Text style={styles.phaseText}>{renderEmphasis(p.text)}</Text>
          <Text style={styles.phaseValue}>{p.value}</Text>
        </View>
      ))}
    </View>
  );
}

/** Rend le segment **…** en mono crème (le chiffre = voix de l'instrument). */
function renderEmphasis(text: string) {
  return text.split('**').map((part, i) =>
    i % 2 === 1 ? (
      <Text key={`b${i}`} style={styles.phaseEm}>
        {part}
      </Text>
    ) : (
      <Text key={`t${i}`}>{part}</Text>
    )
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.palette.card,
    borderColor: theme.palette.line,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  cap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  capText: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
  },
  zones: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.md,
  },
  zone: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.sm,
  },
  zoneLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 8,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.palette.creamMute,
    marginBottom: theme.spacing.xs,
  },
  zoneValue: {
    fontFamily: theme.fonts.monoMedium,
    fontSize: 14,
  },
  phase: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.palette.card,
    borderColor: theme.palette.line,
    borderWidth: 1,
    borderRadius: theme.radius.sm,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  phaseText: {
    flex: 1,
    fontFamily: theme.fonts.bodyLight,
    fontSize: 13,
    color: theme.palette.creamSoft,
  },
  phaseEm: {
    fontFamily: theme.fonts.monoMedium,
    color: theme.palette.cream,
  },
  phaseValue: {
    fontFamily: theme.fonts.mono,
    fontSize: 12,
    color: theme.palette.creamMute,
  },
});
