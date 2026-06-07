/**
 * Service paramètres contextuels coach (§10.3 OXV Mirror) — accès Supabase.
 *
 * - Coach : crée / met à jour le contexte d'une session de son élève.
 * - Pilote : lit le contexte de ses propres sessions (via RLS).
 *
 * Une seule ligne par coach et par session (upsert sur coach_id+session_id).
 * La logique pure (champs, affichage) vit dans `coachContextLogic.ts`.
 * Voir migration 20260526220000_0037_coach_session_context.sql.
 */

import { supabase } from '@/lib/supabase';

import { type SessionContext, type SessionContextInput } from './coachContextLogic';

interface ContextRow {
  id: string;
  coach_id: string;
  pilot_id: string;
  session_id: string;
  pilot_level: string | null;
  objective: string | null;
  equipment: string | null;
  weather_note: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: ContextRow): SessionContext {
  return {
    id: row.id,
    coachId: row.coach_id,
    pilotId: row.pilot_id,
    sessionId: row.session_id,
    pilotLevel: row.pilot_level,
    objective: row.objective,
    equipment: row.equipment,
    weatherNote: row.weather_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Nettoie une valeur de champ : trim, ou null si vide. */
function clean(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/**
 * Contexte d'une session. La RLS renvoie :
 *   - au coach : sa propre ligne de contexte ;
 *   - au pilote : le contexte que son coach a posé sur sa session.
 * Retourne `null` si aucun contexte.
 */
export async function getSessionContext(sessionId: string): Promise<SessionContext | null> {
  const { data, error } = await supabase
    .from('coach_session_context' as never)
    .select('*' as never)
    .eq('session_id', sessionId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.warn('[coachContext] getSessionContext error:', error.message);
    return null;
  }
  return mapRow(data as unknown as ContextRow);
}

/**
 * Crée ou met à jour le contexte d'une session pour le coach courant.
 * coach_id est forcé à l'utilisateur courant (la RLS l'exige). Retourne le
 * contexte enregistré ou `null` en cas d'échec.
 */
export async function upsertSessionContext(
  pilotId: string,
  sessionId: string,
  input: SessionContextInput
): Promise<SessionContext | null> {
  const { data: authData } = await supabase.auth.getUser();
  const coachId = authData?.user?.id;
  if (!coachId) return null;

  const payload = {
    coach_id: coachId,
    pilot_id: pilotId,
    session_id: sessionId,
    pilot_level: clean(input.pilotLevel),
    objective: clean(input.objective),
    equipment: clean(input.equipment),
    weather_note: clean(input.weatherNote),
  };

  const { data, error } = await supabase
    .from('coach_session_context' as never)
    .upsert(payload as never, { onConflict: 'coach_id,session_id' } as never)
    .select('*' as never)
    .single();

  if (error || !data) {
    if (error) console.warn('[coachContext] upsertSessionContext error:', error.message);
    return null;
  }
  return mapRow(data as unknown as ContextRow);
}
