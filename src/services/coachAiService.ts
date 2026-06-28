/**
 * Service assistant IA coach (C-1) — côté app coach.
 *
 * Doctrine : l'IA PRÉ-RÉDIGE, le coach VALIDE. Aucune sortie n'atteint le pilote
 * sans validation humaine. La génération et la validation passent par des edge
 * functions qui filtrent le texte CÔTÉ SERVEUR (le coach ne voit jamais une
 * faute ; le texte édité est re-filtré avant publication). Ce service n'orchestre
 * que les appels et la lecture own-coach (RLS).
 */

import { supabase } from '@/lib/supabase';

export type CoachAiDraftStatus = 'draft' | 'validated' | 'discarded';

export interface CoachAiDraft {
  id: string;
  pilotId: string;
  telemetrySessionId: string | null;
  cornerIndex: number;
  generatedText: string;
  status: CoachAiDraftStatus;
  provenance: string;
  resultingAnnotationId: string | null;
  createdAt: string;
}

function mapDraft(r: Record<string, unknown>): CoachAiDraft {
  return {
    id: r.id as string,
    pilotId: r.pilot_id as string,
    telemetrySessionId: (r.telemetry_session_id as string | null) ?? null,
    cornerIndex: Number(r.corner_index),
    generatedText: r.generated_text as string,
    status: r.status as CoachAiDraftStatus,
    provenance: (r.provenance as string) ?? 'openai_gpt-4o-mini',
    resultingAnnotationId: (r.resulting_annotation_id as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}

export interface DraftResult {
  ok: boolean;
  draftId?: string;
  text?: string;
  /** Code d'erreur edge : 'coach_ai_not_allowed' | 'doctrine_violation' | … */
  error?: string;
}

/**
 * Demande à l'IA un brouillon d'observation sur un virage. L'edge vérifie le
 * consentement (fail-closed) et filtre la sortie. Retourne le brouillon en
 * status='draft' — rien n'est envoyé au pilote.
 */
export async function requestDraft(input: {
  pilotId: string;
  sessionId: string;
  cornerIndex: number;
}): Promise<DraftResult> {
  const { data, error } = await supabase.functions.invoke('coach-ai-draft', {
    body: {
      pilotId: input.pilotId,
      sessionId: input.sessionId,
      cornerIndex: input.cornerIndex,
    },
  });
  if (error) {
    // L'edge renvoie un statut non-2xx avec un corps {error}. On tente de le lire.
    const ctx = (error as { context?: { error?: string } })?.context;
    return { ok: false, error: ctx?.error ?? error.message };
  }
  const res = data as DraftResult;
  return res?.ok ? res : { ok: false, error: res?.error ?? 'unknown' };
}

/** Mes brouillons (RLS : coach détaillé consenti, own-coach). */
export async function listMyDrafts(status?: CoachAiDraftStatus): Promise<CoachAiDraft[]> {
  let query = supabase
    .from('coach_ai_drafts')
    .select(
      'id, pilot_id, telemetry_session_id, corner_index, generated_text, status, provenance, resulting_annotation_id, created_at'
    )
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) {
    console.warn('[OXV][coachAi] listMyDrafts :', error.message);
    return [];
  }
  return (data ?? []).map((r) => mapDraft(r as Record<string, unknown>));
}

/** Rejette un brouillon (status='discarded'). Permis par la RLS coach. */
export async function discardDraft(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('coach_ai_drafts')
    .update({ status: 'discarded' } as never)
    .eq('id', id);
  if (error) {
    console.warn('[OXV][coachAi] discardDraft :', error.message);
    return false;
  }
  return true;
}

export interface ValidateResult {
  ok: boolean;
  annotationId?: string;
  error?: string;
}

/**
 * Valide un brouillon (éventuellement édité) : l'edge re-filtre le texte côté
 * serveur, crée l'annotation coach_annotations (ai_assisted) et marque le
 * brouillon 'validated'. C'est le seul chemin vers le pilote.
 */
export async function validateDraft(input: {
  draftId: string;
  editedText: string;
  visibility: 'private' | 'shared';
}): Promise<ValidateResult> {
  const { data, error } = await supabase.functions.invoke('coach-ai-validate', {
    body: {
      draftId: input.draftId,
      editedText: input.editedText,
      visibility: input.visibility,
    },
  });
  if (error) {
    const ctx = (error as { context?: { error?: string } })?.context;
    return { ok: false, error: ctx?.error ?? error.message };
  }
  const res = data as ValidateResult;
  return res?.ok ? res : { ok: false, error: res?.error ?? 'unknown' };
}
