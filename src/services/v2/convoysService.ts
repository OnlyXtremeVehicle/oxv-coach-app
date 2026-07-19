/**
 * Service convois (C2) — v2.
 *
 * Un convoi regroupe des pilotes inscrits à la MÊME journée (session site) autour
 * d'une route belle optionnelle (`scenic_routes`) et d'un point de RDV. L'accès
 * est borné côté base : seuls les inscrits de la journée (fonction serveur
 * `is_registered_for_session`) lisent et rejoignent ; le créateur gère son convoi.
 * Le service ne réimplémente PAS ce contrôle : il remonte proprement un refus RLS
 * en message FR vouvoyé.
 *
 * Doctrine : coordination avant/après roulage uniquement — jamais de push en piste.
 */

import { supabase } from '@/lib/supabase';

export interface ConvoyParticipant {
  userId: string;
  joinedAt: string;
}

export interface Convoy {
  id: string;
  sessionId: string;
  routeId: string | null;
  createdBy: string;
  meetingPoint: string | null;
  rdvAt: string | null;
  createdAt: string;
  participants: ConvoyParticipant[];
}

export interface CreateConvoyInput {
  sessionId: string;
  routeId?: string | null;
  meetingPoint?: string | null;
  rdvAt?: string | null;
}

const ACCESS_DENIED_FR =
  'Accès refusé : seuls les inscrits de la journée peuvent accéder à ce convoi.';

/** Repère un refus de sécurité (RLS) pour le traduire en message FR lisible. */
function isRlsDenial(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('row-level security') ||
    m.includes('violates row-level') ||
    m.includes('permission denied') ||
    m.includes('policy')
  );
}

/**
 * Convois d'une journée (session site), participants inclus. Lecture bornée aux
 * inscrits par RLS : un non-inscrit obtient une liste vide. Erreur transport
 * remontée.
 */
export async function getForSession(sessionId: string): Promise<Convoy[]> {
  const { data, error } = await supabase
    .from('convoys')
    .select(
      'id, session_id, route_id, created_by, meeting_point, rdv_at, created_at, convoy_participants(user_id, joined_at)'
    )
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => {
    const participants = Array.isArray(r.convoy_participants) ? r.convoy_participants : [];
    return {
      id: r.id,
      sessionId: r.session_id,
      routeId: r.route_id ?? null,
      createdBy: r.created_by,
      meetingPoint: r.meeting_point ?? null,
      rdvAt: r.rdv_at ?? null,
      createdAt: r.created_at,
      participants: participants.map((p) => ({ userId: p.user_id, joinedAt: p.joined_at })),
    };
  });
}

/**
 * Crée un convoi pour une journée. RLS n'autorise l'insertion qu'aux inscrits de
 * la session : un refus remonte en message FR. Le créateur en devient gestionnaire.
 */
export async function create(
  input: CreateConvoyInput
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { ok: false, error: 'Vous devez être connecté.' };

  const { data, error } = await supabase
    .from('convoys')
    .insert({
      session_id: input.sessionId,
      created_by: uid,
      route_id: input.routeId ?? null,
      meeting_point: input.meetingPoint?.trim() ? input.meetingPoint.trim() : null,
      rdv_at: input.rdvAt ?? null,
    })
    .select('id')
    .maybeSingle();
  if (error)
    return { ok: false, error: isRlsDenial(error.message) ? ACCESS_DENIED_FR : error.message };
  if (!data) return { ok: false, error: ACCESS_DENIED_FR };
  return { ok: true, id: data.id };
}

/**
 * Rejoint un convoi. Idempotent : un second appel n'échoue pas (ignore le doublon
 * de clé). RLS n'autorise l'inscription qu'aux inscrits de la journée ; un refus
 * remonte en message FR.
 */
export async function join(convoyId: string): Promise<{ ok: boolean; error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { ok: false, error: 'Vous devez être connecté.' };

  const { error } = await supabase
    .from('convoy_participants')
    .upsert(
      { convoy_id: convoyId, user_id: uid },
      { onConflict: 'convoy_id,user_id', ignoreDuplicates: true }
    );
  if (error)
    return { ok: false, error: isRlsDenial(error.message) ? ACCESS_DENIED_FR : error.message };
  return { ok: true };
}

/**
 * Quitte un convoi. Idempotent : ne rien supprimer (déjà parti) reste un succès.
 */
export async function leave(convoyId: string): Promise<{ ok: boolean; error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { ok: false, error: 'Vous devez être connecté.' };

  const { error } = await supabase
    .from('convoy_participants')
    .delete()
    .eq('convoy_id', convoyId)
    .eq('user_id', uid);
  if (error)
    return { ok: false, error: isRlsDenial(error.message) ? ACCESS_DENIED_FR : error.message };
  return { ok: true };
}
