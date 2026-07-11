/**
 * useCoachThread — un fil de messagerie coach↔pilote, temps réel.
 *
 * Charge l'historique (table `coach_messages`) puis écoute Supabase Realtime
 * (postgres_changes filtré sur le binôme) : un nouveau message apparaît sans
 * refetch. La persistance vit dans la table ; le temps réel n'est qu'un
 * abonnement, jamais une seconde source de vérité.
 */

import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { type CoachMessage, listThreadMessages } from '@/services/coachMessagesService';

export function useCoachThread(coachPilotId: string | null): {
  messages: CoachMessage[];
  loading: boolean;
  reload: () => void;
} {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!coachPilotId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    listThreadMessages(coachPilotId).then((rows) => {
      if (active) {
        setMessages(rows);
        setLoading(false);
      }
    });

    const channel = supabase
      .channel(`thread:${coachPilotId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'coach_messages',
          filter: `coach_pilot_id=eq.${coachPilotId}`,
        },
        () => {
          // Un changement sur ce fil → on recharge la vérité en base (simple et
          // sûr : pas de reconstruction d'état à partir du payload Realtime).
          if (active) listThreadMessages(coachPilotId).then((rows) => active && setMessages(rows));
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [coachPilotId, reloadKey]);

  return { messages, loading, reload: () => setReloadKey((k) => k + 1) };
}
