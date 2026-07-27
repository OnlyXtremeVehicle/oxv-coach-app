/**
 * Résout le NOM du circuit d'une séance, pour armer la garde de `CircuitMap`.
 *
 * `CircuitMap.circuitName` est obligatoire depuis que la garde multi-circuit a
 * été rendue infranchissable : dix écrans doivent donc fournir ce nom. Ce hook
 * évite d'écrire dix fois la même résolution — et surtout la même subtilité.
 *
 * LA SUBTILITÉ : `resolving`. Tant que la requête n'a pas répondu, le nom est
 * `null`, ce qui signifie pour la carte « circuit inconnu, je ne dessine pas ».
 * Sans ce drapeau, chaque écran afficherait donc brièvement « circuit non
 * identifié » avant de faire apparaître le tracé — un message d'absence qui
 * clignote alors que rien ne manque. Les écrans replient `resolving` dans leur
 * état de chargement existant.
 */

import { useEffect, useState } from 'react';

import { fetchSessionCircuitName } from '@/services/circuitsService';

export interface SessionCircuitName {
  /** `null` = inconnu ou non résolu. Passé tel quel à `CircuitMap`. */
  circuitName: string | null;
  /** `true` tant que la requête est en vol. */
  resolving: boolean;
}

export function useSessionCircuitName(sessionId: string | null | undefined): SessionCircuitName {
  const [circuitName, setCircuitName] = useState<string | null>(null);
  const [resolving, setResolving] = useState<boolean>(Boolean(sessionId));

  useEffect(() => {
    if (!sessionId) {
      setCircuitName(null);
      setResolving(false);
      return;
    }
    let vivant = true;
    setResolving(true);
    fetchSessionCircuitName(sessionId)
      .then((nom) => {
        if (vivant) setCircuitName(nom);
      })
      .catch(() => {
        // Une lecture en échec vaut un circuit inconnu : la carte se taira,
        // ce qui est le comportement voulu. Rien à signaler au pilote.
        if (vivant) setCircuitName(null);
      })
      .finally(() => {
        if (vivant) setResolving(false);
      });
    return () => {
      vivant = false;
    };
  }, [sessionId]);

  return { circuitName, resolving };
}
