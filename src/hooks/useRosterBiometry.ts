/**
 * useRosterBiometry — cardio des pilotes du roster coach (pastille colorée, P5).
 *
 * POURQUOI un hook séparé plutôt qu'un champ de plus dans le roster : la présence
 * (`live:roster:<coachId>`) transporte une méta d'IDENTITÉ (prénom, circuit, en
 * piste) qui n'est pas prévue pour de la santé. Y faire passer une FC ferait
 * emprunter à une donnée RGPD art. 9 un canal choisi pour autre chose. La
 * biométrie ne circule donc QUE par l'événement `biometry` du canal PRIVÉ
 * `live:session:<sessionId>`, dont la RLS serveur (binôme consenti) arbitre déjà
 * l'accès : un coach non autorisé ne reçoit rien, ici on ne fait qu'écouter.
 *
 * PRÉCISION D'HONNÊTETÉ : la protection décrite ci-dessus est STRUCTURELLE (la FC
 * n'est jamais écrite dans RosterMeta), elle n'est PAS le fait d'un filtre à
 * l'exécution. `stripHealth` (liveHealthGate) filtre bien, lui, les payloads du
 * TABLEAU DE MARCHE (canal `live:board:`, lot LIVE-B) — mais il ne tourne pas sur
 * le chemin décrit ici. Ne pas laisser croire qu'un filtre s'exécute sur la
 * présence : il n'y en a pas, et il n'y en a pas besoin.
 *
 * Le hook n'écrit rien, ne persiste rien, ne journalise rien : la FC ne fait que
 * transiter en mémoire le temps d'être affichée (minimisation). Il ne juge pas
 * non plus — il expose une zone FACTUELLE relative à la plage observée du pilote
 * lui-même. Aucune alerte automatique, aucun diagnostic, aucun classement.
 */

import { useEffect, useRef, useState } from 'react';

import {
  type CardioZone,
  type ObservedRange,
  cardioZone,
  updateObservedRange,
} from '@/services/cardioZoneLogic';
import { type Unsubscribe, subscribePilotStream } from '@/services/liveSessionService';

/**
 * Péremption du cardio (10 s), identique à usePilotLive. Passé ce délai sans
 * événement, on EFFACE l'état du pilote au lieu de figer sa dernière couleur.
 *
 * C'est ce qui rend une révocation en vol visible : le pilote coupe le partage,
 * l'émission s'arrête, la pastille DISPARAÎT. Une pastille figée sur sa dernière
 * teinte laisserait croire à du direct — l'absence est un état honnête.
 */
const BIO_STALE_MS = 10000;

/** Cadence du balayage de péremption (1 s, comme le tick de usePilotLive). */
const TICK_MS = 1000;

/** Ce qu'une pastille roster a besoin de savoir. Rien de plus n'est conservé. */
export interface RosterBioState {
  /** Zone relative à la plage observée de CE pilote, ou null si indéterminable. */
  zone: CardioZone | null;
  /** Dernière FC reçue (bpm). Valeur mesurée, jamais reconstruite. */
  hrBpm: number;
  /** Horodatage de la mesure côté pilote (ms epoch). */
  atMs: number;
}

/** Abonnement vivant pour un pilote. La plage observée vit ici, et meurt avec lui. */
interface PilotSubscription {
  /** Session écoutée : si elle change, l'abonnement doit être refait. */
  sessionId: string;
  /** Plage observée PAR PILOTE — jamais partagée, jamais persistée. */
  observed: ObservedRange | null;
  unsub: Unsubscribe;
}

export function useRosterBiometry(
  pilots: readonly { pilotId: string; sessionId: string; bioShared?: boolean }[]
): Record<string, RosterBioState> {
  const [states, setStates] = useState<Record<string, RosterBioState>>({});

  // Fail-closed : seul un partage EXPLICITEMENT vrai ouvre un abonnement. Un
  // `undefined` (méta ancienne, pilote sans capteur) n'écoute rien.
  const sharers = pilots.filter((p) => p.bioShared === true);

  // PIÈGE ÉVITÉ : `pilots` est un tableau NEUF à chaque rendu du parent ; le
  // mettre en dépendance relancerait l'effet en boucle (fermer/rouvrir tous les
  // canaux à chaque image). On dérive une clé STABLE — la liste triée des
  // couples pilote+session des seuls partageurs — qui ne change que lorsque le
  // besoin d'abonnement change réellement (arrivée, départ, révocation, session).
  const subscriptionKey = sharers
    .map((p) => `${p.pilotId}~${p.sessionId}`)
    .sort()
    .join('|');

  const subsRef = useRef<Map<string, PilotSubscription>>(new Map());
  /**
   * Heure de RÉCEPTION du dernier événement, par pilote. On périme sur l'horloge
   * du coach et non sur `atMs` : un décalage d'horloge entre les deux appareils
   * ne doit pas effacer un direct valide ni prolonger un flux mort.
   */
  const lastSeenRef = useRef<Map<string, number>>(new Map());
  /**
   * Garde de montage partagée : les abonnements survivent aux ré-exécutions de
   * l'effet de réconciliation (on ne touche que le delta), donc le drapeau ne
   * peut pas être local à un passage — il est lié au cycle de vie du hook.
   */
  const mountedRef = useRef(true);

  // Cycle de vie : ferme TOUT au démontage. Séparé de la réconciliation, dont
  // le nettoyage ne doit surtout pas tout arracher à chaque changement de liste.
  useEffect(() => {
    const subs = subsRef.current;
    const lastSeen = lastSeenRef.current;
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      for (const sub of subs.values()) sub.unsub();
      subs.clear();
      lastSeen.clear();
    };
  }, []);

  // Réconciliation en DELTA : on ferme ce qui n'a plus lieu d'être, on ouvre ce
  // qui manque, on laisse intact ce qui tient déjà (la plage observée d'un pilote
  // resté en piste n'est donc jamais réinitialisée par l'arrivée d'un autre).
  useEffect(() => {
    const subs = subsRef.current;
    const desired = new Map<string, string>();
    for (const p of sharers) desired.set(p.pilotId, p.sessionId);

    const dropped: string[] = [];
    for (const [pilotId, sub] of subs) {
      // Parti, révoqué, ou reparti sur une autre session : l'abonnement tombe,
      // et avec lui la plage observée (elle appartient au pilote, pas au coach).
      if (desired.get(pilotId) === sub.sessionId) continue;
      sub.unsub();
      subs.delete(pilotId);
      lastSeenRef.current.delete(pilotId);
      dropped.push(pilotId);
    }
    if (dropped.length > 0) {
      setStates((prev) => {
        if (!dropped.some((id) => id in prev)) return prev;
        const next = { ...prev };
        for (const id of dropped) delete next[id];
        return next;
      });
    }

    for (const [pilotId, sessionId] of desired) {
      if (subs.has(pilotId)) continue;
      const entry: PilotSubscription = { sessionId, observed: null, unsub: () => undefined };
      subs.set(pilotId, entry);
      entry.unsub = subscribePilotStream(sessionId, {
        // La pastille roster ne lit QUE le cardio ; la télémétrie du pilote ne
        // sort pas d'ici (elle a son écran dédié, usePilotLive).
        onFrame: () => undefined,
        onBiometry: (e) => {
          // Deux gardes : hook démonté, et abonnement remplacé/fermé pendant
          // qu'un événement était en vol (removeChannel est asynchrone).
          if (!mountedRef.current) return;
          if (subsRef.current.get(pilotId) !== entry) return;
          // Frontière non typée (payload réseau) : une FC non finie n'est pas une
          // mesure, elle ne rafraîchit donc rien — ni la plage, ni la péremption,
          // ni l'affichage. Fail-closed, comme cardioZoneLogic et liveHealthGate.
          if (typeof e.hrBpm !== 'number' || !Number.isFinite(e.hrBpm)) return;
          const observed = updateObservedRange(entry.observed, e.hrBpm);
          entry.observed = observed;
          lastSeenRef.current.set(pilotId, Date.now());
          // Plage encore inconnue ou trop étroite → zone null : la pastille reste
          // inerte plutôt que d'inventer une couleur (« absence égale rien »).
          const zone = observed === null ? null : cardioZone(e.hrBpm, observed);
          setStates((prev) => ({
            ...prev,
            [pilotId]: { zone, hrBpm: e.hrBpm, atMs: e.atMs },
          }));
        },
      });
    }
    // `sharers` est volontairement hors dépendances : c'est un tableau neuf à
    // chaque rendu, et `subscriptionKey` en capture déjà tout ce qui compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptionKey]);

  // Péremption : le flux d'un pilote s'est tu (révocation, capteur décroché,
  // réseau circuit tombé) → sa pastille s'efface. On ne recolore rien, on retire.
  useEffect(() => {
    const tick = setInterval(() => {
      const now = Date.now();
      const expired: string[] = [];
      for (const [pilotId, seenMs] of lastSeenRef.current) {
        if (now - seenMs >= BIO_STALE_MS) expired.push(pilotId);
      }
      if (expired.length === 0) return;
      for (const pilotId of expired) lastSeenRef.current.delete(pilotId);
      setStates((prev) => {
        if (!expired.some((id) => id in prev)) return prev;
        const next = { ...prev };
        for (const id of expired) delete next[id];
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(tick);
  }, []);

  return states;
}
