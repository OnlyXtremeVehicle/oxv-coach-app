/**
 * Hook du récap de paiement (lot V2-L4, mission D, flux A1 — écran 3/3).
 *
 * Même gating drapeau `app_payments` (fail-closed). Ouvert → getDay (SELECT
 * only) + résolution de l'offre passée en paramètre. Tunnel `reserve_funnel_3`
 * une fois l'accès résolu. Le paiement lui-même reste INERTE dans ce lot
 * (structure prête, Stripe/IAP branchés au lot A1-ON).
 */

import { useEffect, useRef, useState } from 'react';

import { trackEvent } from '@/services/analyticsService';
import {
  BOOKING_FLAG_KEY,
  RESERVE_FUNNEL_EVENTS,
  resolveBookingAccess,
  type BookingAccess,
} from '@/services/bookingCatalogLogic';
import { getDay, type AvailableDay, type AvailableOffer } from '@/services/bookingCatalogService';
import { getFoundersCount } from '@/services/v2/founderService';
import { isFlagEnabled } from '@/services/featureFlagsService';

type Phase = 'checking' | 'ready' | 'error';

export interface ReserverPaymentState {
  access: BookingAccess | null;
  phase: Phase;
  foundersCount: number;
  day: AvailableDay | null;
  offer: AvailableOffer | null;
}

export function useReserverPayment(sessionId: string | undefined, offerKey: string | undefined) {
  const [state, setState] = useState<ReserverPaymentState>({
    access: null,
    phase: 'checking',
    foundersCount: 0,
    day: null,
    offer: null,
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
          trackEvent(RESERVE_FUNNEL_EVENTS.payment, { access });
        }
        if (access === 'closed') {
          const foundersCount = await getFoundersCount();
          if (!cancelled) setState((s) => ({ ...s, access, phase: 'ready', foundersCount }));
          return;
        }
        const day = sessionId ? await getDay(sessionId) : null;
        const offer = day?.offers.find((o) => o.key === offerKey) ?? day?.offers[0] ?? null;
        if (!cancelled) setState((s) => ({ ...s, access, phase: 'ready', day, offer }));
      } catch {
        if (!cancelled) setState((s) => ({ ...s, phase: 'error' }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, offerKey]);

  return { state };
}
