/**
 * Wire-up Flic 2 → useSessionStore.
 *
 * Chaque clic Flic (single/double/triple) est traduit en LapMarker
 * et poussé dans la session active. Le numéro de tour est snapshot
 * au moment du clic (snapshot du lapCount courant).
 *
 * Appelé une fois au démarrage, retourne une fonction de cleanup.
 */

import { flic2Service } from './flic2Service';
import { useSessionStore } from '@/store/useSessionStore';

let off: (() => void) | null = null;

export function initFlic(): void {
  if (off) return;

  off = flic2Service.onClick((kind, at) => {
    const session = useSessionStore.getState();
    // Le marker n'a de sens que pendant une session active. En dehors,
    // on log mais on ne pollue pas le store.
    if (session.status !== 'recording' && session.status !== 'paused') {
      if (__DEV__) {
        console.warn('[OXV Flic] Clic ignoré : aucune session active.');
      }
      return;
    }
    session.addMarker({
      at,
      kind,
      lapNumber: session.lapCount > 0 ? session.lapCount : null,
    });
  });
}

export function teardownFlic(): void {
  if (off) {
    off();
    off = null;
  }
}
