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

import { CircuitTrace } from '@/circuit/CircuitTrace';
import { generateCircuit } from '@/circuit/circuitGenerator';
import { HAUTE_SAINTONGE_POINTS } from '@/circuit/hauteSaintonge';
import { DEMO_SESSION_INSIGHTS } from '@/circuit/sessionInsights';

export default function DebugCircuitScreen() {
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
  root: { flex: 1, backgroundColor: '#050505' },
  hud: { position: 'absolute', top: 0, left: 0, padding: 24 },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 3,
    color: '#A1A1AA',
    fontVariant: ['small-caps'],
  },
  title: {
    fontSize: 22,
    letterSpacing: 2,
    color: '#F8F9FA',
    marginTop: 6,
    textTransform: 'uppercase',
  },
  meta: { marginTop: 10, fontSize: 12, color: '#A1A1AA' },
  attribution: {
    position: 'absolute',
    bottom: 20,
    left: 24,
    fontSize: 10,
    color: '#A1A1AA',
  },
});
