/**
 * Service carnet pilote — notes libres post-session (table `pilot_notes`, 0025).
 *
 * Espace INTIME du pilote : own-row strict. L'app n'écrit, ne pré-remplit ni ne
 * suggère JAMAIS le contenu (doctrine V5 P-E) — ce service ne fait que stocker et
 * relire ce que le pilote a écrit. Aucune génération, aucune IA, aucun jugement.
 *
 * Partage : opt-in PAR NOTE (`shared_with_coach`). Quand le pilote partage, son
 * coach consenti lit la note EN LECTURE SEULE (RLS pilot_notes_coach_select).
 * Révocable immédiatement (repasser le flag à false). Le partenaire n'accède
 * jamais. L'accès coach est journalisé via log_coach_view (RGPD).
 */

import { supabase } from '@/lib/supabase';

export interface PilotNote {
  id: string;
  sessionId: string | null;
  body: string;
  sharedWithCoach: boolean;
  createdAt: string;
  updatedAt: string;
}

const COLS = 'id, session_id, body, shared_with_coach, created_at, updated_at';

function mapNote(r: Record<string, unknown>): PilotNote {
  return {
    id: r.id as string,
    sessionId: (r.session_id as string | null) ?? null,
    body: r.body as string,
    sharedWithCoach: Boolean(r.shared_with_coach),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export interface MutationResult {
  ok: boolean;
  id?: string;
  error?: string;
}

/** Mes notes (RLS own-row), de la plus récente à la plus ancienne. */
export async function listMyNotes(): Promise<PilotNote[]> {
  const { data, error } = await supabase
    .from('pilot_notes')
    .select(COLS)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[OXV][carnet] listMyNotes :', error.message);
    return [];
  }
  return (data ?? []).map((r) => mapNote(r as Record<string, unknown>));
}

/**
 * Crée une note. Le texte vient du pilote, jamais d'un gabarit. `sessionId` est
 * un lien optionnel (rattacher la note à une séance) — jamais une pré-saisie de
 * contenu.
 */
export async function addNote(body: string, sessionId?: string | null): Promise<MutationResult> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { ok: false, error: 'Session expirée.' };
  const text = body.trim();
  if (!text) return { ok: false, error: 'Note vide.' };

  const { data, error } = await supabase
    .from('pilot_notes')
    .insert({ user_id: uid, body: text, session_id: sessionId ?? null } as never)
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Enregistrement impossible.' };
  return { ok: true, id: (data as { id: string }).id };
}

/** Édite le corps d'une note existante (le pilote corrige son propre texte). */
export async function updateNoteBody(id: string, body: string): Promise<MutationResult> {
  const text = body.trim();
  if (!text) return { ok: false, error: 'Note vide.' };
  const { error } = await supabase
    .from('pilot_notes')
    .update({ body: text } as never)
    .eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true, id };
}

/**
 * Partage / retire le partage d'une note avec le coach. Acte explicite et
 * révocable : false coupe l'accès coach immédiatement (RLS).
 */
export async function setNoteShared(id: string, shared: boolean): Promise<MutationResult> {
  const { error } = await supabase
    .from('pilot_notes')
    .update({ shared_with_coach: shared } as never)
    .eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true, id };
}

/** Supprime franchement une note (souveraineté du pilote sur ses données). */
export async function deleteNote(id: string): Promise<MutationResult> {
  const { error } = await supabase.from('pilot_notes').delete().eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true, id };
}

/**
 * Vue COACH (lecture seule) : les notes qu'un pilote suivi a explicitement
 * partagées. La RLS pilot_notes_coach_select garantit qu'on ne reçoit QUE les
 * notes `shared_with_coach = true` d'un pilote dont on est coach consenti.
 * L'accès est journalisé (log_coach_view) pour la conformité RGPD.
 */
export async function listSharedNotesForPilot(pilotId: string): Promise<PilotNote[]> {
  const { data, error } = await supabase
    .from('pilot_notes')
    .select(COLS)
    .eq('user_id', pilotId)
    .eq('shared_with_coach', true)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[OXV][carnet] listSharedNotesForPilot :', error.message);
    return [];
  }
  const notes = (data ?? []).map((r) => mapNote(r as Record<string, unknown>));
  if (notes.length > 0) {
    // Journalisation RGPD (best effort, ne bloque jamais l'affichage).
    await supabase
      .rpc('log_coach_view', { target_pilot_uuid: pilotId, action_subtype: 'carnet_view' })
      .then(
        () => undefined,
        () => undefined
      );
  }
  return notes;
}
