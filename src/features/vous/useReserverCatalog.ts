/**
 * Hook du catalogue de réservation (lot V2-L4, mission D, flux A1 — écran 1/3).
 *
 * Vérifie d'abord le drapeau `app_payments` (fail-closed via isFlagEnabled) :
 *   - fermé → on ne lit AUCUNE donnée de réservation, on récupère seulement le
 *     compteur fondateurs pour l'écran « Réservations à l'ouverture » ;
 *   - ouvert → on charge les journées via bookingCatalogService (SELECT only).
 * L'événement de tunnel `reserve_funnel_1` part une fois l'accès résolu, ouvert
 * OU fermé (mesurer l'intention AVANT l'ouverture, cf. brief).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { trackEvent } from '@/services/analyticsService';
import {
  BOOKING_FLAG_KEY,
  RESERVE_FUNNEL_EVENTS,
  resolveBookingAccess,
  type BookingAccess,
} from '@/services/bookingCatalogLogic';
import { listAvailableDays, type AvailableDay } from '@/services/bookingCatalogService';
import { getFoundersCount } from '@/services/v2/founderService';
import { isFlagEnabled } from '@/services/featureFlagsService';

type Phase = 'checking' | 'ready' | 'error';

export interface ReserverCatalogState {
  access: BookingAccess | null;
  phase: Phase;
  /** Flag `founders` (fail-closed) : gate la jauge/CTA de l'écran fermé. */
  foundersEnabled: boolean;
  /** Compteur fondateurs réel, ou null si inconnu (jauge masquée). */
  foundersCount: number | null;
  days: AvailableDay[];
  refreshing: boolean;
}

export function useReserverCatalog() {
  const [state, setState] = useState<ReserverCatalogState>({
    access: null,
    phase: 'checking',
    foundersEnabled: false,
    foundersCount: null,
    days: [],
    refreshing: false,
  });
  const tracked = useRef(false);

  const load = useCallback(async (isRefresh: boolean) => {
    setState((s) => ({ ...s, refreshing: isRefresh, phase: isRefresh ? s.phase : 'checking' }));
    try {
      const flag = await isFlagEnabled(BOOKING_FLAG_KEY);
      const access = resolveBookingAccess(flag);
      if (!tracked.current) {
        tracked.current = true;
        trackEvent(RESERVE_FUNNEL_EVENTS.catalog, { access });
      }
      if (access === 'closed') {
        // Le programme fondateur a son propre drapeau : jauge/CTA seulement si ON.
        const foundersEnabled = await isFlagEnabled('founders');
        const foundersCount = foundersEnabled ? await getFoundersCount() : null;
        setState((s) => ({
          ...s,
          access,
          phase: 'ready',
          foundersEnabled,
          foundersCount,
          refreshing: false,
        }));
        return;
      }
      const days = await listAvailableDays();
      setState((s) => ({ ...s, access, phase: 'ready', days, refreshing: false }));
    } catch {
      setState((s) => ({ ...s, phase: 'error', refreshing: false }));
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return { state, refresh };
}
