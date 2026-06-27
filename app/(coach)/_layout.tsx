/**
 * Layout coach OXV — section bleu nuit réservée aux coachs.
 *
 * Guard : redirige vers /(app) si le user n'est pas role='coach'.
 * Les sous-routes portent un accent distinct pour repérer visuellement
 * la section coach.
 */

import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';

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
        contentStyle: { backgroundColor: theme.palette.night },
        animation: 'fade',
      }}
    />
  );
}
