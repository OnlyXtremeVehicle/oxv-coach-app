/**
 * usePilotLiveRelay — relais du flux BLE pilote vers le coach (P5, côté PILOTE).
 *
 * Pendant une capture, s'abonne au flux `bluetoothService.onData`, mappe chaque
 * trame (raceBoxToLiveFrame, pur), la THROTTLE (~3-4 Hz via shouldEmitFrame) et
 * l'émet en broadcast `live:session:<id>`. S'annonce aussi au roster (présence).
 * Non-invasif : ne touche pas au pipeline de capture, il l'écoute seulement.
 *
 * Doctrine : le pilote conduit en silence (AUCUN HUD ici) ; ce relais est muet
 * côté pilote, il n'affiche rien. Le tour courant vient de la détection de tour.
 */

import { useEffect } from 'react';

import { bluetoothService } from '@/ble/bluetoothService';
import { getRecordedLaps } from '@/ble/lapDetectionRunner';
import { type RosterMeta, shouldEmitFrame } from '@/services/liveSessionLogic';
import { joinRoster, openPilotBroadcast } from '@/services/liveSessionService';
import { raceBoxToLiveFrame } from '@/services/liveRelayLogic';

export function usePilotLiveRelay(opts: {
  /** Actif seulement pendant une capture consentie. */
  active: boolean;
  sessionId: string | null;
  pilotId: string | null;
  firstName: string;
  circuit: string | null;
}): void {
  const { active, sessionId, pilotId, firstName, circuit } = opts;

  useEffect(() => {
    if (!active || !sessionId || !pilotId) return;

    const meta: RosterMeta = {
      pilotId,
      firstName,
      sessionId,
      circuit,
      onTrack: true,
      sinceMs: Date.now(),
    };
    const leave = joinRoster(meta);
    const broadcast = openPilotBroadcast(sessionId);

    let lastEmit: number | null = null;
    let lapStartMs = Date.now();
    let lastLapCount = getRecordedLaps().length;

    const off = bluetoothService.onData((data) => {
      const now = Date.now();
      // Nouveau tour bouclé → on repart le chrono du tour courant.
      const laps = getRecordedLaps().length;
      if (laps !== lastLapCount) {
        lastLapCount = laps;
        lapStartMs = now;
      }
      if (!shouldEmitFrame(lastEmit, now)) return; // ~3-4 Hz, pas 25 Hz
      lastEmit = now;
      broadcast.send(raceBoxToLiveFrame(data, { lap: laps + 1, lapStartMs, nowMs: now }));
    });

    return () => {
      off();
      broadcast.close();
      leave();
    };
  }, [active, sessionId, pilotId, firstName, circuit]);
}
