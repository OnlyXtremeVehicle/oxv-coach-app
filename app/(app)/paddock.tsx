/**
 * Écran #07 — Vous y êtes.
 *
 * Déclenché par géolocalisation à l'arrivée au circuit (état S5 → S7).
 * Pour V1 sans détection auto fiable, l'écran reste navigable manuellement
 * depuis le debug-capture ou un deep link.
 */

import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { getDefaultCircuit } from '@/services/circuitsService';
import { useEffect, useState } from 'react';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

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
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
        paddingHorizontal: spacing.xl,
      }}
    >
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text
          style={[typography.eyebrow, { marginBottom: spacing.lg, color: colors.text.tertiary }]}
        >
          BIENVENUE
        </Text>
        <Text
          style={{
            color: colors.text.primary,
            fontSize: fontSize.display,
            fontWeight: fontWeight.ultralight,
            lineHeight: fontSize.display * 1.15,
            marginBottom: spacing.xl,
          }}
        >
          Vous y êtes.
        </Text>
        <Text style={[typography.manifest, { color: colors.text.secondary }]}>{circuitName}.</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/(app)/equipement')}
        style={({ pressed }) => ({
          height: 52,
          borderRadius: borderRadius.lg,
          backgroundColor: colors.accent.red,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.xl,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text
          style={{
            color: colors.text.primary,
            fontSize: fontSize.body,
            fontWeight: fontWeight.medium,
            letterSpacing: 0.5,
          }}
        >
          Jumeler mon équipement
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}
