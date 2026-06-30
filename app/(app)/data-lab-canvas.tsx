/**
 * Data Lab — Vue unifiée (Skia). APERÇU TECHNIQUE, à valider au build.
 *
 * Câble DataLabCanvas (rendu natif Skia) DERRIÈRE une garde Expo Go : Skia
 * n'est pas présent dans Expo Go. Le composant est donc chargé par un require()
 * SYNCHRONE et UNIQUEMENT hors Expo Go (même pattern que `bluetoothService`
 * pour react-native-ble-plx, cf. `src/lib/runtime.ts`). Aucun import statique
 * de Skia dans ce module de route : il serait évalué au démarrage (expo-router
 * charge les routes) et planterait l'aperçu. En Expo Go → repli honnête ; la
 * carte SVG (`carte.tsx`) reste la vue de référence.
 *
 * Doctrine : sobre, vouvoiement, pas d'emoji ; couleurs de donnée (jamais un
 * verdict) ; état vide honnête tant que les trames du boîtier manquent.
 */

import { useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';

import type { CanvasLayer, CanvasTrajectoryPoint } from '@/components/DataLabCanvas';
import { EmptyState } from '@/components/instruments';
import { isExpoGo } from '@/lib/runtime';
import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Screen } from '@/ui/Screen';

/**
 * Charge DataLabCanvas hors Expo Go uniquement. Le require() n'est exécuté que
 * si l'on n'est pas dans Expo Go → le module Skia n'est jamais évalué dans
 * l'aperçu. Typé via `typeof import` (type-only, n'évalue rien).
 */
function loadCanvas(): typeof import('@/components/DataLabCanvas').DataLabCanvas | null {
  if (isExpoGo()) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod =
    require('../../src/components/DataLabCanvas') as typeof import('@/components/DataLabCanvas');
  return mod.DataLabCanvas;
}

const LAYERS: { key: CanvasLayer; label: string }[] = [
  { key: 'trace', label: 'Tracé' },
  { key: 'vitesse', label: 'Vitesse' },
];

export default function DataLabCanvasScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const { width } = useWindowDimensions();
  const [trajectory, setTrajectory] = useState<CanvasTrajectoryPoint[] | null>(null);
  const [layer, setLayer] = useState<CanvasLayer>('trace');

  // Composant Skia (ou null en Expo Go). Mémoïsé : require une seule fois.
  const Canvas = useMemo(loadCanvas, []);

  useEffect(() => {
    if (!params.sessionId) return;
    const sessionId = params.sessionId; // narrow avant closure async
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('telemetry_frames')
        .select('latitude, longitude, speed_kmh')
        .eq('session_id', sessionId)
        .order('elapsed_ms', { ascending: true })
        .limit(1000);
      if (cancelled || !data) return;
      const points: CanvasTrajectoryPoint[] = (
        data as { latitude: number | null; longitude: number | null; speed_kmh: number | null }[]
      )
        .filter((p) => p.latitude !== null && p.longitude !== null)
        .map((p) => ({
          lat: Number(p.latitude),
          lon: Number(p.longitude),
          speed: p.speed_kmh !== null ? Number(p.speed_kmh) : null,
        }));
      if (points.length > 1) setTrajectory(points);
    })();
    return () => {
      cancelled = true;
    };
  }, [params.sessionId]);

  const canvasSize = Math.min(width - theme.spacing.lg * 2, 480);

  return (
    <Screen>
      <AppBar title="VUE UNIFIÉE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>APERÇU TECHNIQUE</Text>
        <Text style={s.title} accessibilityRole="header">
          Le tracé, d’un seul tenant.
        </Text>
        <Text style={s.intro}>
          Le circuit et votre trajectoire sur une même vue. La carte détaillée reste la référence
          tant que cette vue n’est pas validée sur un build de l’app.
        </Text>

        <View style={s.layerRow} accessibilityRole="tablist">
          {LAYERS.map((l) => {
            const active = l.key === layer;
            return (
              <Pressable
                key={l.key}
                onPress={() => setLayer(l.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[s.layerPill, active ? s.layerPillActive : null]}
              >
                <Text style={[s.layerText, active ? s.layerTextActive : null]}>{l.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[s.canvasWrap, { minHeight: canvasSize }]}>
          {Canvas ? (
            <Canvas
              trajectory={trajectory ?? undefined}
              layer={layer}
              width={canvasSize}
              height={canvasSize}
            />
          ) : (
            <EmptyState
              label="Aperçu indisponible ici"
              message="Cette vue utilise un rendu natif. Elle s’affiche dans un build de l’app, pas dans l’aperçu Expo Go."
            />
          )}
        </View>

        {Canvas && !trajectory ? (
          <Text style={s.muted}>
            Sans trames de boîtier pour cette séance, seule la forme du circuit s’affiche.
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
    marginTop: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
    marginTop: theme.spacing.md,
  },
  intro: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.6,
    marginTop: theme.spacing.md,
  },
  layerRow: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xl,
  },
  layerPill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.palette.line,
    minHeight: 44,
    justifyContent: 'center' as const,
  },
  layerPillActive: {
    borderColor: theme.palette.edge,
    backgroundColor: theme.palette.card2,
  },
  layerText: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.6,
    color: theme.palette.creamMute,
  },
  layerTextActive: {
    color: theme.palette.cream,
  },
  canvasWrap: {
    marginTop: theme.spacing.xl,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  muted: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.5,
    marginTop: theme.spacing.lg,
    textAlign: 'center' as const,
  },
};
