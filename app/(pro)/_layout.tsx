/**
 * Layout pilote professionnel — espace réservé aux comptes `role='pro_pilot'`.
 *
 * Guard strict : redirige vers /(app) si le user n'est pas pilote pro. Le pilote
 * pro est un pilote (mêmes données, mêmes RLS own-row) avec un espace distinct
 * et des outils renforcés. Les écrans data restent partagés avec l'espace pilote.
 */

import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';

export default function ProPilotLayout() {
  const profile = useAuthStore((s) => s.profile);

  if (!profile) return null;
  if (profile.role !== 'pro_pilot') {
    return <Redirect href="/(app)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.palette.night },
        animation: 'fade',
      }}
    />
  );
}
