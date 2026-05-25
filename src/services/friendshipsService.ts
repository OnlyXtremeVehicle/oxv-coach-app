/**
 * Service amitiés pilote ↔ pilote (Feature Duel pédagogique).
 *
 * Une amitié est réciproque, demande consentement mutuel, et permet aux
 * 2 membres de voir leurs bilans respectifs côte à côte (lecture seule,
 * jamais le .ubx brut ni les annotations privées).
 *
 * Stockage canonique : la paire (pilot_a, pilot_b) est toujours triée
 * lexicographiquement (pilot_a < pilot_b) pour éviter les doublons.
 * Le service normalise avant chaque INSERT.
 *
 * Voir migration 20260526120000_0027_pilot_friendships.sql.
 *
 * Note typage : la table n'est pas encore régénérée dans database.types.ts.
 * On suit le pattern pilotGoalsService : .from('pilot_friendships' as never)
 * + cast as unknown as FriendshipDbRow. À nettoyer après prochaine
 * regen des types via `supabase gen types`.
 */

import { supabase } from '@/lib/supabase';

export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'revoked';

export interface FriendshipRow {
  id: string;
  pilotA: string;
  pilotB: string;
  initiatorId: string;
  status: FriendshipStatus;
  requestedAt: string;
  respondedAt: string | null;
}

/**
 * Vue enrichie pour affichage UI : on attache les infos du « autre » pilote
 * (pas moi) et un flag pour savoir si je suis l'initiateur.
 */
export interface FriendListEntry {
  friendshipId: string;
  friendId: string;
  friendHandle: string | null;
  friendFirstName: string | null;
  friendAvatarUrl: string | null;
  status: FriendshipStatus;
  amIInitiator: boolean;
  requestedAt: string;
  respondedAt: string | null;
}

interface FriendshipDbRow {
  id: string;
  pilot_a: string;
  pilot_b: string;
  initiator_id: string;
  status: FriendshipStatus;
  requested_at: string;
  responded_at: string | null;
}

interface UserLookupRow {
  id: string;
  public_handle: string | null;
  first_name: string | null;
  avatar_url: string | null;
}

/**
 * Normalise une paire (a, b) à l'ordre canonique pilot_a < pilot_b.
 */
function canonicalPair(a: string, b: string): { pilotA: string; pilotB: string } {
  return a < b ? { pilotA: a, pilotB: b } : { pilotA: b, pilotB: a };
}

function rowFromDb(row: FriendshipDbRow): FriendshipRow {
  return {
    id: row.id,
    pilotA: row.pilot_a,
    pilotB: row.pilot_b,
    initiatorId: row.initiator_id,
    status: row.status,
    requestedAt: row.requested_at,
    respondedAt: row.responded_at,
  };
}

function buildEntry(
  myUserId: string,
  row: FriendshipDbRow,
  otherUser: UserLookupRow | null
): FriendListEntry {
  const isAFromMe = row.pilot_a === myUserId;
  const friendId = isAFromMe ? row.pilot_b : row.pilot_a;
  return {
    friendshipId: row.id,
    friendId,
    friendHandle: otherUser?.public_handle ?? null,
    friendFirstName: otherUser?.first_name ?? null,
    friendAvatarUrl: otherUser?.avatar_url ?? null,
    status: row.status,
    amIInitiator: row.initiator_id === myUserId,
    requestedAt: row.requested_at,
    respondedAt: row.responded_at,
  };
}

type PendingFilter = FriendshipStatus | 'pending_received' | 'pending_sent';

async function listFriendshipsWithStatus(
  myUserId: string,
  filter: PendingFilter
): Promise<FriendListEntry[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('pilot_friendships' as never)
    .select('*' as never)
    .or(`pilot_a.eq.${myUserId},pilot_b.eq.${myUserId}`);

  if (filter === 'pending_received') {
    query = query.eq('status', 'pending').neq('initiator_id', myUserId);
  } else if (filter === 'pending_sent') {
    query = query.eq('status', 'pending').eq('initiator_id', myUserId);
  } else {
    query = query.eq('status', filter);
  }

  const { data: rawRows, error } = await query.order('requested_at', { ascending: false });
  if (error || !rawRows) {
    if (error) console.warn('[friendships] listFriendships error:', error.message);
    return [];
  }
  const friendships = rawRows as unknown as FriendshipDbRow[];
  if (friendships.length === 0) return [];

  const otherIds = friendships.map((row) => (row.pilot_a === myUserId ? row.pilot_b : row.pilot_a));

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, public_handle, first_name, avatar_url')
    .in('id', otherIds);

  if (usersError) {
    console.warn('[friendships] users lookup error:', usersError.message);
  }

  const usersById = new Map<string, UserLookupRow>(
    (users ?? []).map((u) => [u.id as string, u as unknown as UserLookupRow])
  );

  return friendships.map((row) =>
    buildEntry(
      myUserId,
      row,
      usersById.get(row.pilot_a === myUserId ? row.pilot_b : row.pilot_a) ?? null
    )
  );
}

export async function listAcceptedFriends(myUserId: string): Promise<FriendListEntry[]> {
  return listFriendshipsWithStatus(myUserId, 'accepted');
}

export async function listPendingReceived(myUserId: string): Promise<FriendListEntry[]> {
  return listFriendshipsWithStatus(myUserId, 'pending_received');
}

export async function listPendingSent(myUserId: string): Promise<FriendListEntry[]> {
  return listFriendshipsWithStatus(myUserId, 'pending_sent');
}

/**
 * Cherche un user par son public_handle (case-insensitive).
 * Retourne null si introuvable ou si le handle est vide.
 */
export async function findUserByPublicHandle(handle: string): Promise<UserLookupRow | null> {
  const trimmed = handle.trim().replace(/^@+/, '');
  if (!trimmed) return null;

  const { data, error } = await supabase
    .from('users')
    .select('id, public_handle, first_name, avatar_url')
    .ilike('public_handle', trimmed)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[friendships] findUserByPublicHandle error:', error.message);
    return null;
  }
  return data ? (data as unknown as UserLookupRow) : null;
}

export async function sendFriendRequest(
  myUserId: string,
  recipientUserId: string
): Promise<{ row: FriendshipRow; created: boolean } | { error: string }> {
  if (myUserId === recipientUserId) {
    return { error: 'self_friendship_forbidden' };
  }

  const { pilotA, pilotB } = canonicalPair(myUserId, recipientUserId);

  // Check existing — peu importe le status, on évite le doublon
  const { data: existingRaw } = await supabase
    .from('pilot_friendships' as never)
    .select('*' as never)
    .eq('pilot_a', pilotA)
    .eq('pilot_b', pilotB)
    .maybeSingle();

  if (existingRaw) {
    return {
      row: rowFromDb(existingRaw as unknown as FriendshipDbRow),
      created: false,
    };
  }

  const { data: createdRaw, error } = await supabase
    .from('pilot_friendships' as never)
    .insert({
      pilot_a: pilotA,
      pilot_b: pilotB,
      initiator_id: myUserId,
      status: 'pending',
    } as never)
    .select('*' as never)
    .single();

  if (error || !createdRaw) {
    console.warn('[friendships] sendFriendRequest error:', error?.message);
    return { error: error?.message ?? 'unknown_error' };
  }
  return { row: rowFromDb(createdRaw as unknown as FriendshipDbRow), created: true };
}

async function updateStatus(friendshipId: string, newStatus: FriendshipStatus): Promise<boolean> {
  const { error } = await supabase
    .from('pilot_friendships' as never)
    .update({ status: newStatus, responded_at: new Date().toISOString() } as never)
    .eq('id', friendshipId);

  if (error) {
    console.warn(`[friendships] updateStatus(${newStatus}) error:`, error.message);
    return false;
  }
  return true;
}

export function acceptFriendRequest(friendshipId: string): Promise<boolean> {
  return updateStatus(friendshipId, 'accepted');
}

export function declineFriendRequest(friendshipId: string): Promise<boolean> {
  return updateStatus(friendshipId, 'declined');
}

export function revokeFriendship(friendshipId: string): Promise<boolean> {
  return updateStatus(friendshipId, 'revoked');
}

export async function isFriendsWith(myUserId: string, otherUserId: string): Promise<boolean> {
  if (myUserId === otherUserId) return false;
  const { pilotA, pilotB } = canonicalPair(myUserId, otherUserId);
  const { data } = await supabase
    .from('pilot_friendships' as never)
    .select('id' as never)
    .eq('pilot_a', pilotA)
    .eq('pilot_b', pilotB)
    .eq('status', 'accepted')
    .maybeSingle();
  return Boolean(data);
}
