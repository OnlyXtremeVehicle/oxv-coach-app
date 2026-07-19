/**
 * useHeritageBook — génération du Carnet Heritage (V2-L5 CLUB, Mission D, C3).
 *
 * Fine enveloppe autour de generateAndShareHeritageBook : elle porte l'état de
 * progression (0..1, pour le Dial) et un message d'échec honnête. Le gating du
 * tier est fait EN AMONT par l'écran (heritageBookVisible) et re-vérifié dans le
 * service (fail-closed) — ici on ne rejoue pas la doctrine, on pilote l'UI.
 */

import { useCallback, useRef, useState } from 'react';

import {
  generateAndShareHeritageBook,
  type HeritageBookOutcome,
} from '@/services/heritageBookExportService';

export interface HeritageBookGen {
  /** Progression 0..1 pendant la génération, null au repos. */
  progress: number | null;
  generating: boolean;
  /** Message d'échec (hors 'not_heritage', filtré en amont), ou null. */
  error: string | null;
  generate: () => void;
}

function reasonMessage(
  reason: Exclude<HeritageBookOutcome, { ok: true }>['reason']
): string | null {
  switch (reason) {
    case 'no_sessions':
      return 'Aucune séance à graver pour cette saison.';
    case 'no_auth':
      return 'Session expirée. Reconnectez-vous.';
    case 'error':
      return "Le carnet n'a pas pu être généré. Réessayez dans un instant.";
    // 'not_heritage' : impossible ici (section masquée en amont) — silencieux.
    default:
      return null;
  }
}

export function useHeritageBook(): HeritageBookGen {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const generate = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    setProgress(0);
    generateAndShareHeritageBook({ onProgress: (f) => setProgress(f) })
      .then((res) => {
        if (!res.ok) setError(reasonMessage(res.reason));
      })
      .catch(() => {
        setError("Le carnet n'a pas pu être généré. Réessayez dans un instant.");
      })
      .finally(() => {
        busy.current = false;
        // Retour au repos : le Dial se vide, la carte redevient disponible.
        setProgress(null);
      });
  }, []);

  return { progress, generating: progress !== null, error, generate };
}
