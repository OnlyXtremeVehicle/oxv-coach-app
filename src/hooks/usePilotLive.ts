/**
 * usePilotLive — abonne le coach au flux live d'un pilote (P5).
 *
 * S'appuie sur liveSessionService.subscribePilotStream (broadcast Realtime) et
 * dérive l'état de connexion via deriveLiveConn (pur, testé) rafraîchi à chaque
 * seconde : une trame arrive → `live` ; le flux se tait → `stale` → `offline`
 * (réseau circuit instable). L'état hors-ligne est honnête : on ne fige jamais
 * une donnée périmée en la faisant passer pour du direct.
 */

import { useEffect, useRef, useState } from 'react';

import {
  type BiometryLiveEvent,
  type LiveConn,
  type LiveFrame,
  deriveLiveConn,
} from '@/services/liveSessionLogic';
import { subscribeBiometry, subscribePilotStream } from '@/services/liveSessionService';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Fenêtre de la sparkline FC côté coach (60 s) : on ne garde QUE ce qui est
 * affiché — aucune constitution d'historique santé côté coach (minimisation).
 */
const BIO_WINDOW_MS = 60000;

/**
 * Péremption du cardio (10 s ≈ 5 ticks manqués à 0,5 Hz). Passé ce délai sans
 * événement, on EFFACE la biométrie au lieu de figer la dernière valeur.
 *
 * C'est la règle du direct appliquée à la donnée de santé : une révocation en
 * vol, un décrochage de ceinture ou un réseau tombé coupent l'émission — le
 * coach ne doit alors plus rien voir, jamais une FC périmée qui passerait pour
 * du direct. L'absence est un état honnête.
 */
const BIO_STALE_MS = 10000;

/** Point de sparkline attendu par BiometryStrip ({ts, hr}). */
export interface LiveBioPoint {
  ts: number;
  hr: number;
}

export function usePilotLive(sessionId: string | null): {
  frame: LiveFrame | null;
  conn: LiveConn;
  /** Dernier événement biométrique reçu, ou null si le pilote n'en émet pas. */
  bio: BiometryLiveEvent | null;
  /** Série FC des 60 dernières secondes (sparkline). Vide si aucune biométrie. */
  bioSeries: LiveBioPoint[];
} {
  const [frame, setFrame] = useState<LiveFrame | null>(null);
  const [conn, setConn] = useState<LiveConn>('connecting');
  const [bio, setBio] = useState<BiometryLiveEvent | null>(null);
  const [bioSeries, setBioSeries] = useState<LiveBioPoint[]>([]);
  const subscribedRef = useRef(false);
  const lastFrameMsRef = useRef<number | null>(null);
  /** Dernier événement cardio reçu — sert à PÉRIMER la biométrie (cf. BIO_STALE_MS). */
  const lastBioMsRef = useRef<number | null>(null);

  // Le lecteur de ce hook EST le coach : son canal biométrie porte son identité.
  // On la lit ici plutôt que de la faire passer par tous les appelants.
  const coachId = useAuthStore((st) => st.profile?.id ?? null);

  useEffect(() => {
    if (!sessionId) {
      setConn('offline');
      return;
    }
    // Garde de montage : removeChannel est asynchrone, une trame en vol peut
    // encore appeler onFrame après le démontage → on n'écrit plus d'état alors.
    let active = true;
    subscribedRef.current = false;
    lastFrameMsRef.current = null;
    lastBioMsRef.current = null;
    setFrame(null);
    setConn('connecting');
    setBio(null);
    setBioSeries([]);

    const unsubFrames = subscribePilotStream(sessionId, {
      onFrame: (f) => {
        if (!active) return;
        lastFrameMsRef.current = Date.now();
        setFrame(f);
      },
      onStatus: (subscribed) => {
        subscribedRef.current = subscribed;
      },
    });

    // BIO — canal PROPRE à ce coach (`live:bio:<coachId>:<sessionId>`, lot
    // 27a-bis). Sans compte connu, on n'ouvre rien : le cardio n'a pas de
    // Tick : réévalue l'état même sans nouvelle trame (live → stale → offline).
    const tick = setInterval(() => {
      if (!active) return;
      const now = Date.now();
      setConn(
        deriveLiveConn({
          subscribed: subscribedRef.current,
          lastFrameMs: lastFrameMsRef.current,
          nowMs: now,
        })
      );
      // Péremption du cardio : le flux s'est tu (révocation en vol, ceinture
      // décrochée, réseau tombé) → on efface au lieu de figer une FC périmée.
      if (lastBioMsRef.current !== null && now - lastBioMsRef.current >= BIO_STALE_MS) {
        lastBioMsRef.current = null;
        setBio(null);
        setBioSeries([]);
      }
    }, 1000);

    return () => {
      active = false;
      clearInterval(tick);
      unsubFrames();
    };
    // `coachId` est VOLONTAIREMENT absent : cet effet possède la télémétrie et
    // tout l'état d'affichage. L'y mettre rendait la fiche direct otage d'un
    // simple rafraîchissement de jeton — si `fetchProfile` échoue (réseau du
    // circuit), `profile.id` passe à null, l'effet se rejoue, et le coach voit
    // sa fiche se vider en pleine séance alors que le flux est intact.
    // Relevé par la revue adversariale du 01/08/2026.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  /**
   * BIO — effet SÉPARÉ, sur SON canal (`live:bio:<coachId>:<sessionId>`).
   *
   * Séparé parce qu'il dépend du compte connecté, et que la télémétrie ne doit
   * pas en dépendre. Sans compte connu, on n'ouvre rien : le cardio n'a pas de
   * destinataire anonyme.
   *
   * Le coach ne fait qu'AFFICHER — aucune alerte, aucun diagnostic. La série est
   * bornée à la fenêtre visible ; rien n'est accumulé au-delà.
   */
  useEffect(() => {
    if (!sessionId || !coachId) return;
    let vivant = true;
    const unsub = subscribeBiometry(coachId, sessionId, (e) => {
      if (!vivant) return;
      lastBioMsRef.current = Date.now();
      setBio(e);
      setBioSeries((prev) => {
        const next = [...prev, { ts: e.atMs, hr: e.hrBpm }];
        const cutoff = e.atMs - BIO_WINDOW_MS;
        return next.filter((p) => p.ts >= cutoff);
      });
    });
    return () => {
      vivant = false;
      unsub();
      // On quitte un canal de santé : ce qu'on en avait lu ne reste pas à
      // l'écran. Une FC figée passerait pour du direct.
      lastBioMsRef.current = null;
      setBio(null);
      setBioSeries([]);
    };
  }, [sessionId, coachId]);

  return { frame, conn, bio, bioSeries };
}
