/**
 * Service annotations coach — CRUD des notes attachées à un virage
 * d'un pilote.
 *
 * RLS : voir migration 0020.
 *   - Coach : CRUD sur ses propres notes (où coach_id = auth.uid())
 *   - Pilote : SELECT lecture seule sur visibility='shared' non supprimées
 *   - Admin : SELECT toutes
 */

import { supabase } from '@/lib/supabase';
import { OxvEvent } from '@/services/analyticsEvents';

export type AnnotationVisibility = 'private' | 'shared';

export interface CoachAnnotation {
  id: string;
  coachId: string;
  pilotId: string;
  telemetrySessionId: string | null;
  cornerIndex: number;
  body: string;
  visibility: AnnotationVisibility;
  createdAt: string;
  updatedAt: string;
}

interface RawRow {
  id: string;
  coach_id: string;
  pilot_id: string;
  telemetry_session_id: string | null;
  corner_index: number;
  body: string;
  visibility: AnnotationVisibility;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function mapRow(row: RawRow): CoachAnnotation {
  return {
    id: row.id,
    coachId: row.coach_id,
    pilotId: row.pilot_id,
    telemetrySessionId: row.telemetry_session_id,
    cornerIndex: row.corner_index,
    body: row.body,
    visibility: row.visibility,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Liste les annotations visibles pour le pilote sur un virage donné.
 *
 * Côté pilote : RLS filtre déjà sur pilot_id=auth.uid() + shared + non
 * supprimées. On renvoie d'abord celles attachées à la session courante
 * (plus contextuelles), puis les notes génériques (sessionId=null).
 */
export async function listVisibleAnnotationsForCorner(
  pilotId: string,
  cornerIndex: number,
  sessionId?: string | null
): Promise<CoachAnnotation[]> {
  let query = supabase
    .from('coach_annotations')
    // Cast nécessaire le temps que database.types regen connaisse la table
    .select('*')
    .eq('pilot_id', pilotId)
    .eq('corner_index', cornerIndex)
    .order('created_at', { ascending: false });

  if (sessionId) {
    // Inclut les notes spécifiques à cette session ET les notes génériques
    query = query.or(`telemetry_session_id.eq.${sessionId},telemetry_session_id.is.null`);
  }

  const { data, error } = await query;
  if (error) {
    console.warn('[OXV][annotations] list :', error.message);
    return [];
  }
  return (data as unknown as RawRow[]).map(mapRow);
}

/**
 * Côté coach : liste ses annotations sur un virage d'un pilote suivi.
 * Filtre par sessionId si fourni (sinon toutes les notes du virage).
 */
export async function listMyAnnotationsForCorner(
  pilotId: string,
  cornerIndex: number,
  sessionId?: string | null
): Promise<CoachAnnotation[]> {
  let query = supabase
    .from('coach_annotations')
    .select('*')
    .eq('pilot_id', pilotId)
    .eq('corner_index', cornerIndex)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (sessionId !== undefined) {
    if (sessionId === null) {
      query = query.is('telemetry_session_id', null);
    } else {
      query = query.eq('telemetry_session_id', sessionId);
    }
  }

  const { data, error } = await query;
  if (error) {
    console.warn('[OXV][annotations] listMine :', error.message);
    return [];
  }
  return (data as unknown as RawRow[]).map(mapRow);
}

export interface CreateAnnotationInput {
  pilotId: string;
  cornerIndex: number;
  telemetrySessionId?: string | null;
  body: string;
  visibility?: AnnotationVisibility;
}

export async function createAnnotation(
  input: CreateAnnotationInput
): Promise<CoachAnnotation | null> {
  const { data: authData } = await supabase.auth.getUser();
  const coachId = authData?.user?.id;
  if (!coachId) {
    console.warn('[OXV][annotations] create : pas de user connecté');
    return null;
  }

  const { data, error } = await supabase
    .from('coach_annotations')
    .insert({
      coach_id: coachId,
      pilot_id: input.pilotId,
      telemetry_session_id: input.telemetrySessionId ?? null,
      corner_index: input.cornerIndex,
      body: input.body.trim(),
      visibility: input.visibility ?? 'shared',
    })
    .select('*')
    .single();

  if (error || !data) {
    console.warn('[OXV][annotations] create :', error?.message ?? 'no data');
    return null;
  }
  OxvEvent.coachNoteEnvoyee(); // KPI coach_note_delivery (§27)
  return mapRow(data as unknown as RawRow);
}

export async function updateAnnotation(
  id: string,
  patch: { body?: string; visibility?: AnnotationVisibility }
): Promise<boolean> {
  const update: { body?: string; visibility?: AnnotationVisibility } = {};
  if (patch.body !== undefined) update.body = patch.body.trim();
  if (patch.visibility !== undefined) update.visibility = patch.visibility;

  const { error } = await supabase.from('coach_annotations').update(update).eq('id', id);

  if (error) {
    console.warn('[OXV][annotations] update :', error.message);
    return false;
  }
  return true;
}

/**
 * Suppression soft (deleted_at = now). RLS rendra la note invisible
 * au pilote dès le prochain SELECT.
 */
export async function deleteAnnotation(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('coach_annotations')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.warn('[OXV][annotations] delete :', error.message);
    return false;
  }
  return true;
}
