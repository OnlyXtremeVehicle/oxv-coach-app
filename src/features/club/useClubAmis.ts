/**
 * useClubAmis — chargement de l'onglet AMIS (lot V2-L5, Mission B).
 *
 * Services EXISTANTS uniquement :
 *   - friendshipsService : liste (acceptés / reçus / envoyés), recherche
 *     @handle, envoi / acceptation / refus / révocation ;
 *   - duelService.loadFriendSessionList : séances d'un ami, DÉPOUILLÉES de
 *     tout chrono par `amisLogic.toFriendFacts` avant de toucher l'UI
 *     (doctrine : le fait de rouler, jamais la performance d'autrui) ;
 *   - referralService.getMyCrew (best-effort) : badge « groupe » pour les
 *     amis de la même écurie.
 *
 * Décisions pures dans `amisLogic` (testé). Le hook ne fait que l'I/O.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { loadFriendSessionList } from '@/services/duelService';
import {
  acceptFriendRequest,
  declineFriendRequest,
  findUserByPublicHandle,
  listAcceptedFriends,
  listPendingReceived,
  listPendingSent,
  revokeFriendship,
  sendFriendRequest,
  type FriendListEntry,
} from '@/services/friendshipsService';
import { getMyCrew } from '@/services/v2/referralService';

import {
  crewMemberIds,
  friendDisplayName,
  friendInitials,
  friendLastCircuit,
  friendMetaLine,
  isInCrew,
  isSearchable,
  normalizeHandleQuery,
  toFriendFacts,
} from './amisLogic';

/** Ami accepté, prêt à afficher. */
export interface FriendVM {
  friendshipId: string;
  friendId: string;
  name: string;
  handle: string | null;
  initials: string;
  avatarUrl: string | null;
  /** Dernier circuit factuel (jamais un chrono), ou null. */
  lastCircuit: string | null;
  lastCircuitDateISO: string | null;
  metaLine: string;
  /** Ami de la même écurie → badge « groupe ». */
  inCrew: boolean;
}

/** Demande d'amitié en attente (reçue ou envoyée). */
export interface PendingVM {
  friendshipId: string;
  name: string;
  handle: string | null;
  initials: string;
}

/** État de la recherche @handle live. */
export type SearchState =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'none' }
  | { kind: 'self' }
  | { kind: 'found'; user: { id: string; handle: string | null; name: string; initials: string } };

export interface ClubAmis {
  status: 'loading' | 'ready' | 'error';
  accepted: FriendVM[];
  received: PendingVM[];
  sent: PendingVM[];

  query: string;
  setQuery: (q: string) => void;
  search: SearchState;
  /** Envoie une demande au pilote trouvé, puis vide la recherche et recharge. */
  addFriend: (userId: string) => Promise<void>;

  accept: (friendshipId: string) => Promise<void>;
  decline: (friendshipId: string) => Promise<void>;
  revoke: (friendshipId: string) => Promise<void>;
  reload: () => void;
}

function pendingVMOf(entry: FriendListEntry): PendingVM {
  const id = {
    friendId: entry.friendId,
    friendHandle: entry.friendHandle,
    friendFirstName: entry.friendFirstName,
  };
  return {
    friendshipId: entry.friendshipId,
    name: friendDisplayName(id),
    handle: entry.friendHandle,
    initials: friendInitials(id),
  };
}

export function useClubAmis(userId: string | null): ClubAmis {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [accepted, setAccepted] = useState<FriendVM[]>([]);
  const [received, setReceived] = useState<PendingVM[]>([]);
  const [sent, setSent] = useState<PendingVM[]>([]);

  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<SearchState>({ kind: 'idle' });

  const alive = useRef(true);

  const load = useCallback(async () => {
    if (userId === null) {
      if (alive.current) {
        setAccepted([]);
        setReceived([]);
        setSent([]);
        setStatus('ready');
      }
      return;
    }
    try {
      const [a, r, sn, crew] = await Promise.all([
        listAcceptedFriends(userId),
        listPendingReceived(userId),
        listPendingSent(userId),
        getMyCrew().catch(() => null),
      ]);
      const memberIds = crewMemberIds(crew);

      // Dernier circuit factuel de chaque ami — séances DÉPOUILLÉES du chrono.
      const friends: FriendVM[] = await Promise.all(
        a.map(async (entry) => {
          const rows = await loadFriendSessionList(entry.friendId, 40);
          const last = friendLastCircuit(toFriendFacts(rows));
          const id = {
            friendId: entry.friendId,
            friendHandle: entry.friendHandle,
            friendFirstName: entry.friendFirstName,
          };
          return {
            friendshipId: entry.friendshipId,
            friendId: entry.friendId,
            name: friendDisplayName(id),
            handle: entry.friendHandle,
            initials: friendInitials(id),
            avatarUrl: entry.friendAvatarUrl,
            lastCircuit: last.circuitLabel,
            lastCircuitDateISO: last.dateISO,
            metaLine: friendMetaLine(entry.friendHandle, last.circuitLabel),
            inCrew: isInCrew(entry.friendId, memberIds),
          };
        })
      );

      if (!alive.current) return;
      setAccepted(friends);
      setReceived(r.map(pendingVMOf));
      setSent(sn.map(pendingVMOf));
      setStatus('ready');
    } catch {
      if (alive.current) setStatus('error');
    }
  }, [userId]);

  useEffect(() => {
    alive.current = true;
    setStatus('loading');
    void load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  // Recherche @handle live : débounce 300 ms, garde anti-résultat périmé.
  useEffect(() => {
    if (!isSearchable(query)) {
      setSearch({ kind: 'idle' });
      return;
    }
    let cancelled = false;
    setSearch({ kind: 'searching' });
    const handle = normalizeHandleQuery(query);
    const timer = setTimeout(() => {
      void findUserByPublicHandle(handle).then((user) => {
        if (cancelled) return;
        if (!user) {
          setSearch({ kind: 'none' });
          return;
        }
        if (userId !== null && user.id === userId) {
          setSearch({ kind: 'self' });
          return;
        }
        const id = {
          friendId: user.id,
          friendHandle: user.public_handle,
          friendFirstName: user.first_name,
        };
        setSearch({
          kind: 'found',
          user: {
            id: user.id,
            handle: user.public_handle,
            name: friendDisplayName(id),
            initials: friendInitials(id),
          },
        });
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, userId]);

  const addFriend = useCallback(
    async (targetId: string) => {
      if (userId === null) return;
      const res = await sendFriendRequest(userId, targetId);
      if ('error' in res) return;
      if (alive.current) {
        setQuery('');
        setSearch({ kind: 'idle' });
      }
      await load();
    },
    [userId, load]
  );

  const accept = useCallback(
    async (friendshipId: string) => {
      if (await acceptFriendRequest(friendshipId)) await load();
    },
    [load]
  );
  const decline = useCallback(
    async (friendshipId: string) => {
      if (await declineFriendRequest(friendshipId)) await load();
    },
    [load]
  );
  const revoke = useCallback(
    async (friendshipId: string) => {
      if (await revokeFriendship(friendshipId)) await load();
    },
    [load]
  );

  const reload = useCallback(() => {
    setStatus('loading');
    void load();
  }, [load]);

  return {
    status,
    accepted,
    received,
    sent,
    query,
    setQuery,
    search,
    addFriend,
    accept,
    decline,
    revoke,
    reload,
  };
}
