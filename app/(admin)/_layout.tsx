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

import { ProfilIndisponible } from '@/components/ProfilIndisponible';
import { estAdmin } from '@/services/accesLogic';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';

export default function AdminLayout() {
  const profile = useAuthStore((s) => s.profile);
  const profilIndisponible = useAuthStore((s) => s.profilIndisponible);

  // LE SEUIL AVAIT DEUX RÉPONSES LÀ OÙ L'ÉTAT EN A TROIS.
  //
  // `estAdmin(null)` vaut `false`, et le rafraîchissement de jeton fabrique ce
  // `null` dès qu'une lecture échoue — toutes les heures, sur la 4G du circuit.
  // L'administrateur était donc éjecté en plein pointage, sans un mot, et sa
  // porte de retour disparaissait au même instant.
  if (profilIndisponible) {
    return <ProfilIndisponible />;
  }

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
