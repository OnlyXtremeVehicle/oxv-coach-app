/**
 * Hook du détail d'une journée de réservation (lot V2-L4, mission D — écran 2/3).
 *
 * Même gating que le catalogue (drapeau `app_payments`, fail-closed). Fermé →
 * compteur fondateurs seul. Ouvert → getDay (SELECT only) + sélection d'offre
 * locale. Tunnel : `reserve_funnel_2` une fois l'accès résolu.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { trackEvent } from '@/services/analyticsService';
import {
  BOOKING_FLAG_KEY,
  RESERVE_FUNNEL_EVENTS,
  resolveBookingAccess,
  type BookingAccess,
  type OfferKey,
} from '@/services/bookingCatalogLogic';
import { getDay, type AvailableDay } from '@/services/bookingCatalogService';
import { getFoundersCount } from '@/services/v2/founderService';
import { isFlagEnabled } from '@/services/featureFlagsService';

type Phase = 'checking' | 'ready' | 'error';

export interface ReserverDayState {
  access: BookingAccess | null;
  phase: Phase;
  /** Flag `founders` (fail-closed) : gate la jauge/CTA de l'écran fermé. */
  foundersEnabled: boolean;
  /** Compteur fondateurs réel, ou null si inconnu (jauge masquée). */
  foundersCount: number | null;
  day: AvailableDay | null;
  selectedOffer: OfferKey | null;
}

export function useReserverDay(sessionId: string | undefined) {
  const [state, setState] = useState<ReserverDayState>({
    access: null,
    phase: 'checking',
    foundersEnabled: false,
    foundersCount: null,
    day: null,
    selectedOffer: null,
  });
  const tracked = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, phase: 'checking' }));
      try {
        const flag = await isFlagEnabled(BOOKING_FLAG_KEY);
        const access = resolveBookingAccess(flag);
        if (!tracked.current) {
          tracked.current = true;
          trackEvent(RESERVE_FUNNEL_EVENTS.day, { access });
        }
        if (access === 'closed') {
          const foundersEnabled = await isFlagEnabled('founders');
          const foundersCount = foundersEnabled ? await getFoundersCount() : null;
          if (!cancelled)
            setState((s) => ({ ...s, access, phase: 'ready', foundersEnabled, foundersCount }));
          return;
        }
        const day = sessionId ? await getDay(sessionId) : null;
        if (!cancelled)
          setState((s) => ({
            ...s,
            access,
            phase: 'ready',
            day,
            // Pré-sélection : la première offre disponible (récap prix immédiat).
            selectedOffer: day?.offers[0]?.key ?? null,
          }));
      } catch {
        if (!cancelled) setState((s) => ({ ...s, phase: 'error' }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const selectOffer = useCallback((key: OfferKey) => {
    setState((s) => ({ ...s, selectedOffer: key }));
  }, []);

  return { state, selectOffer };
}
