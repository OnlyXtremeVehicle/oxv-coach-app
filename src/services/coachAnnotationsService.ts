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
import { isDoctrineSafe } from '@/services/aiSafetyFilter';
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
  /** Observation pré-rédigée par l'assistant IA puis validée par le coach. */
  aiAssisted: boolean;
  /**
   * Note vocale attachée (PR-59) — URL du fichier audio dans le bucket coach.
   * `null` tant qu'aucun audio n'est joint. La lecture passe par cette URL ;
   * l'ENREGISTREMENT nécessite un module natif — `expo-audio` depuis le lot
   *   T0 (expo-av retiré du projet) — à éprouver sur un build natif.
   */
  audioUrl: string | null;
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
  ai_assisted: boolean | null;
  audio_url: string | null;
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
    aiAssisted: row.ai_assisted === true,
    audioUrl: row.audio_url ?? null,
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

  // Garde-fou doctrinal app (UX) : une note PARTAGÉE ne peut pas être prescriptive.
  // Le rempart réel est le trigger en base (0026) ; ici on évite l'aller-retour.
  const visibility = input.visibility ?? 'shared';
  if (visibility === 'shared' && !isDoctrineSafe(input.body)) {
    console.warn('[OXV][annotations] create : note partagée non conforme (doctrine)');
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
      visibility,
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

  // Garde-fou doctrinal app (UX) : si la note devient/reste partagée avec un
  // nouveau corps, il ne peut pas être prescriptif. Le trigger DB reste le rempart.
  if (patch.visibility !== 'private' && patch.body !== undefined && !isDoctrineSafe(patch.body)) {
    console.warn('[OXV][annotations] update : note partagée non conforme (doctrine)');
    return false;
  }

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

/**
 * POSER UN MARQUEUR — le geste du bord de piste (jalon 6, phase 5).
 *
 * *« Il a vu, la machine dit où et quoi, personne n'interprète. »*
 *
 * ---
 *
 * UN MARQUEUR N'EST PAS UNE NOTE
 *
 * Il ne porte AUCUN texte. Le coach marque en regardant la piste — il n'écrit
 * pas, il ne juge pas, il pose un repère. Le sens viendra plus tard, quand il
 * relira le fil et ajoutera peut-être une phrase.
 *
 * C'est pourquoi il entre en `visibility = 'private'` : tant que rien n'est
 * écrit, il n'y a rien à montrer au pilote. Le passage au partage est un second
 * geste, délibéré.
 *
 * ---
 *
 * ON N'ÉCRIT QUE CE QUE LE GESTE PRODUIT
 *
 * L'instant, et rien d'autre. Ni tour, ni virage, ni vitesse : tout cela se
 * RÉSOUT à la lecture (`src/telemetry/marqueur.ts`), à partir des trames. Écrire
 * un tour au moment du geste figerait une valeur que la mesure sait mieux dire.
 *
 * La position suit la même règle : `marker_lat` et `marker_lon` restent nulles
 * ici. Le direct ne transporte pas de position — délibérément — et le résolveur
 * la retrouve dans les trames stockées.
 */
export async function poserMarqueur(input: {
  pilotId: string;
  telemetrySessionId: string;
  /** Instant dans la capture, en ms. Décidé par `decideMarqueur`. */
  elapsedMs: number;
}): Promise<{ ok: boolean; error?: string }> {
  const coachId = (await supabase.auth.getUser()).data.user?.id;
  if (!coachId) return { ok: false, error: 'Session expirée.' };

  if (!Number.isFinite(input.elapsedMs) || input.elapsedMs < 0) {
    // La garde vit dans `decideMarqueur` ; celle-ci empêche qu'un appelant
    // distrait écrive un instant que personne ne saura relire.
    return { ok: false, error: 'Instant invalide.' };
  }

  const { error } = await supabase.from('coach_annotations').insert({
    coach_id: coachId,
    pilot_id: input.pilotId,
    telemetry_session_id: input.telemetrySessionId,
    marker_elapsed_ms: Math.round(input.elapsedMs),
    // Pas de texte : un marqueur n'est pas une note. Reste privé tant qu'il
    // n'en porte pas.
    body: '',
    visibility: 'private',
    // `corner_index` N'EST PAS ÉCRIT — ni valeur, ni null explicite.
    //
    // CE COMMENTAIRE DISAIT LE CONTRAIRE DE LA BASE, jusqu'au 14/08/2026. Il
    // annonçait « NOT NULL avec CHECK (1..7) jusqu'à ce que PROPOSITION_L30
    // soit appliquée ». Elle l'est — `20260802065500_l30_marqueur_sans_texte_
    // ni_virage.sql` — et l'état réel, relu en production, est :
    //
    //   corner_index         nullable
    //   virage_note_ou_marqueur   CHECK (
    //     (corner_index IS NULL AND marker_elapsed_ms IS NOT NULL)
    //     OR (corner_index BETWEEN 1 AND 30) )
    //   texte_ou_marqueur         CHECK (
    //     (length(body) BETWEEN 1 AND 1000)
    //     OR (body = '' AND marker_elapsed_ms IS NOT NULL) )
    //
    // Ce que la contrainte AUTORISE, et qu'il faut lire avant d'écrire ici :
    // une note de virage (1..30), ou un marqueur horodaté sans virage ni texte.
    // **Pas une note de séance** — `corner_index` nul sans instant est refusé.
    //
    // C'est ce qui bloque « rapport devient la carte de séance » (jalon 6) :
    // le bilan d'une séance entière n'a pas de place dans cette table tant que
    // le CHECK n'est pas élargi. Voir `PROPOSITION_J6_note_de_seance.sql`.
    //
    // Les deux contraintes restent invisibles au typage : l'objet est casté, et
    // un cast éteint exactement la vérification qui aurait servi.
  } as never);

  if (error) {
    console.warn('[OXV][annotations] poserMarqueur :', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
