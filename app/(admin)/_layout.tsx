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
 *
 * ===========================================================================
 * SECOND FACTEUR — LE 12/08/2026
 * ===========================================================================
 *
 * La politique annonce une « authentification forte pour les comptes
 * administrateurs ». Zéro facteur enrôlé, vérifié en production. Deux gardes
 * sont posées, et leur asymétrie est délibérée :
 *
 *   · un compte QUI A un facteur mais dont la session ne l'a pas présenté est
 *     BARRÉ jusqu'à ce qu'il le présente ;
 *   · un compte SANS facteur est AVERTI, jamais barré.
 *
 * Barrer les comptes sans facteur fermerait l'espace admin à tout le monde
 * d'un seul coup — les trois comptes sont dans ce cas — et priverait chacun de
 * l'écran depuis lequel on en pose un. La garde se resserre d'elle-même à
 * mesure que les comptes s'enrôlent, ce qui est le seul ordre praticable.
 *
 * Et elle NE SE FERME PAS SUR UNE PANNE : `doitPresenterFacteur` rend `false`
 * quand le niveau est illisible. C'est exactement le défaut que le garde de
 * profil ci-dessous a déjà connu, et il n'a pas à être reproduit une seconde
 * fois à l'étage du dessus.
 */

import { useEffect, useState } from 'react';
import { Redirect, Stack, usePathname } from 'expo-router';

import { ProfilIndisponible } from '@/components/ProfilIndisponible';
import { SecondFacteurRequis } from '@/components/SecondFacteurRequis';
import { estAdmin } from '@/services/accesLogic';
import {
  doitPresenterFacteur,
  lireNiveauAssurance,
  type NiveauAssurance,
} from '@/services/mfaService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';

export default function AdminLayout() {
  const profile = useAuthStore((s) => s.profile);
  const profilIndisponible = useAuthStore((s) => s.profilIndisponible);
  const pathname = usePathname();

  const [niveau, setNiveau] = useState<NiveauAssurance>({ courant: null, requis: null });
  useEffect(() => {
    let annule = false;
    void lireNiveauAssurance().then((n) => {
      if (!annule) setNiveau(n);
    });
    return () => {
      annule = true;
    };
  }, [profile?.id]);

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

  // L'écran de sécurité reste TOUJOURS atteignable : c'est de là qu'on pose ou
  // qu'on retire un facteur, et s'en fermer l'accès rendrait la garde
  // irréparable depuis l'application.
  const surSecurite = pathname?.includes('/securite') === true;

  if (!surSecurite && doitPresenterFacteur(niveau)) {
    return <SecondFacteurRequis />;
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
