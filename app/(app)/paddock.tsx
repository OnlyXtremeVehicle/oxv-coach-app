/**
 * Écran #07 — Vous y êtes. Design V2 (charte oxv-mirror-app).
 *
 * Déclenché par géolocalisation à l'arrivée au circuit (état S5 → S7).
 * Pour V1 sans détection auto fiable, l'écran reste navigable manuellement
 * depuis le debug-capture ou un deep link.
 *
 * Reskin V2 : Screen + AppBar, titres Syncopate, Button du kit. Écran d'état
 * de flux sans retour manuel — pas de onBack. Logique inchangée.
 */

import { Text, View } from 'react-native';
import { router } from 'expo-router';

import { getDefaultCircuit } from '@/services/circuitsService';
import { useEffect, useState } from 'react';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';

export default function PaddockScreen() {
  const [circuitName, setCircuitName] = useState<string>('Circuit de Haute Saintonge');

  useEffect(() => {
    let cancelled = false;
    getDefaultCircuit().then((c) => {
      if (!cancelled && c) setCircuitName(c.name);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Screen scroll={false}>
      <AppBar title="PADDOCK" />
      <View
        style={{ flex: 1, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}
      >
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={s.eyebrow}>BIENVENUE</Text>
          <Text style={s.title}>Vous y êtes.</Text>
          <Text style={s.manifest}>{circuitName}.</Text>
        </View>

        <Button label="Jumeler mon équipement" onPress={() => router.push('/(app)/equipement')} />
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
    color: theme.palette.creamMute,
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.display,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.display * 1.15,
    marginBottom: theme.spacing.xl,
  },
  manifest: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: theme.palette.creamSoft,
  },
};
