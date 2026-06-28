/**
 * Layout partenaire OXV — espace réservé aux comptes `role='partner'`.
 *
 * Guard STRICT : redirige vers /(app) si le user n'est pas partenaire. Séparation
 * nette pilote / partenaire / admin. Le partenaire ne voit jamais la télémétrie
 * (garanti par la RLS, aucune policy partenaire sur `telemetry_*`).
 */

import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';

export default function PartnerLayout() {
  const profile = useAuthStore((s) => s.profile);

  if (!profile) return null;
  if (profile.role !== 'partner') {
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
