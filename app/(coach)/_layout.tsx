/**
 * Layout coach OXV — section bleu nuit réservée aux coachs.
 *
 * Guard : redirige vers /(app) si le user n'est pas role='coach'.
 * Toutes les sous-routes utilisent `colors.accent.coach` (#1E3A5F) comme
 * accent principal pour distinguer visuellement du mode pilote (rouge)
 * et du mode admin (bronze).
 */

import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/store/useAuthStore';
import { colors } from '@/theme/tokens';

export default function CoachLayout() {
  const profile = useAuthStore((s) => s.profile);

  if (!profile) return null;
  if (profile.role !== 'coach') {
    return <Redirect href="/(app)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background.primary },
        animation: 'fade',
      }}
    />
  );
}
