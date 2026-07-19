/**
 * Hook du CLUB HUB (V2-L5, écran 1/7) — orchestration des services EXISTANTS.
 *
 * Le lot ne crée aucun service : ce hook assemble roulages, coaching (binôme +
 * découverte), écurie (A3) et son fil de faits, pass et partenaires. Chaque
 * source échoue INDÉPENDAMMENT (un bloc en panne n'efface pas les autres) et,
 * fidèle à la règle « données réelles », une source vide masque son bloc plutôt
 * que de fabriquer un contenu.
 *
 * Fil d'écurie (doctrine) : le seul canal RLS-permis pour connaître la présence
 * d'un autre pilote est `session_attendance_public` (opt-in `show_attendance`,
 * réservé aux inscrits de la même journée). On l'interroge sur MES journées
 * PASSÉES ; les membres de MON écurie qui y étaient produisent un fait « a roulé »
 * — jamais un chrono (la fonction serveur n'en renvoie pas, et `crewFactFeed`
 * l'exclut structurellement).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { listAttendance } from '@/features/rec/attendancePublicService';
import {
  listMyBookings,
  listPublishedCoaches,
  type CoachListing,
} from '@/services/coachMarketplaceService';
import { listMyThreads } from '@/services/coachMessagesService';
import { getMyNextTrackDay } from '@/services/nextTrackDayService';
import { listMarketplace } from '@/services/partnerService';
import { listMyCoaches } from '@/services/pilotConsentService';
import { INVITATION_STATUS_LABELS } from '@/services/roulagesLogic';
import { listMyInvitations, respondToInvitation } from '@/services/roulagesService';
import { getMyCrew } from '@/services/v2/referralService';

import {
  bookingWhenLabel,
  crewCardTitle,
  crewFactFeed,
  crewOwnerName,
  messagePreview,
  shortDayLabel,
  type CrewFact,
  type CrewMemberProfile,
  type RawCrewAttendance,
} from './clubHubLogic';

// ---------------------------------------------------------------------------
// Formes exposées à l'écran
// ---------------------------------------------------------------------------

export interface HubCoachFace {
  coachId: string;
  name: string;
  photoUrl: string | null;
}

export interface HubCoaching {
  kind: 'binome' | 'discovery';
  /** binôme */
  coachId?: string;
  coachName?: string;
  coachPhotoUrl?: string | null;
  nextBookingLabel?: string | null;
  lastMessagePreview?: string | null;
  /** découverte : visages des coachs publiés (rail chevauché) */
  faces?: HubCoachFace[];
}

export interface HubCrew {
  crewId: string;
  title: string;
  memberCount: number;
  avatars: { userId: string; avatarUrl: string | null }[];
  facts: CrewFact[];
}

export interface HubRoulage {
  invitationId: string;
  title: string;
  whenLabel: string | null;
  circuitName: string | null;
  location: string | null;
  pending: boolean;
  statusLabel: string;
}

export interface HubPass {
  dayLabel: string | null;
  circuitName: string | null;
}

export interface HubPartner {
  id: string;
  name: string;
  logoUrl: string | null;
}

export interface ClubHub {
  status: 'loading' | 'ready' | 'error';
  coaching: HubCoaching | null;
  crew: HubCrew | null;
  roulages: HubRoulage[];
  pass: HubPass | null;
  partners: HubPartner[];
  refreshing: boolean;
  refresh: () => void;
  respondRoulage: (invitationId: string, accepted: boolean) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers d'I/O locaux (best-effort, jamais bloquants)
// ---------------------------------------------------------------------------

/** Date locale 'YYYY-MM-DD' (fuseau du device) — « aujourd'hui ». */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

/** Photo publiée d'un coach (fiche `is_published`), ou null. Best-effort. */
async function loadCoachPhoto(coachId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('coach_profiles')
    .select('photo_url')
    .eq('coach_id', coachId)
    .eq('is_published', true)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { photo_url: string | null }).photo_url ?? null;
}

/** Mes journées PASSÉES (site), avec circuit — support du fil d'écurie. */
async function loadMyPastSessions(
  userId: string,
  limit = 8
): Promise<{ id: string; dayIso: string; circuitName: string | null }[]> {
  const { data: regs } = await supabase
    .from('registrations')
    .select('session_id, status')
    .eq('user_id', userId)
    .or('status.is.null,status.neq.cancelled')
    .order('created_at', { ascending: false })
    .limit(100);
  const sessionIds = [...new Set((regs ?? []).map((r) => r.session_id).filter(Boolean))];
  if (sessionIds.length === 0) return [];

  const today = todayIso();
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, date, circuit_id, status')
    .in('id', sessionIds)
    .lt('date', today)
    .order('date', { ascending: false })
    .limit(limit);

  const rows = (sessions ?? []).filter(
    (s) => s.status !== 'cancelled' && s.status !== 'archived'
  ) as { id: string; date: string; circuit_id: string | null; status: string | null }[];
  if (rows.length === 0) return [];

  const circuitIds = [...new Set(rows.map((s) => s.circuit_id).filter(Boolean))] as string[];
  const circuitNames = new Map<string, string>();
  if (circuitIds.length > 0) {
    const { data: circuits } = await supabase
      .from('circuits')
      .select('id, name')
      .in('id', circuitIds);
    for (const c of circuits ?? []) circuitNames.set(c.id as string, c.name as string);
  }

  return rows.map((s) => ({
    id: s.id,
    dayIso: s.date,
    circuitName: s.circuit_id ? (circuitNames.get(s.circuit_id) ?? null) : null,
  }));
}

/**
 * Résout l'écurie de l'appelant : titre, membres (avatars) et fil de faits.
 * Combine trois canaux réels :
 *  - `getMyCrew` (membres + rôles + nom d'écurie) ;
 *  - `session_attendance_public` sur mes journées passées (handle/avatar/crew des
 *    membres opt-in présents → faits « a roulé ») ;
 *  - lecture best-effort de `users` (prénoms), tolérante à un refus RLS.
 * Renvoie null si l'appelant n'a pas d'écurie.
 */
async function loadCrew(userId: string): Promise<HubCrew | null> {
  const crew = await getMyCrew().catch(() => null);
  if (crew === null) return null;

  const memberIds = crew.members.map((m) => m.userId);
  const roleById = new Map(crew.members.map((m) => [m.userId, m.role] as const));

  // Canal opt-in : présence des membres à MES journées passées.
  const pastSessions = await loadMyPastSessions(userId).catch(() => []);
  const attendance: RawCrewAttendance[] = [];
  const handleById = new Map<string, string | null>();
  const avatarById = new Map<string, string | null>();
  for (const s of pastSessions) {
    const members = await listAttendance(s.id, userId).catch(() => []);
    for (const m of members) {
      if (m.isSelf) continue;
      if (m.crewId !== crew.crewId) continue;
      if (!roleById.has(m.userId)) continue; // sécurité : borne à mon écurie
      attendance.push({ userId: m.userId, dayIso: s.dayIso, circuitName: s.circuitName });
      if (!handleById.has(m.userId)) handleById.set(m.userId, m.handle);
      if (!avatarById.has(m.userId)) avatarById.set(m.userId, m.avatarUrl);
    }
  }

  // Prénoms (best-effort) : peut être borné par la RLS `users` own-or-admin.
  const firstNameById = new Map<string, string | null>();
  if (memberIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, first_name, public_handle, avatar_url')
      .in('id', memberIds);
    for (const u of users ?? []) {
      const row = u as {
        id: string;
        first_name: string | null;
        public_handle: string | null;
        avatar_url: string | null;
      };
      firstNameById.set(row.id, row.first_name ?? null);
      if (!handleById.get(row.id)) handleById.set(row.id, row.public_handle ?? null);
      if (!avatarById.get(row.id)) avatarById.set(row.id, row.avatar_url ?? null);
    }
  }

  const profiles: CrewMemberProfile[] = crew.members.map((m) => ({
    userId: m.userId,
    firstName: firstNameById.get(m.userId) ?? null,
    handle: handleById.get(m.userId) ?? null,
    avatarUrl: avatarById.get(m.userId) ?? null,
    role: m.role,
  }));

  const facts = crewFactFeed(profiles, attendance, { nowIso: todayIso(), limit: 4 });

  return {
    crewId: crew.crewId,
    title: crewCardTitle(crew.name, crewOwnerName(profiles)),
    memberCount: profiles.length,
    avatars: profiles.map((p) => ({ userId: p.userId, avatarUrl: p.avatarUrl })),
    facts,
  };
}

/** Bloc « Mon coaching » : binôme actif si présent, sinon découverte. */
async function loadCoaching(userId: string): Promise<HubCoaching | null> {
  const [assignments, published] = await Promise.all([
    listMyCoaches().catch(() => []),
    listPublishedCoaches().catch(() => [] as CoachListing[]),
  ]);

  const binome = assignments.find((a) => a.active) ?? null;

  if (binome !== null) {
    const [photoUrl, bookings, threads] = await Promise.all([
      loadCoachPhoto(binome.coachId).catch(() => null),
      listMyBookings().catch(() => []),
      listMyThreads(userId).catch(() => []),
    ]);

    const now = new Date().toISOString();
    const nextBooking = bookings
      .filter(
        (b) =>
          b.coachId === binome.coachId &&
          b.status === 'accepted' &&
          b.requestedStartsAt !== null &&
          b.requestedStartsAt >= now
      )
      .sort((a, b) => (a.requestedStartsAt ?? '').localeCompare(b.requestedStartsAt ?? ''))[0];

    const thread = threads.find((t) => t.coachId === binome.coachId) ?? null;
    const coachName = [binome.coachFirstName, binome.coachLastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    return {
      kind: 'binome',
      coachId: binome.coachId,
      coachName: coachName || 'Votre coach',
      coachPhotoUrl: photoUrl,
      nextBookingLabel: nextBooking ? bookingWhenLabel(nextBooking.requestedStartsAt) : null,
      lastMessagePreview: thread ? messagePreview(thread.lastBody) : null,
    };
  }

  // Découverte : rien à découvrir si aucun coach publié → bloc masqué.
  if (published.length === 0) return null;
  return {
    kind: 'discovery',
    faces: published.slice(0, 8).map((c) => ({
      coachId: c.coachId,
      name: c.headline?.trim() ? c.headline.trim() : 'Coach OXV',
      photoUrl: c.photoUrl ?? null,
    })),
  };
}

/** Invitations roulages à venir (les passées/annulées sortent de la liste hub). */
async function loadRoulages(): Promise<HubRoulage[]> {
  const invitations = await listMyInvitations().catch(() => []);
  const now = new Date().toISOString();
  return invitations
    .filter(({ roulage }) => roulage.startsAt >= now && roulage.status !== 'cancelled')
    .map(({ invitation, roulage }) => ({
      invitationId: invitation.id,
      title: roulage.title,
      whenLabel: bookingWhenLabel(roulage.startsAt) ?? shortDayLabel(roulage.startsAt),
      circuitName: roulage.circuitName,
      location: roulage.location,
      pending: invitation.status === 'invited' && roulage.status === 'open',
      statusLabel: INVITATION_STATUS_LABELS[invitation.status] ?? '',
    }));
}

/** Pass : prochaine inscription à venir (aperçu), ou null. */
async function loadPass(userId: string): Promise<HubPass | null> {
  const next = await getMyNextTrackDay(userId).catch(() => null);
  if (next === null) return null;
  return { dayLabel: shortDayLabel(next.date), circuitName: next.circuitName };
}

/** Partenaires : rail des partenaires au catalogue publié, ou vide. */
async function loadPartners(): Promise<HubPartner[]> {
  const partners = await listMarketplace().catch(() => []);
  return partners.map((p) => ({ id: p.id, name: p.displayName, logoUrl: p.logoUrl }));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useClubHub(userId: string | null): ClubHub {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [coaching, setCoaching] = useState<HubCoaching | null>(null);
  const [crew, setCrew] = useState<HubCrew | null>(null);
  const [roulages, setRoulages] = useState<HubRoulage[]>([]);
  const [pass, setPass] = useState<HubPass | null>(null);
  const [partners, setPartners] = useState<HubPartner[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const aliveRef = useRef(true);

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (userId === null) {
        setStatus('ready');
        return;
      }
      if (mode === 'refresh') setRefreshing(true);
      else setStatus('loading');

      const [coachingRes, crewRes, roulagesRes, passRes, partnersRes] = await Promise.allSettled([
        loadCoaching(userId),
        loadCrew(userId),
        loadRoulages(),
        loadPass(userId),
        loadPartners(),
      ]);
      if (!aliveRef.current) return;

      // Panne TOTALE des cinq sources = état d'erreur honnête ; sinon on rend ce
      // qui a répondu (un bloc muet vaut mieux qu'un écran d'erreur alarmant).
      const allFailed = [coachingRes, crewRes, roulagesRes, passRes, partnersRes].every(
        (r) => r.status === 'rejected'
      );

      setCoaching(coachingRes.status === 'fulfilled' ? coachingRes.value : null);
      setCrew(crewRes.status === 'fulfilled' ? crewRes.value : null);
      setRoulages(roulagesRes.status === 'fulfilled' ? roulagesRes.value : []);
      setPass(passRes.status === 'fulfilled' ? passRes.value : null);
      setPartners(partnersRes.status === 'fulfilled' ? partnersRes.value : []);

      setStatus(allFailed ? 'error' : 'ready');
      setRefreshing(false);
    },
    [userId]
  );

  useEffect(() => {
    aliveRef.current = true;
    void load('initial');
    return () => {
      aliveRef.current = false;
    };
  }, [load]);

  const refresh = useCallback(() => {
    void load('refresh');
  }, [load]);

  const respondRoulage = useCallback(async (invitationId: string, accepted: boolean) => {
    await respondToInvitation(invitationId, accepted, new Date().toISOString());
    const next = await loadRoulages();
    if (aliveRef.current) setRoulages(next);
  }, []);

  return {
    status,
    coaching,
    crew,
    roulages,
    pass,
    partners,
    refreshing,
    refresh,
    respondRoulage,
  };
}
