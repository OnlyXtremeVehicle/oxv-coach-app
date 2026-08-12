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
  openBiometryBroadcast,
  openPilotBroadcast,
  retrackRoster,
} from '@/services/liveSessionService';
import { buildBiometryEvent, raceBoxToLiveFrame } from '@/services/liveRelayLogic';
import { buildBoardEvent, shouldEmitBoard } from '@/services/boardLogic';
import { destinatairesBiometrie, stripHealth } from '@/services/v2/liveHealthGate';
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

/** Un binôme consenti au direct, avec le niveau d'accès accordé au coach. */
interface LiveCoach {
  coachId: string;
  /** true si le pilote a accordé la lecture DÉTAILLÉE (ou le programme). */
  detailed: boolean;
}

/**
 * Coachs à qui le pilote a consenti le partage LIVE.
 *
 * QUATRE conditions, et pas seulement deux (correctif du 26/07) :
 *   - `active` : le binôme n'est pas éteint ;
 *   - `status = 'active'` : la demande a été acceptée, pas laissée en attente ;
 *   - `pilot_consent_at` : le PILOTE a consenti au coaching. Sans cette condition,
 *     retirer son consentement ne coupait PAS le direct — le coach continuait de
 *     recevoir le flux d'un pilote qui venait de le lui refuser ;
 *   - `live_sharing_at` : le partage en direct est activé.
 *
 * On remonte aussi `level` : la biométrie n'est pas due au même titre que les
 * trames. Un coach en `lecture_simple` a droit au direct de pilotage, pas à une
 * donnée de santé.
 */
/**
 * ===========================================================================
 * « AUCUN COACH » ET « JE N'AI PAS PU LIRE » NE SONT PAS LA MÊME CHOSE
 * ===========================================================================
 *
 * Cette fonction ne lisait que `data` et ignorait `error` : sur panne réseau,
 * elle rendait `[]` — indiscernable d'un pilote qui n'a consenti à personne.
 *
 * Conséquence introduite le 12/08/2026 avec la réconciliation périodique : un
 * réseau qui tousse au circuit faisait voir `liste.length === 0`, donc
 * `stopPilotLiveRelay()`. **Une panne coupait le direct**, l'inverse exact de
 * ce que le commentaire de la réconciliation certifiait. Le `.catch` posé pour
 * l'éviter était du code mort — la promesse ne rejetait jamais.
 *
 * Trouvé par un audit adversarial du même jour, quelques heures après.
 *
 * `strict` porte l'asymétrie, et elle est délibérée :
 *
 *   AU DÉMARRAGE, ne pas pouvoir lire le consentement doit EMPÊCHER de
 *   diffuser. On ne commence pas à envoyer la position d'un pilote sur la foi
 *   d'une lecture ratée. Fail-closed.
 *
 *   EN COURS DE SÉANCE, ne pas pouvoir lire ne doit PAS couper. Une panne
 *   n'est pas un retrait de consentement, et le pilote a explicitement
 *   accepté. Le consentement retiré, lui, reste retiré en base : il sera lu au
 *   tick suivant.
 *
 * EXPORTÉE POUR ÊTRE ÉPROUVÉE. Elle n'a aucun appelant hors de ce fichier, et
 * n'a pas vocation à en avoir. Elle est visible parce que le défaut ci-dessus
 * ne se voit QU'À L'EXÉCUTION : le `.catch` était écrit, la phrase qui promet
 * de ne pas couper était écrite, et une garde lexicale les trouvait tous les
 * deux pendant que le code faisait l'inverse. Ce qui manquait était que la
 * promesse rejette — et cela, seul un appel le montre.
 */
export async function consentedCoaches(pilotId: string, strict = false): Promise<LiveCoach[]> {
  const { data, error } = await supabase
    .from('coach_pilots')
    .select('coach_id, level')
    .eq('pilot_id', pilotId)
    .eq('active', true)
    .eq('status', 'active')
    .not('pilot_consent_at', 'is', null)
    .not('live_sharing_at', 'is', null);
  // `strict` REJETTE au lieu d'avaler : c'est la seule façon pour l'appelant
  // de distinguer les deux cas.
  if (error && strict) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const row = r as { coach_id: string; level?: string | null };
    return {
      coachId: row.coach_id,
      // Fail-closed : un niveau inconnu ou absent n'ouvre RIEN.
      detailed: row.level === 'lecture_detaillee' || row.level === 'programme',
    };
  });
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

  let coaches = await consentedCoaches(input.pilotId);
  if (perime() || coaches.length === 0) return; // arrêt en vol, ou aucun consentement

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
  const syncRosters = (liste: LiveCoach[]) => {
    coaches = liste; // sert au verrou biométrie ci-dessous : les niveaux évoluent
    const ids = liste.map((c) => c.coachId);
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
  syncRosters(coaches);

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
  // le canal roster/frame ni le canal de séance — elle a le SIEN, un par coach
  // (`live:bio:<coachId>:<sessionId>`), ce qui permet de la réserver à ceux qui y
  // ont droit au lieu de couper pour tout le monde dès qu'un seul n'y a pas droit.
  let stopBiometry: (() => void) | null = null;
  // Émetteur biométrie — ouvert seulement si le flag est ON, comme le reste du
  // bloc : tant qu'il est OFF, aucun canal de santé n'est même créé.
  const bio = bioFlagOn ? openBiometryBroadcast(input.sessionId) : null;
  if (bioFlagOn && bio) {
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
        // VERROU « binôme détaillé » — corrigé le 26/07 après audit.
        //
        // Il valait auparavant « au moins un coach écoute », ce qui n'était PAS
        // le binôme détaillé : un coach en `lecture_simple` ayant activé le
        // partage en direct recevait la fréquence cardiaque, alors que le pilote
        // ne lui a accordé que la lecture simple. Une donnée de l'article 9
        // partait à quelqu'un qui n'y avait pas droit.
        //
        // UN CANAL PAR COACH — le TOUT OU RIEN est levé (jalon 6, lot 27a-bis).
        //
        // La biométrie voyageait sur le canal de séance, partagé par tous les
        // coachs consentis : impossible d'y réserver un message à certains. La
        // seule position tenable était donc de n'émettre que si CHAQUE coach à
        // l'écoute était au niveau détaillé — un coach détaillé perdait le cardio
        // parce qu'un confrère en lecture simple s'était connecté.
        //
        // Le destinataire est désormais dans le topic. On garde les deux verrous
        // qui relèvent du PILOTE — son consentement, le flag serveur — et on
        // évalue le troisième, le niveau du binôme, POUR CHAQUE COACH. Le gate
        // reste `canEmitBiometry`, appelé une fois par destinataire : la règle
        // fail-closed n'a pas changé, seul son grain.
        //
        // LE NIVEAU EST RELU ICI, comme les deux autres verrous.
        //
        // `coaches` est bien réconcilié en vol par le canal `relay-consent`
        // (plus bas) : une rétrogradation en `lecture_simple` y est vue. Mais
        // c'est la SEULE source de fraîcheur, alors que le consentement et le
        // flag sont relus à chaque tick. Si ce canal tombe — réseau de circuit,
        // socket coupé — le niveau reste figé sur sa dernière valeur connue et
        // un coach rétrogradé continuerait de recevoir du cardio.
        //
        // Une asymétrie sur trois verrous dont deux sont frais est un piège :
        // on croit la règle tenue par le tick alors qu'elle dépend d'un canal.
        // Relevé par la revue adversariale du 01/08/2026.
        const niveaux = await consentedCoaches(input.pilotId).catch(() => null);
        // Lecture impossible → on garde la dernière liste connue, mais on ne
        // l'élargit pas : `coaches` ne contient que des binômes déjà consentis.
        const aJour = niveaux ?? coaches;

        const socleConsenti = consent.capture === true && consent.coachShare === true;
        const flagOn = flag === true;
        const destinataires = destinatairesBiometrie(aJour, socleConsenti, flagOn);

        // Le marqueur de partage publié dans le roster SUIT le consentement, il
        // n'est pas figé au démarrage : sans ce ré-envoi, le coach continuerait
        // de voir « Cardio » après une révocation en séance (état périmé affiché
        // comme actuel). On ne re-publie que sur CHANGEMENT, pour ne pas marteler
        // la présence à chaque tick.
        const shared = socleConsenti && flagOn;
        if (shared !== meta.bioShared) {
          meta.bioShared = shared;
          for (const cid of rosterLeaves.keys()) retrackRoster(cid, meta);
        }

        if (destinataires.length === 0) return; // fail-closed : personne d'éligible
        const event = buildBiometryEvent(bioBuffer, now);
        if (!event) return; // rien d'exploitable dans la fenêtre → honnête silence
        lastBioEmit = now;
        // Un envoi par destinataire, sur SON canal. Un coach non éligible n'est
        // pas filtré à la réception : le message ne part simplement pas vers lui.
        for (const c of destinataires) bio.sendTo(c.coachId, event);
      })();
    }, 2000);

    stopBiometry = () => {
      offBio();
      clearInterval(bioTimer);
    };
  }

  /**
   * RÉVOCATION EN SÉANCE — deux mécanismes, parce que le premier est muet.
   *
   * ===========================================================================
   * CE QUE CE BLOC PROMETTAIT SANS POUVOIR LE TENIR
   * ===========================================================================
   *
   * Il n'y avait ici qu'un abonnement `postgres_changes` sur `coach_pilots`,
   * sous un commentaire affirmant : « Coupez quand vous voulez est tenu en
   * vol ».
   *
   * **`coach_pilots` n'est pas dans la publication `supabase_realtime`** —
   * vérifié en production le 12/08/2026, où seules `telemetry_sessions` et
   * `coach_annotations` y figurent. L'abonnement rejoint le canal, passe
   * `SUBSCRIBED`, et ne reçoit jamais rien. Aucune erreur n'est levée.
   *
   * Conséquence, et elle n'est pas cosmétique : **un pilote qui retirait son
   * consentement pendant une séance continuait d'être diffusé à son coach
   * jusqu'à la fin du run.** La promesse la plus importante de ce fichier
   * n'était pas tenue, et son commentaire certifiait qu'elle l'était.
   *
   * ===========================================================================
   * LA RÉCONCILIATION PÉRIODIQUE
   * ===========================================================================
   *
   * L'abonnement est CONSERVÉ : le jour où la table rejoint la publication, il
   * coupe à la seconde. En attendant, une relecture périodique tient la
   * promesse — avec un délai BORNÉ, écrit, et court.
   *
   * Quinze secondes. C'est le compromis entre le réseau du circuit — le pire
   * que cette application rencontre — et ce qu'un pilote accepte d'attendre
   * après avoir retiré son accord. Ce n'est pas instantané, et il ne faut pas
   * le présenter comme tel.
   *
   * Une lecture qui échoue NE COUPE PAS : un réseau tombé n'est pas un retrait
   * de consentement, et couper sur une panne rendrait le direct inutilisable au
   * circuit. Le consentement retiré, lui, reste retiré en base et sera lu au
   * tick suivant.
   */
  const RECONCILIATION_MS = 15_000;

  const reconcilier = (): void => {
    // `strict` : la lecture REJETTE sur erreur. Sans lui, une panne rendait
    // `[]` — indiscernable d'un retrait — et coupait le direct.
    void consentedCoaches(input.pilotId, true)
      .then((liste) => {
        if (liste.length === 0) stopPilotLiveRelay();
        else syncRosters(liste);
      })
      .catch(() => {
        // Panne réseau : on ne coupe pas. Une panne n'est pas un retrait, et
        // le consentement retiré sera lu au tick suivant.
      });
  };

  const consentTimer = setInterval(reconcilier, RECONCILIATION_MS);

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
        // La relecture reprend les QUATRE conditions : un retrait de
        // consentement, un passage en `lecture_simple` ou une fin de binôme
        // sont donc pris en compte EN VOL — le premier coupe le flux, le second
        // ferme la biométrie au tick suivant.
        // MÊME ASYMÉTRIE QUE LA RÉCONCILIATION : `strict`, sinon une panne
        // réseau au moment où l'événement arrive rendrait `[]` et couperait le
        // direct. Ce chemin est muet aujourd'hui (`coach_pilots` n'est pas
        // publiée), mais il ne doit pas porter le défaut le jour où il parle.
        void consentedCoaches(input.pilotId, true)
          .then((liste) => {
            if (liste.length === 0) stopPilotLiveRelay();
            else syncRosters(liste);
          })
          .catch(() => {
            // Une panne n'est pas un retrait.
          });
      }
    )
    .subscribe();

  stopFn = () => {
    off();
    stopBiometry?.();
    bio?.close();
    broadcast.close();
    board?.close();
    for (const leave of rosterLeaves.values()) leave();
    rosterLeaves.clear();
    clearInterval(consentTimer);
    void supabase.removeChannel(consentCh);
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
