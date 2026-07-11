/**
 * liveRelayRunner — relais du flux BLE pilote vers le(s) coach(s), côté CAPTURE (P5).
 *
 * Module-level (PAS un hook React) : la capture tourne sans écran monté (« silence
 * en piste »), donc le relais vit avec le service de capture, pas avec l'UI.
 * Greffé sur `captureSessionService` (start/stop). GARDE-FOU de consentement :
 * ne démarre QUE si le pilote a activé le « partage en direct » pour au moins un
 * coach, et se réconcilie EN SÉANCE (révoquer un coach le fait sortir de SON
 * roster ; révoquer le dernier coupe tout). Transport durci : roster PAR-COACH +
 * canaux privés (cf. liveSessionService) — l'audience est scopée au binôme.
 *
 * Doctrine : muet côté pilote (aucun HUD, silence en piste). Le coach observe.
 */

import { bluetoothService } from '@/ble/bluetoothService';
import { getRecordedLaps } from '@/ble/lapDetectionRunner';
import { supabase } from '@/lib/supabase';
import { type RosterMeta, shouldEmitFrame } from '@/services/liveSessionLogic';
import { joinRoster, openPilotBroadcast } from '@/services/liveSessionService';
import { raceBoxToLiveFrame } from '@/services/liveRelayLogic';

let stopFn: (() => void) | null = null;

/** Coachs à qui le pilote a consenti le partage LIVE (actif + live_sharing_at). */
async function consentedCoachIds(pilotId: string): Promise<string[]> {
  const { data } = await supabase
    .from('coach_pilots')
    .select('coach_id')
    .eq('pilot_id', pilotId)
    .eq('active', true)
    .not('live_sharing_at', 'is', null);
  return (data ?? []).map((r) => (r as { coach_id: string }).coach_id);
}

/**
 * Démarre le relais pour la séance courante SI ≥ 1 coach a le partage live.
 * Best-effort, non bloquant : toute erreur laisse la capture intacte et muette
 * côté coach. Idempotent (stoppe un relais précédent).
 */
export async function startPilotLiveRelay(input: {
  sessionId: string;
  pilotId: string;
  circuit: string | null;
}): Promise<void> {
  stopPilotLiveRelay();

  const coachIds = await consentedCoachIds(input.pilotId);
  if (coachIds.length === 0) return; // aucun consentement live → silence réseau

  const { data: me } = await supabase
    .from('users')
    .select('first_name')
    .eq('id', input.pilotId)
    .maybeSingle();
  const firstName = (me as { first_name?: string | null } | null)?.first_name ?? 'Pilote';
  const meta: RosterMeta = {
    pilotId: input.pilotId,
    firstName,
    sessionId: input.sessionId,
    circuit: input.circuit,
    onTrack: true,
    sinceMs: Date.now(),
  };

  // Une présence par coach consenti ; réconciliée si le consentement change.
  const rosterLeaves = new Map<string, () => void>();
  const syncRosters = (ids: string[]) => {
    for (const [cid, leave] of rosterLeaves) {
      if (!ids.includes(cid)) {
        leave(); // ce coach a révoqué → le pilote sort de SON roster
        rosterLeaves.delete(cid);
      }
    }
    for (const cid of ids) {
      if (!rosterLeaves.has(cid)) rosterLeaves.set(cid, joinRoster(cid, meta));
    }
  };
  syncRosters(coachIds);

  const broadcast = openPilotBroadcast(input.sessionId);
  let lastEmit: number | null = null;
  let lapStartMs = Date.now();
  let lastLapCount = getRecordedLaps().length;

  const off = bluetoothService.onData((data) => {
    const now = Date.now();
    const laps = getRecordedLaps().length;
    if (laps !== lastLapCount) {
      lastLapCount = laps;
      lapStartMs = now;
    }
    if (!shouldEmitFrame(lastEmit, now)) return; // ~3-4 Hz, pas 25 Hz
    lastEmit = now;
    broadcast.send(raceBoxToLiveFrame(data, { lap: laps + 1, lapStartMs, nowMs: now }));
  });

  // Révocation EN SÉANCE : on écoute coach_pilots en temps réel et on réconcilie.
  // Révoquer UN coach le fait sortir de son roster ; révoquer le dernier coupe
  // tout — « Coupez quand vous voulez » est tenu en vol.
  const consentCh = supabase
    .channel(`relay-consent:${input.pilotId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'coach_pilots',
        filter: `pilot_id=eq.${input.pilotId}`,
      },
      () => {
        consentedCoachIds(input.pilotId).then((ids) => {
          if (ids.length === 0) stopPilotLiveRelay();
          else syncRosters(ids);
        });
      }
    )
    .subscribe();

  stopFn = () => {
    off();
    broadcast.close();
    for (const leave of rosterLeaves.values()) leave();
    rosterLeaves.clear();
    supabase.removeChannel(consentCh);
  };
}

/** Coupe le relais (fin de capture ou dernière révocation). Idempotent. */
export function stopPilotLiveRelay(): void {
  if (stopFn) {
    stopFn();
    stopFn = null;
  }
}
