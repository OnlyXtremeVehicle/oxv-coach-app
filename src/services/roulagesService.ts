/**
 * Service roulages coach (§8 OXV Mirror) — accès Supabase.
 *
 * Côté coach : créer / lister / annuler ses roulages, inviter ses pilotes.
 * Côté pilote : lister ses invitations, accepter / refuser.
 *
 * La sécurité repose sur les RLS (migration 0034) :
 *   - gestion réservée au coach propriétaire AVEC permission manage_own_sessions ;
 *   - invitations limitées aux pilotes assignés (coach_pilots actif) ;
 *   - le pilote ne touche qu'à ses propres invitations.
 *
 * La logique pure (validation, tri, comptes) vit dans `roulagesLogic.ts`.
 */

import { supabase } from '@/lib/supabase';

import {
  type Roulage,
  type RoulageInput,
  type RoulageInvitation,
  type RoulageStatus,
} from './roulagesLogic';

// --- Lignes brutes DB (snake_case) -----------------------------------------

interface RoulageRow {
  id: string;
  coach_id: string;
  title: string;
  circuit_name: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  max_pilots: number | null;
  price_per_pilot: number | null;
  notes: string | null;
  status: RoulageStatus;
  created_at: string;
  updated_at: string;
}

interface InvitationRow {
  id: string;
  roulage_id: string;
  pilot_id: string;
  status: RoulageInvitation['status'];
  invited_at: string;
  responded_at: string | null;
}

function mapRoulage(row: RoulageRow): Roulage {
  return {
    id: row.id,
    coachId: row.coach_id,
    title: row.title,
    circuitName: row.circuit_name,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    location: row.location,
    maxPilots: row.max_pilots,
    pricePerPilot: row.price_per_pilot,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInvitation(row: InvitationRow): RoulageInvitation {
  return {
    id: row.id,
    roulageId: row.roulage_id,
    pilotId: row.pilot_id,
    status: row.status,
    invitedAt: row.invited_at,
    respondedAt: row.responded_at,
  };
}

// --- Côté coach ------------------------------------------------------------

/** Liste les roulages créés par le coach courant. */
export async function listMyRoulages(): Promise<Roulage[]> {
  const { data, error } = await supabase
    .from('coach_roulages')
    .select('*')
    .order('starts_at', { ascending: true });

  if (error || !data) {
    if (error) console.warn('[roulages] listMyRoulages error:', error.message);
    return [];
  }
  return (data as unknown as RoulageRow[]).map(mapRoulage);
}

/**
 * Crée un roulage. Le coach_id est forcé à l'utilisateur courant (la RLS
 * l'exige de toute façon). Retourne le roulage créé ou `null` en cas d'échec.
 */
export async function createRoulage(input: RoulageInput): Promise<Roulage | null> {
  const { data: authData } = await supabase.auth.getUser();
  const coachId = authData?.user?.id;
  if (!coachId) return null;

  const payload = {
    coach_id: coachId,
    title: input.title.trim(),
    circuit_name: input.circuitName?.trim() || 'Circuit de Haute Saintonge',
    starts_at: input.startsAt,
    ends_at: input.endsAt || null,
    location: input.location?.trim() || null,
    max_pilots: input.maxPilots ?? null,
    price_per_pilot: input.pricePerPilot ?? null,
    notes: input.notes?.trim() || null,
  };

  const { data, error } = await supabase
    .from('coach_roulages')
    .insert(payload)
    .select('*')
    .single();

  if (error || !data) {
    if (error) console.warn('[roulages] createRoulage error:', error.message);
    return null;
  }
  return mapRoulage(data as unknown as RoulageRow);
}

/** Met à jour le statut d'un roulage (ex. annuler / clôturer). */
export async function setRoulageStatus(id: string, status: RoulageStatus): Promise<boolean> {
  const { error } = await supabase.from('coach_roulages').update({ status }).eq('id', id);

  if (error) {
    console.warn('[roulages] setRoulageStatus error:', error.message);
    return false;
  }
  return true;
}

/** Récupère un roulage par id (coach propriétaire ou pilote invité, via RLS). */
export async function getRoulage(id: string): Promise<Roulage | null> {
  const { data, error } = await supabase
    .from('coach_roulages')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    if (error) console.warn('[roulages] getRoulage error:', error.message);
    return null;
  }
  return mapRoulage(data as unknown as RoulageRow);
}

/** Liste les invitations d'un roulage (vue coach propriétaire). */
export async function listRoulageInvitations(roulageId: string): Promise<RoulageInvitation[]> {
  const { data, error } = await supabase
    .from('roulage_invitations')
    .select('*')
    .eq('roulage_id', roulageId);

  if (error || !data) {
    if (error) console.warn('[roulages] listRoulageInvitations error:', error.message);
    return [];
  }
  return (data as unknown as InvitationRow[]).map(mapInvitation);
}

/**
 * Statuts d'invitation de TOUS les roulages du coach courant (RLS : seuls
 * les roulages dont il est propriétaire remontent). Sert au calcul des
 * présences confirmées par roulage pour le tableau de bord business.
 */
export async function listMyRoulageInvitationStatuses(): Promise<
  { roulageId: string; status: RoulageInvitation['status'] }[]
> {
  const { data, error } = await supabase.from('roulage_invitations').select('roulage_id, status');

  if (error || !data) {
    if (error) console.warn('[roulages] listMyRoulageInvitationStatuses error:', error.message);
    return [];
  }
  return (data as unknown as { roulage_id: string; status: RoulageInvitation['status'] }[]).map(
    (r) => ({ roulageId: r.roulage_id, status: r.status })
  );
}

/**
 * Invite un pilote à un roulage. La RLS vérifie que le pilote est bien
 * assigné au coach (coach_pilots actif). Retourne l'invitation ou `null`.
 */
export async function invitePilot(
  roulageId: string,
  pilotId: string
): Promise<RoulageInvitation | null> {
  const { data, error } = await supabase
    .from('roulage_invitations')
    .insert({ roulage_id: roulageId, pilot_id: pilotId })
    .select('*')
    .single();

  if (error || !data) {
    if (error) console.warn('[roulages] invitePilot error:', error.message);
    return null;
  }
  return mapInvitation(data as unknown as InvitationRow);
}

/** Retire une invitation (coach propriétaire). */
export async function removeInvitation(invitationId: string): Promise<boolean> {
  const { error } = await supabase.from('roulage_invitations').delete().eq('id', invitationId);

  if (error) {
    console.warn('[roulages] removeInvitation error:', error.message);
    return false;
  }
  return true;
}

// --- Côté pilote -----------------------------------------------------------

/** Une invitation côté pilote, accompagnée du roulage concerné. */
export interface PilotInvitation {
  invitation: RoulageInvitation;
  roulage: Roulage;
}

/**
 * Liste les invitations du pilote courant, avec le roulage embarqué.
 * RLS : le pilote voit ses invitations + les roulages où il est invité.
 */
export async function listMyInvitations(): Promise<PilotInvitation[]> {
  const { data, error } = await supabase
    .from('roulage_invitations')
    .select('*, coach_roulages(*)')
    .order('invited_at', { ascending: false });

  if (error || !data) {
    if (error) console.warn('[roulages] listMyInvitations error:', error.message);
    return [];
  }

  type JoinedRow = InvitationRow & { coach_roulages: RoulageRow | null };
  const rows = data as unknown as JoinedRow[];

  return rows
    .filter((r) => r.coach_roulages != null)
    .map((r) => ({
      invitation: mapInvitation(r),
      roulage: mapRoulage(r.coach_roulages as RoulageRow),
    }));
}

/**
 * Réponse du pilote à une invitation (accepter / refuser). Met à jour le
 * statut et l'horodatage de réponse. La RLS garantit que le pilote ne
 * répond qu'à ses propres invitations.
 */
export async function respondToInvitation(
  invitationId: string,
  accepted: boolean,
  nowISO: string
): Promise<boolean> {
  const { error } = await supabase
    .from('roulage_invitations')
    .update({
      status: accepted ? 'accepted' : 'declined',
      responded_at: nowISO,
    })
    .eq('id', invitationId);

  if (error) {
    console.warn('[roulages] respondToInvitation error:', error.message);
    return false;
  }
  return true;
}
