/**
 * Hook permissions modulaires du coach (§8.1).
 *
 * Charge les permissions du coach courant au montage. Expose un état de
 * chargement + les flags. Tant que ça charge, on renvoie les permissions
 * de base (fail-safe : pas d'accès avancé affiché par erreur).
 */

import { useEffect, useState } from 'react';

import {
  type CoachPermissions,
  DEFAULT_COACH_PERMISSIONS,
  loadMyCoachPermissions,
} from '@/services/coachPermissionsService';

export function useCoachPermissions(): { permissions: CoachPermissions; loading: boolean } {
  const [permissions, setPermissions] = useState<CoachPermissions>(DEFAULT_COACH_PERMISSIONS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadMyCoachPermissions()
      .then((p) => {
        if (!cancelled) {
          setPermissions(p);
          setLoading(false);
        }
      })
      .catch(() => {
        // Fail-safe : on conserve les permissions de base et on sort du loading.
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { permissions, loading };
}
