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
  const status = useAuthStore((s) => s.status);

  // Se déconnecter depuis cet espace remettait `profile` à null, et ce layout
  // ne rendait plus rien : écran noir définitif, sans porte de sortie, jusqu'à
  // ce que l'application soit tuée. Rien ne renavigue tout seul — `app/index.tsx`
  // n'est pas monté quand la route courante est /(partner).
  // `status` est la seule source qui distingue « déconnecté » de « profil pas
  // encore lu ». Même garde que app/(app2)/_layout.tsx.
  if (status === 'unauthenticated') {
    return <Redirect href={'/(auth)/login' as never} />;
  }

  if (!profile) return null;
  if (profile.role !== 'partner') {
    return <Redirect href={'/(app2)' as never} />;
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
