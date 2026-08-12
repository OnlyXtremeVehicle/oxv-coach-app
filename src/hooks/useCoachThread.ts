/**
 * useCoachThread — un fil de messagerie coach↔pilote.
 *
 * ===========================================================================
 * CE FICHIER AFFIRMAIT UN TEMPS RÉEL QU'IL N'AVAIT PAS
 * ===========================================================================
 *
 * Son en-tête disait, jusqu'au 12/08/2026 : *« écoute Supabase Realtime
 * (postgres_changes filtré sur le binôme) : un nouveau message apparaît sans
 * refetch »*.
 *
 * C'était faux, et vérifiable d'une requête :
 *
 *     select tablename from pg_publication_tables where pubname='supabase_realtime'
 *     → telemetry_sessions · coach_annotations
 *
 * **`coach_messages` n'est pas publiée.** Un abonnement `postgres_changes` sur
 * une table absente de la publication rejoint le canal, passe `SUBSCRIBED`, et
 * ne reçoit JAMAIS rien. Aucune erreur n'est levée — c'est un silence, pas une
 * panne. Le fil ne se mettait donc à jour qu'au remontage de l'écran, et la
 * documentation affirmait le contraire.
 *
 * C'est le motif dominant du dépôt : la garde posée, non armée, avec un texte
 * qui certifie qu'elle fonctionne.
 *
 * ===========================================================================
 * CE QUI EST FAIT ICI, ET CE QUI NE PEUT PAS L'ÊTRE
 * ===========================================================================
 *
 * Publier la table est une migration — elle ne m'appartient pas. Ce hook fait
 * donc deux choses à ma portée :
 *
 * 1. **Il ne prétend plus.** `tempsReel` ne passe à `true` qu'après RÉCEPTION
 *    d'un événement, jamais sur le seul statut `SUBSCRIBED`. Un abonnement qui
 *    rejoint un canal muet reste `false`, et l'écran peut le dire.
 *
 * 2. **Il relit au retour au premier plan.** C'est le vrai mécanisme
 *    aujourd'hui : le coach revient sur l'application, le fil est à jour. Ce
 *    n'est pas du temps réel, ce n'est pas annoncé comme tel, et cela couvre
 *    le cas réel — on ne fixe pas un écran de messagerie en continu.
 *
 * L'abonnement est CONSERVÉ : le jour où `coach_messages` rejoint la
 * publication, il se met à recevoir sans qu'une ligne ne change ici, et
 * `tempsReel` bascule de lui-même.
 *
 * ===========================================================================
 * PAS DE SCRUTATION PÉRIODIQUE
 * ===========================================================================
 *
 * Volontairement. Une interrogation toutes les N secondes coûterait au réseau
 * du circuit — le pire réseau que cette application rencontre — pour un écran
 * qu'on ouvre quelques secondes entre deux runs. Le retour au premier plan
 * couvre le même besoin sans le coût.
 */

import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase';
import { type CoachMessage, listThreadMessages } from '@/services/coachMessagesService';

export interface CoachThreadState {
  messages: CoachMessage[];
  loading: boolean;
  /**
   * Vrai UNIQUEMENT après réception d'un événement temps réel.
   *
   * Faux tant que rien n'est arrivé — y compris quand le canal est abonné. Un
   * écran qui annonce « en direct » sur la foi d'un `SUBSCRIBED` ment au coach
   * exactement comme le faisait l'en-tête de ce fichier.
   */
  tempsReel: boolean;
  reload: () => void;
}

export function useCoachThread(coachPilotId: string | null): CoachThreadState {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [tempsReel, setTempsReel] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  /**
   * Le retour au premier plan relance la lecture.
   *
   * `useRef` et non une dépendance d'effet : passer par l'état ferait remonter
   * l'effet principal, donc désabonner et réabonner le canal à chaque retour.
   */
  const relire = useRef<() => void>(() => undefined);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') relire.current();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!coachPilotId) {
      setLoading(false);
      setMessages([]);
      setTempsReel(false);
      return;
    }
    let actif = true;
    setLoading(true);
    setTempsReel(false);

    const charger = (): void => {
      void listThreadMessages(coachPilotId).then((rows) => {
        if (actif) setMessages(rows);
      });
    };

    void listThreadMessages(coachPilotId).then((rows) => {
      if (actif) {
        setMessages(rows);
        setLoading(false);
      }
    });

    relire.current = charger;

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
          if (!actif) return;
          // UN ÉVÉNEMENT EST RÉELLEMENT ARRIVÉ. C'est le seul endroit du
          // fichier qui a le droit de lever `tempsReel`.
          setTempsReel(true);
          // On recharge la vérité en base plutôt que de reconstruire l'état
          // depuis la charge utile : simple, et sans seconde source de vérité.
          charger();
        }
      )
      .subscribe();

    return () => {
      actif = false;
      relire.current = () => undefined;
      void supabase.removeChannel(channel);
    };
  }, [coachPilotId, reloadKey]);

  return { messages, loading, tempsReel, reload: () => setReloadKey((k) => k + 1) };
}
