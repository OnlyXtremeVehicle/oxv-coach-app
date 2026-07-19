/**
 * useCentralButtonState — état vivant du bouton central de la TabBar V2
 * (lot L0, Livrable 8).
 *
 * Lit la state machine (`useAppStateStore.activeRecording`) et la prochaine
 * journée circuit (`getMyNextTrackDay`, LECTURE SEULE, RLS own-row), puis
 * délègue la décision au module pur `centralButtonLogic` (testé) :
 *
 *   rec        → capture en cours ;
 *   countdown  → journée à venir, label 'J-x' ;
 *   reserve    → sinon.
 *
 * Robustesse : pas d'utilisateur connecté ou service en échec → reserve
 * (le bouton reste honnête, jamais un countdown inventé). La journée est
 * relue à la connexion, à chaque retour d'une capture (fin de séance =
 * l'occasion naturelle de rafraîchir le J-x) et au retour de l'app au
 * premier plan (AppState 'active') — un 'J-x' calculé la veille ne reste
 * pas figé à l'écran.
 */

import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getMyNextTrackDay } from '@/services/nextTrackDayService';
import { useAppStateStore } from '@/store/useAppStateStore';
import { useAuthStore } from '@/store/useAuthStore';

import { decideCentralButton, type CentralButtonDecision } from './centralButtonLogic';

export type { CentralButtonDecision } from './centralButtonLogic';

export function useCentralButtonState(): CentralButtonDecision {
  const recordingActive = useAppStateStore((s) => s.activeRecording !== null);
  const userId = useAuthStore((s) => s.profile?.id);
  const [nextDayDate, setNextDayDate] = useState<string | null>(null);
  // Incrémenté à chaque retour au premier plan : relance le fetch ci-dessous
  // ET provoque un rendu — donc un `now` frais pour la décision.
  const [foregroundTick, setForegroundTick] = useState(0);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setForegroundTick((t) => t + 1);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    // foregroundTick est une dépendance volontaire : retour au premier plan
    // = relecture de la journée. Le flag cancelled couvre les courses.
    void foregroundTick;
    let cancelled = false;
    if (!userId) {
      setNextDayDate(null);
      return;
    }
    // Relue quand la capture se termine (recordingActive false) : le J-x
    // affiché après une journée ne doit pas être celui d'avant.
    if (recordingActive) return;
    getMyNextTrackDay(userId)
      .then((next) => {
        if (!cancelled) setNextDayDate(next?.date ?? null);
      })
      .catch(() => {
        if (!cancelled) setNextDayDate(null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, recordingActive, foregroundTick]);

  return decideCentralButton({ recordingActive, nextDayDate, now: new Date() });
}
