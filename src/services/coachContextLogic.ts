/**
 * Logique pure des paramètres contextuels coach (§10.3 OXV Mirror).
 *
 * Aucune dépendance Supabase / RN : module unitairement testable (Jest).
 * Voir migration 20260526220000_0037_coach_session_context.sql.
 */

/** Contexte saisi par le coach sur une session d'un élève. */
export interface SessionContext {
  id: string;
  coachId: string;
  pilotId: string;
  sessionId: string;
  pilotLevel: string | null;
  objective: string | null;
  equipment: string | null;
  weatherNote: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Saisie / mise à jour du contexte (champs optionnels). */
export interface SessionContextInput {
  pilotLevel?: string | null;
  objective?: string | null;
  equipment?: string | null;
  weatherNote?: string | null;
}

/** Libellés FR sobres des champs de contexte (doctrine OXV). */
export const CONTEXT_FIELD_LABELS = {
  pilotLevel: 'Niveau',
  objective: 'Objectif travaillé',
  equipment: 'Matériel',
  weatherNote: 'Météo vécue',
} as const;

type ContextField = keyof typeof CONTEXT_FIELD_LABELS;

const CONTEXT_FIELD_ORDER: ContextField[] = ['pilotLevel', 'objective', 'equipment', 'weatherNote'];

/** Vrai si au moins un champ du contexte est renseigné (non vide). */
export function contextHasContent(input: SessionContextInput): boolean {
  return CONTEXT_FIELD_ORDER.some((f) => {
    const v = input[f];
    return typeof v === 'string' && v.trim().length > 0;
  });
}

/**
 * Construit les lignes affichables (label + valeur) d'un contexte, en
 * ignorant les champs vides, dans l'ordre canonique. Sert au rendu côté
 * pilote (bilan) comme côté coach (récap).
 */
export function buildContextRows(
  context: SessionContextInput
): { field: ContextField; label: string; value: string }[] {
  const rows: { field: ContextField; label: string; value: string }[] = [];
  for (const f of CONTEXT_FIELD_ORDER) {
    const v = context[f];
    if (typeof v === 'string' && v.trim().length > 0) {
      rows.push({ field: f, label: CONTEXT_FIELD_LABELS[f], value: v.trim() });
    }
  }
  return rows;
}
