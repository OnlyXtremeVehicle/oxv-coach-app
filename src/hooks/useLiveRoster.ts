/**
 * useLiveRoster — abonne le coach à la présence des pilotes en piste (P5).
 *
 * S'appuie sur liveSessionService.subscribeRoster (Supabase Realtime presence).
 * Retourne le roster réduit (pur, testé) + un drapeau `ready` (false tant que la
 * première synchro n'est pas arrivée) pour distinguer « connexion » de « personne
 * en piste ». Aucun classement — juste qui est là.
 */

import { useEffect, useState } from 'react';

import { type RosterEntry } from '@/services/liveSessionLogic';
import { subscribeRoster } from '@/services/liveSessionService';

export function useLiveRoster(): { roster: RosterEntry[]; ready: boolean } {
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = subscribeRoster((next) => {
      setRoster(next);
      setReady(true);
    });
    return unsub;
  }, []);

  return { roster, ready };
}
