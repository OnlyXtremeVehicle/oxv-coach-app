/**
 * Layout admin OXV — section bronze réservée au staff.
 *
 * Guard : redirige vers l'espace pilote si le compte n'est pas administrateur.
 * Les sous-routes portent un accent distinct du mode pilote pour
 * repérer visuellement la section staff.
 *
 * Le garde lisait `profile.is_admin` seul, là où la base admet
 * `role = 'admin' OR is_admin = true`. Deux comptes de production tombaient dans
 * l'écart : la RLS leur accorde tout, ce seuil les refoulait. La question a
 * désormais une seule réponse, dans `src/services/accesLogic.ts`.
 */

import { Redirect, Stack } from 'expo-router';

import { estAdmin } from '@/services/accesLogic';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';

export default function AdminLayout() {
  const profile = useAuthStore((s) => s.profile);

  if (!estAdmin(profile)) {
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
