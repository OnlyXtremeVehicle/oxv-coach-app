/**
 * liveRelayRunner — relais du flux BLE pilote vers le coach, côté CAPTURE (P5).
 *
 * Module-level (PAS un hook React) : la capture tourne sans écran monté (« silence
 * en piste »), donc le relais doit vivre avec le service de capture, pas avec l'UI.
 * Greffé sur `captureSessionService` (start/stop). Encapsule le GARDE-FOU de
 * consentement : il ne démarre QUE si le pilote a activé le « partage en direct »
 * (`coach_pilots.live_sharing_at IS NOT NULL`) — sinon aucune trame ne part.
 *
 * Doctrine : muet côté pilote (aucun HUD, silence en piste respecté). Le coach
 * observe. Aucun classement.
 */

import { bluetoothService } from '@/ble/bluetoothService';
import { getRecordedLaps } from '@/ble/lapDetectionRunner';
import { supabase } from '@/lib/supabase';
import { shouldEmitFrame } from '@/services/liveSessionLogic';
import { joinRoster, openPilotBroadcast } from '@/services/liveSessionService';
import { raceBoxToLiveFrame } from '@/services/liveRelayLogic';

let stopFn: (() => void) | null = null;

/**
 * Démarre le relais pour la séance courante SI le pilote a consenti au partage
 * live. Best-effort, non bloquant : toute erreur laisse la capture intacte et
 * simplement muette côté coach. Idempotent (stoppe un relais précédent).
 */
export async function startPilotLiveRelay(input: {
  sessionId: string;
  pilotId: string;
  circuit: string | null;
}): Promise<void> {
  stopPilotLiveRelay();

  // Garde-fou consentement : au moins un coach actif AVEC partage live activé.
  const { data: consent } = await supabase
    .from('coach_pilots')
    .select('id')
    .eq('pilot_id', input.pilotId)
    .eq('active', true)
    .not('live_sharing_at', 'is', null)
    .limit(1)
    .maybeSingle();
  if (!consent) return; // pas de consentement live → silence réseau, rien n'est émis

  // Prénom du pilote pour le roster (le coach voit « qui est en piste »).
  const { data: me } = await supabase
    .from('users')
    .select('first_name')
    .eq('id', input.pilotId)
    .maybeSingle();
  const firstName = (me as { first_name?: string | null } | null)?.first_name ?? 'Pilote';

  const leave = joinRoster({
    pilotId: input.pilotId,
    firstName,
    sessionId: input.sessionId,
    circuit: input.circuit,
    onTrack: true,
    sinceMs: Date.now(),
  });
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

  // Révocation EN SÉANCE : on écoute coach_pilots en temps réel. Dès qu'un
  // changement retire le dernier consentement live (live_sharing_at→null,
  // consentement de base retiré, ou binôme désactivé), on coupe le relais
  // immédiatement — « Coupez quand vous voulez » est tenu en vol, pas au
  // prochain démarrage de capture.
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
        supabase
          .from('coach_pilots')
          .select('id')
          .eq('pilot_id', input.pilotId)
          .eq('active', true)
          .not('live_sharing_at', 'is', null)
          .limit(1)
          .maybeSingle()
          .then(({ data: still }) => {
            if (!still) stopPilotLiveRelay(); // plus aucun consentement live → coupe
          });
      }
    )
    .subscribe();

  stopFn = () => {
    off();
    broadcast.close();
    leave();
    supabase.removeChannel(consentCh);
  };
}

/** Coupe le relais (fin de capture ou révocation). Idempotent. */
export function stopPilotLiveRelay(): void {
  if (stopFn) {
    stopFn();
    stopFn = null;
  }
}
