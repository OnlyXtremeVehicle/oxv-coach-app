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

import { useEffect, useState } from 'react';

import { STORAGE_KEYS, storage } from '@/lib/mmkv';
import { useAuthStore } from '@/store/useAuthStore';

import { type DetailLevel, canToggleForRole, defaultLevelForRole } from './detailLevelLogic';

// Re-export pour les écrans qui importaient depuis ce fichier
export { type DetailLevel, canToggleForRole, defaultLevelForRole } from './detailLevelLogic';

/**
 * Renvoie la clé MMKV namespacée par userId. Permet à 2 comptes sur le
 * même device (rare mais possible en alpha) d'avoir des préférences
 * séparées sans s'écraser mutuellement.
 */
function prefKey(userId: string | undefined): string {
  return userId ? `${STORAGE_KEYS.PREF_DETAIL_LEVEL}:${userId}` : STORAGE_KEYS.PREF_DETAIL_LEVEL;
}

/**
 * Lit le niveau persisté pour cet utilisateur, ou null si jamais set.
 */
function readPersistedLevel(userId: string | undefined): DetailLevel | null {
  const raw = storage.getString(prefKey(userId));
  if (raw === 'simple' || raw === 'detailed') return raw;
  return null;
}

export function useDetailLevel(): {
  level: DetailLevel;
  toggle: () => void;
  /** True si l'utilisateur est dans un contexte qui propose le toggle (pilote). */
  canToggle: boolean;
} {
  const profile = useAuthStore((s) => s.profile);
  const role = profile?.role;
  const userId = profile?.id;

  // Initial : persisté > défaut selon rôle
  const [level, setLevel] = useState<DetailLevel>(
    () => readPersistedLevel(userId) ?? defaultLevelForRole(role)
  );

  // Si l'identité change (login/logout/switch), recharge la préférence
  useEffect(() => {
    setLevel(readPersistedLevel(userId) ?? defaultLevelForRole(role));
  }, [userId, role]);

  return {
    level,
    toggle: () => {
      setLevel((l) => {
        const next: DetailLevel = l === 'simple' ? 'detailed' : 'simple';
        // Persiste seulement pour les pilotes (les pros sont fixés par défaut)
        if (canToggleForRole(role)) {
          storage.set(prefKey(userId), next);
        }
        return next;
      });
    },
    canToggle: canToggleForRole(role),
  };
}
