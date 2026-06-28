/**
 * Écran de debug : prévisualisation du tracé 3D <CircuitTrace> sur le circuit
 * de démo Haute Saintonge (7 virages). Sert à valider l'ALLURE du rendu sur un
 * build de dev (règle 9 : validation visuelle manuelle, pas de device côté Claude).
 *
 * Données = géométrie générée localement (pas de branchement session_insights ici).
 */

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';

import { CircuitTrace } from '@/circuit/CircuitTrace';
import { generateCircuit } from '@/circuit/circuitGenerator';
import { HAUTE_SAINTONGE_POINTS } from '@/circuit/hauteSaintonge';
import { DEMO_SESSION_INSIGHTS } from '@/circuit/sessionInsights';
import { theme } from '@/theme/v2';

const { palette, fonts, fontSize, spacing } = theme;

export default function DebugCircuitScreen() {
  // Écran de debug : inaccessible en production (deep-link inclus).
  if (!__DEV__) return <Redirect href={'/(app)' as never} />;
  return <DebugCircuitScreenInner />;
}

function DebugCircuitScreenInner() {
  const circuit = useMemo(() => generateCircuit(HAUTE_SAINTONGE_POINTS), []);

  return (
    <View style={styles.root}>
      <CircuitTrace circuit={circuit} session={DEMO_SESSION_INSIGHTS} role="pilot" />

      <SafeAreaView style={styles.hud} pointerEvents="none">
        <Text style={styles.eyebrow}>CIRCUIT</Text>
        <Text style={styles.title}>Haute Saintonge</Text>
        <Text style={styles.meta}>
          {(circuit.length_m / 1000).toFixed(2)} km · {circuit.corners.length} virages
        </Text>
      </SafeAreaView>

      <Text style={styles.attribution}>© contributeurs OpenStreetMap</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.night },
  hud: { position: 'absolute', top: 0, left: 0, padding: spacing.xl },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: palette.faint,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.h2,
    letterSpacing: 2,
    color: palette.cream,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  meta: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.4,
    color: palette.creamMute,
    marginTop: spacing.sm,
  },
  attribution: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.xl,
    fontFamily: fonts.mono,
    fontSize: fontSize.micro,
    color: palette.faint,
  },
});
