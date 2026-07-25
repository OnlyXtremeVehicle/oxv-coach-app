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
 * LIVE-B — le relais alimente en plus le TABLEAU DE MARCHE (`live:board:<id>`,
 * 1 Hz), dont l'audience est bien plus large que le binôme : pseudo public,
 * numéro de voiture et durées de tour, rien d'autre, et toujours au travers de
 * stripHealth(). Deux canaux, deux audiences, deux niveaux de contenu.
 *
 * Doctrine : muet côté pilote (aucun HUD, silence en piste). Le coach observe.
 */

import { bluetoothService } from '@/ble/bluetoothService';
import { getRecordedLaps } from '@/ble/lapDetectionRunner';
import { supabase } from '@/lib/supabase';
import { type RosterMeta, shouldEmitBiometry, shouldEmitFrame } from '@/services/liveSessionLogic';
import {
  joinRoster,
  openBoardBroadcast,
  openPilotBroadcast,
  retrackRoster,
} from '@/services/liveSessionService';
import { buildBiometryEvent, raceBoxToLiveFrame } from '@/services/liveRelayLogic';
import { buildBoardEvent, shouldEmitBoard } from '@/services/boardLogic';
import { canEmitBiometry, stripHealth } from '@/services/v2/liveHealthGate';
import { type BioSample } from '@/services/v2/biometryBufferLogic';
import { loadBiometryConsents } from '@/services/consentService';
import { isFlagEnabled } from '@/services/featureFlagsService';

let stopFn: (() => void) | null = null;

/**
 * Génération du relais — garde-fou d'une COURSE réelle et coûteuse.
 *
 * `startPilotLiveRelay` est async et enchaîne plusieurs requêtes (consentements,
 * identité, drapeau, consentement biométrie) AVANT d'ouvrir le moindre canal et
 * d'installer `stopFn`. Si la capture s'arrête pendant ces attentes,
 * `stopPilotLiveRelay()` ne trouve rien à couper — puis le démarrage en vol
 * termine sa course et ouvre des canaux que plus personne ne fermera jamais.
 * Depuis LIVE-B, l'un d'eux est le canal PUBLIC du tableau de marche : il
 * continuerait de diffuser après la fin de la séance.
 *
 * Chaque démarrage prend donc un numéro. Tout arrêt l'incrémente, ce qui
 * INVALIDE les démarrages en vol : ils se démontent eux-mêmes au lieu de publier.
 */
let relayGeneration = 0;

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

/** Identité du pilote telle qu'elle peut être publiée pendant la séance. */
interface PilotIdentity {
  /** Prénom — canal COACH uniquement (roster du binôme consenti). */
  firstName: string;
  /** Pseudo public (users.public_handle) — seule identité admise sur le board. */
  pilotHandle: string | null;
  /** Numéro de voiture (users.car_number), ou null si non attribué. */
  carNo: number | null;
}

/**
 * Charge l'identité publiable UNE fois, au démarrage du relais — jamais à chaque
 * trame : ces trois valeurs ne bougent pas pendant une séance, et le circuit n'a
 * pas le réseau pour une requête par tick.
 *
 * `car_number` peut ne pas exister en base (migration 20260717000000_profil_
 * pavillon jointe mais pas nécessairement appliquée) : le code 42703 « colonne
 * inconnue » déclenche un second select sans elle, exactement comme
 * src/lib/queries/profil.ts. Le relais continue alors sans numéro de voiture —
 * une colonne absente ne coupe pas le direct, elle laisse un « — » à l'écran.
 */
async function loadPilotIdentity(pilotId: string): Promise<PilotIdentity> {
  const texte = (v: unknown): string | null =>
    typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;

  const complet = await supabase
    .from('users')
    .select('first_name, public_handle, car_number')
    .eq('id', pilotId)
    .maybeSingle();

  if (!complet.error && complet.data) {
    const row = complet.data as {
      first_name?: string | null;
      public_handle?: string | null;
      car_number?: number | null;
    };
    return {
      firstName: texte(row.first_name) ?? 'Pilote',
      pilotHandle: texte(row.public_handle),
      carNo:
        typeof row.car_number === 'number' && Number.isFinite(row.car_number)
          ? row.car_number
          : null,
    };
  }

  if (complet.error?.code !== '42703') {
    return { firstName: 'Pilote', pilotHandle: null, carNo: null };
  }
  const repli = await supabase
    .from('users')
    .select('first_name, public_handle')
    .eq('id', pilotId)
    .maybeSingle();
  const row = (repli.data ?? {}) as { first_name?: string | null; public_handle?: string | null };
  return {
    firstName: texte(row.first_name) ?? 'Pilote',
    pilotHandle: texte(row.public_handle),
    carNo: null,
  };
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
  // Ce démarrage-ci. Toute demande d'arrêt survenue pendant les attentes qui
  // suivent rendra ce numéro périmé, et on repartira sans rien avoir publié.
  const myGeneration = relayGeneration;
  const perime = () => relayGeneration !== myGeneration;

  const coachIds = await consentedCoachIds(input.pilotId);
  if (perime() || coachIds.length === 0) return; // arrêt en vol, ou aucun consentement

  // Identité chargée UNE fois : prénom (roster coach), pseudo public et numéro
  // de voiture (tableau de marche). Cf. loadPilotIdentity.
  const identity = await loadPilotIdentity(input.pilotId);
  if (perime()) return;

  // BIO-2 — le drapeau conditionne TOUT le cardio (relais + marqueur roster).
  const bioFlagOn = await isFlagEnabled('biometry').catch(() => false);
  if (perime()) return;
  // Marqueur de présence : « ce pilote partage son cardio ». État booléen, pas
  // une mesure — aucune FC ne transite jamais par la présence.
  const bioConsent = bioFlagOn
    ? await loadBiometryConsents(input.pilotId).catch(() => ({ capture: false, coachShare: false }))
    : { capture: false, coachShare: false };
  // DERNIER point de contrôle avant d'ouvrir quoi que ce soit : au-delà, les
  // canaux existent et c'est `stopFn` qui devient responsable de les fermer.
  if (perime()) return;

  const meta: RosterMeta = {
    pilotId: input.pilotId,
    firstName: identity.firstName,
    sessionId: input.sessionId,
    circuit: input.circuit,
    onTrack: true,
    sinceMs: Date.now(),
    // LIVE-B — le numéro de voiture voyage avec la présence : le multi-live du
    // coach ordonne par numéro, et la présence est déjà le canal qui porte
    // l'identité (prénom, circuit). Donnée publique de piste, pas de la santé.
    carNo: identity.carNo,
    bioShared: bioFlagOn && bioConsent.capture === true && bioConsent.coachShare === true,
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

  // ── LIVE-B : tableau de marche (canal PUBLIC-ish, écran TV du paddock) ──
  // Pas de pseudo public, pas de diffusion publique : sans identité publiable, on
  // n'ouvre même pas le canal. Le prénom ne le remplace PAS — l'état civil n'a
  // rien à faire sur un écran que tout le paddock regarde.
  const board = identity.pilotHandle ? openBoardBroadcast(input.sessionId) : null;
  let lastBoardEmit: number | null = null;

  let lastEmit: number | null = null;
  let lapStartMs = Date.now();
  let lastLapCount = getRecordedLaps().length;

  const off = bluetoothService.onData((data) => {
    const now = Date.now();
    // Un seul instantané des tours par trame : il sert au suivi de tour, et aux
    // deux chronos du tableau de marche.
    const recorded = getRecordedLaps();
    const laps = recorded.length;
    if (laps !== lastLapCount) {
      lastLapCount = laps;
      lapStartMs = now;
    }

    // Board à 1 Hz MAXIMUM, en parallèle du flux coach (~3-4 Hz) et indépendant
    // de lui. Le payload part par stripHealth() : c'est LA barrière du lot, la
    // seule chose qui empêche qu'un champ ajouté demain à buildBoardEvent se
    // retrouve sur l'écran du paddock. Ne jamais court-circuiter cette étape.
    // Secteur : `null` tant que la capture ne découpe pas la piste en secteurs —
    // une colonne vide vaut mieux qu'un secteur deviné.
    if (board && identity.pilotHandle && shouldEmitBoard(lastBoardEmit, now)) {
      const event = buildBoardEvent({
        pilotHandle: identity.pilotHandle,
        carNo: identity.carNo,
        lapsMs: recorded.map((l) => l.durationMs),
        sector: null,
        nowMs: now,
      });
      if (event) {
        lastBoardEmit = now;
        board.send(stripHealth({ ...event }));
      }
    }

    if (!shouldEmitFrame(lastEmit, now)) return; // ~3-4 Hz, pas 25 Hz
    lastEmit = now;
    broadcast.send(raceBoxToLiveFrame(data, { lap: laps + 1, lapStartMs, nowMs: now }));
  });

  // ── BIO-2 : relais biométrique (canal COACH uniquement, gaté OFF par flag) ──
  // Le flux cardio (Polar, via bluetoothService.onBiometry) est relayé au coach à
  // 0,5 Hz (moyenne glissante 2 s) SOUS TRIPLE VERROU re-vérifié À CHAQUE tick :
  // consentement biométrie (capture ET partage coach) · binôme détaillé (roster
  // consenti non vide) · flag serveur `biometry`. FAIL-CLOSED : au moindre doute —
  // révocation en vol, réseau tombé, flag retiré — plus rien ne part. Tant que le
  // flag est OFF, TOUT ce bloc reste DORMANT (aucun abonnement, aucune I/O) : la
  // donnée de santé (RGPD art. 9) ne circule pas. La biométrie n'emprunte JAMAIS
  // le canal roster/frame — uniquement `sendBiometry` (event dédié, même canal privé).
  let stopBiometry: (() => void) | null = null;
  if (bioFlagOn) {
    const BIO_BASELINE_MS = 60000;
    const bioBuffer: BioSample[] = [];
    const offBio = bluetoothService.onBiometry((s) => {
      const ts = Date.now();
      bioBuffer.push({ ts, hrBpm: s.hrBpm, rrMs: s.rrMs, contact: s.contact });
      // Fenêtre glissante bornée à la référence : on ne garde pas d'historique long.
      const cutoff = ts - BIO_BASELINE_MS;
      while (bioBuffer.length > 0 && bioBuffer[0].ts < cutoff) bioBuffer.shift();
    });

    let lastBioEmit: number | null = null;
    const bioTimer = setInterval(() => {
      void (async () => {
        const now = Date.now();
        if (!shouldEmitBiometry(lastBioEmit, now)) return; // 0,5 Hz
        // Triple verrou RE-VÉRIFIÉ ICI, à chaque tick — jamais une seule fois.
        const consent = await loadBiometryConsents(input.pilotId).catch(() => ({
          capture: false,
          coachShare: false,
        }));
        const flag = await isFlagEnabled('biometry').catch(() => false);
        const gate = {
          consentCapture: consent.capture === true && consent.coachShare === true,
          detailedBinome: rosterLeaves.size > 0,
          flagBiometry: flag === true,
        };

        // Le marqueur de partage publié dans le roster SUIT le consentement, il
        // n'est pas figé au démarrage : sans ce ré-envoi, le coach continuerait
        // de voir « Cardio » après une révocation en séance (état périmé affiché
        // comme actuel). On ne re-publie que sur CHANGEMENT, pour ne pas marteler
        // la présence à chaque tick.
        const shared = gate.consentCapture && gate.flagBiometry;
        if (shared !== meta.bioShared) {
          meta.bioShared = shared;
          for (const cid of rosterLeaves.keys()) retrackRoster(cid, meta);
        }

        if (!canEmitBiometry(gate)) return; // fail-closed : aucune biométrie ne part
        const event = buildBiometryEvent(bioBuffer, now);
        if (!event) return; // rien d'exploitable dans la fenêtre → honnête silence
        lastBioEmit = now;
        broadcast.sendBiometry(event);
      })();
    }, 2000);

    stopBiometry = () => {
      offBio();
      clearInterval(bioTimer);
    };
  }

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
    stopBiometry?.();
    broadcast.close();
    board?.close();
    for (const leave of rosterLeaves.values()) leave();
    rosterLeaves.clear();
    supabase.removeChannel(consentCh);
  };
}

/**
 * Coupe le relais (fin de capture ou dernière révocation). Idempotent.
 *
 * Incrémente TOUJOURS la génération, même quand il n'y a rien à couper : c'est
 * précisément le cas dangereux — un démarrage encore en vol, qui n'a pas encore
 * posé son `stopFn`. Le numéro périmé le fera renoncer avant qu'il n'ouvre le
 * moindre canal.
 */
export function stopPilotLiveRelay(): void {
  relayGeneration += 1;
  if (stopFn) {
    stopFn();
    stopFn = null;
  }
}
