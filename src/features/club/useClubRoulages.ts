/**
 * useClubRoulages — chargement de l'onglet ROULAGES (lot V2-L5, Mission B).
 *
 * Services EXISTANTS uniquement (le lot n'en crée aucun) :
 *   - roulagesService.listMyInvitations (RLS : le pilote ne voit que les
 *     siennes) + respondToInvitation (accepter / décliner) ;
 *   - pilotConsentService.listMyCoaches (résolution nom/initiales du coach).
 *
 * Toutes les décisions (tri, classement à venir/historique, « roulé ensemble
 * ×{n} ») vivent dans `roulagesLogic` (pur, testé). Le hook ne fait que l'I/O
 * et l'état. Aucune valeur affichée n'est fabriquée : absent = section vide.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { listMyCoaches } from '@/services/pilotConsentService';
import { listMyInvitations, respondToInvitation } from '@/services/roulagesService';

import {
  buildRoulagesView,
  type CoachRef,
  type PilotInvitationPair,
  type RoulagesView,
} from './roulagesLogic';

const EMPTY_VIEW: RoulagesView = { pending: [], history: [], rolledTogether: [] };

export interface ClubRoulages {
  status: 'loading' | 'ready' | 'error';
  view: RoulagesView;
  /** Invitation en cours de réponse (bouton occupé), ou null. */
  busyId: string | null;
  /** Accepter / décliner une invitation, puis recharger. */
  respond: (invitationId: string, accepted: boolean) => Promise<void>;
  reload: () => void;
}

export function useClubRoulages(): ClubRoulages {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [view, setView] = useState<RoulagesView>(EMPTY_VIEW);
  const [busyId, setBusyId] = useState<string | null>(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const [pairs, coaches] = await Promise.all([listMyInvitations(), listMyCoaches()]);
      const coachesById = new Map<string, CoachRef>(
        coaches.map((c): [string, CoachRef] => [
          c.coachId,
          {
            coachId: c.coachId,
            firstName: c.coachFirstName,
            lastName: c.coachLastName,
            email: c.coachEmail,
          },
        ])
      );
      if (!alive.current) return;
      setView(
        buildRoulagesView(pairs as PilotInvitationPair[], coachesById, new Date().toISOString())
      );
      setStatus('ready');
    } catch {
      if (alive.current) setStatus('error');
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    setStatus('loading');
    void load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  const respond = useCallback(
    async (invitationId: string, accepted: boolean) => {
      if (busyId) return;
      setBusyId(invitationId);
      try {
        await respondToInvitation(invitationId, accepted, new Date().toISOString());
        await load();
      } finally {
        if (alive.current) setBusyId(null);
      }
    },
    [busyId, load]
  );

  const reload = useCallback(() => {
    setStatus('loading');
    void load();
  }, [load]);

  return { status, view, busyId, respond, reload };
}
