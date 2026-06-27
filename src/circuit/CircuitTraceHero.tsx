/**
 * CircuitTraceHero — le tracé 3D en héros d'un écran de restitution (specs v4 §05 §4.1).
 *
 * Récupère les insights de la session (s'ils existent) et rend <CircuitTrace> avec
 * couche par défaut Régularité. Tant que `telemetry_frames` est vide (avant Valence),
 * la plupart des sessions n'ont pas d'insights → seule la couche « Tracé » s'affiche
 * (la forme du circuit, honnête — on ne fabrique aucune donnée).
 *
 * Géométrie : lue depuis `circuits.centerline_latlon` (table de production) et
 * convertie en ruban via generateCircuit(). Repli immédiat sur la fixture OSM
 * statique (Haute Saintonge) tant que la base n'a pas répondu — aucun écran vide.
 */

import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import {
  fetchDefaultCircuitCenterline,
  fetchSessionCircuitCenterline,
} from '@/services/circuitsService';
import { fetchSessionInsights } from '@/services/sessionInsightsService';

import { CircuitTrace } from './CircuitTrace';
import { generateCircuit } from './circuitGenerator';
import { HAUTE_SAINTONGE_POINTS } from './hauteSaintonge';
import { COACH_LAYERS, PILOT_LAYERS, type LayerId } from './layers';
import type { SessionInsights } from './sessionInsights';

export interface CircuitTraceHeroProps {
  sessionId?: string;
  height?: number;
  /** Couche affichée par défaut (selon l'écran : Régularité en 20.1, Vitesse d'apex en 20.2). */
  defaultLayer?: LayerId;
  /** Rôle : 'coach' débloque les couches comparatives attribuées au coach. */
  role?: 'pilot' | 'coach';
}

export function CircuitTraceHero({
  sessionId,
  height = 340,
  defaultLayer,
  role = 'pilot',
}: CircuitTraceHeroProps) {
  // Repli immédiat (tracé statique) puis bascule sur la géométrie réelle de `circuits`.
  const fallbackCircuit = useMemo(() => generateCircuit(HAUTE_SAINTONGE_POINTS), []);
  const [circuit, setCircuit] = useState(fallbackCircuit);
  useEffect(() => {
    let cancelled = false;
    const load = sessionId
      ? fetchSessionCircuitCenterline(sessionId)
      : fetchDefaultCircuitCenterline();
    load
      .then((points) => {
        if (!cancelled && points) setCircuit(generateCircuit(points));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const [session, setSession] = useState<SessionInsights | null>(null);
  const [loading, setLoading] = useState<boolean>(!!sessionId);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchSessionInsights(sessionId)
      .then((s) => {
        if (!cancelled) {
          setSession(s);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <View style={[styles.wrapper, { height }]}>
      <CircuitTrace
        circuit={circuit}
        session={session}
        role={role}
        layers={role === 'coach' ? COACH_LAYERS : PILOT_LAYERS}
        height={height}
        defaultLayer={defaultLayer}
      />
      {loading ? (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator color="#A1A1AA" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#050505' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
