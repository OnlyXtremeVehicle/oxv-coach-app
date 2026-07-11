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

import { type LiveConn, type LiveFrame, deriveLiveConn } from '@/services/liveSessionLogic';
import { subscribePilotStream } from '@/services/liveSessionService';

export function usePilotLive(sessionId: string | null): {
  frame: LiveFrame | null;
  conn: LiveConn;
} {
  const [frame, setFrame] = useState<LiveFrame | null>(null);
  const [conn, setConn] = useState<LiveConn>('connecting');
  const subscribedRef = useRef(false);
  const lastFrameMsRef = useRef<number | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setConn('offline');
      return;
    }
    subscribedRef.current = false;
    lastFrameMsRef.current = null;
    setFrame(null);
    setConn('connecting');

    const unsub = subscribePilotStream(sessionId, {
      onFrame: (f) => {
        lastFrameMsRef.current = Date.now();
        setFrame(f);
      },
      onStatus: (subscribed) => {
        subscribedRef.current = subscribed;
      },
    });

    // Tick : réévalue l'état même sans nouvelle trame (live → stale → offline).
    const tick = setInterval(() => {
      setConn(
        deriveLiveConn({
          subscribed: subscribedRef.current,
          lastFrameMs: lastFrameMsRef.current,
          nowMs: Date.now(),
        })
      );
    }, 1000);

    return () => {
      clearInterval(tick);
      unsub();
    };
  }, [sessionId]);

  return { frame, conn };
}
