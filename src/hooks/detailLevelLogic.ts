/**
 * Logique pure du DetailLevel (séparée du hook React pour être testable
 * sans dépendre de Supabase ni du store auth).
 */

export type DetailLevel = 'simple' | 'detailed';

type Role = 'pilot' | 'coach' | 'admin' | null | undefined;

/**
 * Coach et admin ont le mode détaillé par défaut (besoin pro des chiffres
 * exacts). Pilote (et fallback) : mode simple.
 */
export function defaultLevelForRole(role: Role): DetailLevel {
  return role === 'coach' || role === 'admin' ? 'detailed' : 'simple';
}

/**
 * Seuls les pilotes peuvent basculer le mode (les pros sont fixés sur
 * détaillé pour éviter qu'un coach passe accidentellement en simple).
 */
export function canToggleForRole(role: Role): boolean {
  return role !== 'coach' && role !== 'admin';
}
