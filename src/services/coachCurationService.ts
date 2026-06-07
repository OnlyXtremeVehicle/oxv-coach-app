/**
 * Service curation coach (§10.3c B+C) — accès Supabase.
 *
 * B — priorisation du bilan : le coach met en avant des virages pour un
 *     pilote ; le pilote lit la priorisation posée sur lui.
 * C — gabarits de commentaire : CRUD côté coach uniquement.
 *
 * Logique pure dans `coachCurationLogic.ts`. Voir migration 0039.
 */

import { supabase } from '@/lib/supabase';

import {
  type CoachAnnotationTemplate,
  type CoachPilotHighlight,
  type HighlightInput,
  type TemplateInput,
  normalizeHighlightIndexes,
} from './coachCurationLogic';

// --- B : priorisation -------------------------------------------------------

interface HighlightRow {
  id: string;
  coach_id: string;
  pilot_id: string;
  highlight_corner_indexes: number[] | null;
  note: string | null;
  updated_at: string;
}

function mapHighlight(row: HighlightRow): CoachPilotHighlight {
  return {
    id: row.id,
    coachId: row.coach_id,
    pilotId: row.pilot_id,
    highlightCornerIndexes: row.highlight_corner_indexes ?? [],
    note: row.note,
    updatedAt: row.updated_at,
  };
}

/** Priorisation que le coach courant a posée sur un pilote (ou null). */
export async function getMyHighlightForPilot(pilotId: string): Promise<CoachPilotHighlight | null> {
  const { data, error } = await supabase
    .from('coach_pilot_highlight' as never)
    .select('*' as never)
    .eq('pilot_id', pilotId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.warn('[coachCuration] getMyHighlightForPilot error:', error.message);
    return null;
  }
  return mapHighlight(data as unknown as HighlightRow);
}

/** Priorisations posées sur le pilote courant (toutes ses coachs). */
export async function listHighlightsForMe(): Promise<CoachPilotHighlight[]> {
  const { data, error } = await supabase
    .from('coach_pilot_highlight' as never)
    .select('*' as never);

  if (error || !data) {
    if (error) console.warn('[coachCuration] listHighlightsForMe error:', error.message);
    return [];
  }
  return (data as unknown as HighlightRow[]).map(mapHighlight);
}

/** Crée ou met à jour la priorisation du coach courant pour un pilote. */
export async function upsertHighlight(
  pilotId: string,
  input: HighlightInput
): Promise<CoachPilotHighlight | null> {
  const { data: authData } = await supabase.auth.getUser();
  const coachId = authData?.user?.id;
  if (!coachId) return null;

  const note = input.note?.trim() || null;
  const payload = {
    coach_id: coachId,
    pilot_id: pilotId,
    highlight_corner_indexes: normalizeHighlightIndexes(input.highlightCornerIndexes),
    note,
  };

  const { data, error } = await supabase
    .from('coach_pilot_highlight' as never)
    .upsert(payload as never, { onConflict: 'coach_id,pilot_id' } as never)
    .select('*' as never)
    .single();

  if (error || !data) {
    if (error) console.warn('[coachCuration] upsertHighlight error:', error.message);
    return null;
  }
  return mapHighlight(data as unknown as HighlightRow);
}

// --- C : gabarits -----------------------------------------------------------

interface TemplateRow {
  id: string;
  coach_id: string;
  label: string;
  body: string;
  updated_at: string;
}

function mapTemplate(row: TemplateRow): CoachAnnotationTemplate {
  return {
    id: row.id,
    coachId: row.coach_id,
    label: row.label,
    body: row.body,
    updatedAt: row.updated_at,
  };
}

/** Gabarits du coach courant (triés par nom). */
export async function listMyTemplates(): Promise<CoachAnnotationTemplate[]> {
  const { data, error } = await supabase
    .from('coach_annotation_template' as never)
    .select('*' as never)
    .order('label', { ascending: true });

  if (error || !data) {
    if (error) console.warn('[coachCuration] listMyTemplates error:', error.message);
    return [];
  }
  return (data as unknown as TemplateRow[]).map(mapTemplate);
}

/** Crée un gabarit pour le coach courant. */
export async function createTemplate(
  input: TemplateInput
): Promise<CoachAnnotationTemplate | null> {
  const { data: authData } = await supabase.auth.getUser();
  const coachId = authData?.user?.id;
  if (!coachId) return null;

  const { data, error } = await supabase
    .from('coach_annotation_template' as never)
    .insert({ coach_id: coachId, label: input.label.trim(), body: input.body.trim() } as never)
    .select('*' as never)
    .single();

  if (error || !data) {
    if (error) console.warn('[coachCuration] createTemplate error:', error.message);
    return null;
  }
  return mapTemplate(data as unknown as TemplateRow);
}

/** Supprime un gabarit du coach courant. */
export async function deleteTemplate(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('coach_annotation_template' as never)
    .delete()
    .eq('id', id);

  if (error) {
    console.warn('[coachCuration] deleteTemplate error:', error.message);
    return false;
  }
  return true;
}
