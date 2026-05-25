/**
 * useDetailLevel — détermine si l'écran doit afficher en mode simple
 * (un seul chiffre clair, étiquettes humaines) ou détaillé (métriques
 * pro, deltas signés, valeurs précises).
 *
 * Doctrine OXV :
 *   - Pilote particulier : SIMPLE par défaut. Il peut basculer en
 *     détaillé via un toggle local s'il est curieux.
 *   - Coach : DÉTAILLÉ par défaut. Il a besoin des chiffres exacts
 *     pour interpréter et conseiller.
 *   - Admin OXV : DÉTAILLÉ par défaut (rôle d'observation technique).
 *
 * Le mode reste local à l'écran (pas de persistance pour V1) ; chaque
 * écran décide d'exposer ou pas le toggle visuellement.
 */

import { useState } from 'react';

import { useAuthStore } from '@/store/useAuthStore';

import { type DetailLevel, canToggleForRole, defaultLevelForRole } from './detailLevelLogic';

// Re-export pour les écrans qui importaient depuis ce fichier
export { type DetailLevel, canToggleForRole, defaultLevelForRole } from './detailLevelLogic';

export function useDetailLevel(): {
  level: DetailLevel;
  toggle: () => void;
  /** True si l'utilisateur est dans un contexte qui propose le toggle (pilote). */
  canToggle: boolean;
} {
  const role = useAuthStore((s) => s.profile?.role);
  const [level, setLevel] = useState<DetailLevel>(defaultLevelForRole(role));

  return {
    level,
    toggle: () => setLevel((l) => (l === 'simple' ? 'detailed' : 'simple')),
    canToggle: canToggleForRole(role),
  };
}
