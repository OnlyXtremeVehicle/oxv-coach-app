/**
 * Service événements (migration 0021). Lecture côté app : un événement rattaché
 * à une capture sert au bandeau « mode démo » du Bilan, au Pass OXV et au B2B
 * Report. La création/édition (admin) s'ajoute en PR-21.
 *
 * `internal_notes` n'est JAMAIS sélectionné ici (contrôle au niveau requête,
 * comme `users.admin_notes`).
 */

import { supabase } from '@/lib/supabase';

import { slugify } from './eventSlug';

export { slugify };

export type EventType = 'session' | 'balade_decouverte' | 'test_alpha' | 'partenaire' | 'corporate';
export type EventStatus = 'draft' | 'private' | 'public' | 'closed' | 'finished' | 'cancelled';

export interface EventLite {
  id: string;
  eventType: EventType;
  name: string;
  locationName: string;
  status: EventStatus;
  startsAt: string;
}

const LITE_COLS = 'id, event_type, name, location_name, status, starts_at';

function mapLite(r: Record<string, unknown>): EventLite {
  return {
    id: r.id as string,
    eventType: r.event_type as EventType,
    name: r.name as string,
    locationName: r.location_name as string,
    status: r.status as EventStatus,
    startsAt: r.starts_at as string,
  };
}

/** Lecture légère d'un événement par id (RLS : visible selon statut / admin). */
export async function getEventLite(eventId: string): Promise<EventLite | null> {
  const { data, error } = await supabase
    .from('events')
    .select(LITE_COLS)
    .eq('id', eventId)
    .maybeSingle();
  if (error || !data) return null;
  return mapLite(data as Record<string, unknown>);
}

// ============================================================================
// Admin — CRUD + inscriptions (PR-21)
// ============================================================================

export const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'session', label: 'Session circuit' },
  { value: 'balade_decouverte', label: 'Balade découverte' },
  { value: 'test_alpha', label: 'Test alpha' },
  { value: 'partenaire', label: 'Partenaire' },
  { value: 'corporate', label: 'Corporate' },
];

export const EVENT_STATUSES: { value: EventStatus; label: string }[] = [
  { value: 'draft', label: 'Brouillon' },
  { value: 'private', label: 'Privé' },
  { value: 'public', label: 'Public' },
  { value: 'closed', label: 'Clos' },
  { value: 'finished', label: 'Terminé' },
  { value: 'cancelled', label: 'Annulé' },
];

export function eventTypeLabel(t: EventType): string {
  return EVENT_TYPES.find((x) => x.value === t)?.label ?? t;
}
export function eventStatusLabel(s: EventStatus): string {
  return EVENT_STATUSES.find((x) => x.value === s)?.label ?? s;
}

export interface AdminEvent {
  id: string;
  name: string;
  slug: string;
  eventType: EventType;
  status: EventStatus;
  locationName: string;
  locationAddress: string | null;
  startsAt: string;
  endsAt: string;
  briefingAt: string | null;
  maxPilots: number;
  currentPilots: number;
  description: string | null;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

const FULL_COLS =
  'id, name, slug, event_type, status, location_name, location_address, starts_at, ends_at, briefing_at, max_pilots, current_pilots, description, internal_notes, created_at, updated_at';

function mapEvent(r: Record<string, unknown>): AdminEvent {
  return {
    id: r.id as string,
    name: r.name as string,
    slug: r.slug as string,
    eventType: r.event_type as EventType,
    status: r.status as EventStatus,
    locationName: r.location_name as string,
    locationAddress: (r.location_address as string | null) ?? null,
    startsAt: r.starts_at as string,
    endsAt: r.ends_at as string,
    briefingAt: (r.briefing_at as string | null) ?? null,
    maxPilots: Number(r.max_pilots ?? 0),
    currentPilots: Number(r.current_pilots ?? 0),
    description: (r.description as string | null) ?? null,
    internalNotes: (r.internal_notes as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

/** Tous les événements (RLS admin : voit tout, draft compris). Récents d'abord. */
export async function listEvents(): Promise<AdminEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select(FULL_COLS)
    .order('starts_at', { ascending: false })
    .limit(200);
  if (error) {
    console.warn('[OXV][admin][events] listEvents :', error.message);
    return [];
  }
  return (data ?? []).map((r) => mapEvent(r as Record<string, unknown>));
}

export async function getEvent(id: string): Promise<AdminEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select(FULL_COLS)
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return mapEvent(data as unknown as Record<string, unknown>);
}

export interface CreateEventInput {
  name: string;
  eventType: EventType;
  status: EventStatus;
  locationName: string;
  locationAddress?: string;
  startsAt: string; // ISO
  endsAt: string; // ISO
  briefingAt?: string | null;
  maxPilots: number;
  description?: string;
  internalNotes?: string;
}

export interface MutationResult {
  ok: boolean;
  id?: string;
  error?: string;
}

/** Crée un événement (admin). Slug dérivé du nom ; tarification gérée côté site. */
export async function createEvent(input: CreateEventInput): Promise<MutationResult> {
  const { data: auth } = await supabase.auth.getUser();
  const slug = slugify(input.name) || `evenement-${Date.now()}`;
  const { data, error } = await supabase
    .from('events')
    .insert({
      name: input.name.trim(),
      slug,
      event_type: input.eventType,
      status: input.status,
      location_name: input.locationName.trim(),
      location_address: input.locationAddress?.trim() || null,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      briefing_at: input.briefingAt ?? null,
      max_pilots: input.maxPilots,
      description: input.description?.trim() || null,
      internal_notes: input.internalNotes?.trim() || null,
      created_by: auth?.user?.id ?? null,
    } as never)
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Création impossible.' };
  return { ok: true, id: (data as { id: string }).id };
}

export type EventPatch = Partial<
  Pick<
    AdminEvent,
    | 'name'
    | 'status'
    | 'locationName'
    | 'locationAddress'
    | 'startsAt'
    | 'endsAt'
    | 'briefingAt'
    | 'maxPilots'
    | 'description'
    | 'internalNotes'
  >
>;

/** Édite un événement (admin). */
export async function updateEvent(id: string, patch: EventPatch): Promise<MutationResult> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.locationName !== undefined) row.location_name = patch.locationName;
  if (patch.locationAddress !== undefined) row.location_address = patch.locationAddress;
  if (patch.startsAt !== undefined) row.starts_at = patch.startsAt;
  if (patch.endsAt !== undefined) row.ends_at = patch.endsAt;
  if (patch.briefingAt !== undefined) row.briefing_at = patch.briefingAt;
  if (patch.maxPilots !== undefined) row.max_pilots = patch.maxPilots;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.internalNotes !== undefined) row.internal_notes = patch.internalNotes;

  const { error } = await supabase
    .from('events')
    .update(row as never)
    .eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export type RegistrationStatus = 'registered' | 'checked_in' | 'cancelled' | 'no_show';

export interface EventRegistrationRow {
  id: string;
  pilotId: string;
  pilotName: string;
  pilotEmail: string;
  status: RegistrationStatus;
  checkedInAt: string | null;
  createdAt: string;
}

/** Inscriptions d'un événement (admin), avec identité pilote. */
export async function listEventRegistrations(eventId: string): Promise<EventRegistrationRow[]> {
  const { data, error } = await supabase
    .from('event_registrations')
    .select(
      'id, pilot_id, status, checked_in_at, created_at, users!event_registrations_pilot_id_fkey(first_name, last_name, email)'
    )
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (error) {
    console.warn('[OXV][admin][events] listEventRegistrations :', error.message);
    return [];
  }
  return (data ?? []).map((row: Record<string, unknown>) => {
    const joined = row.users as
      | { first_name?: string | null; last_name?: string | null; email?: string }
      | { first_name?: string | null; last_name?: string | null; email?: string }[]
      | null
      | undefined;
    const u = Array.isArray(joined) ? joined[0] : joined;
    const name = [u?.first_name, u?.last_name].filter(Boolean).join(' ').trim();
    return {
      id: row.id as string,
      pilotId: row.pilot_id as string,
      pilotName: name || (u?.email ?? '—'),
      pilotEmail: u?.email ?? '',
      status: row.status as RegistrationStatus,
      checkedInAt: (row.checked_in_at as string | null) ?? null,
      createdAt: row.created_at as string,
    };
  });
}

/** Change le statut d'une inscription (check-in admin). */
export async function setRegistrationStatus(
  registrationId: string,
  status: RegistrationStatus
): Promise<MutationResult> {
  const { data: auth } = await supabase.auth.getUser();
  const patch: Record<string, unknown> = { status };
  if (status === 'checked_in') {
    patch.checked_in_at = new Date().toISOString();
    patch.checked_in_by = auth?.user?.id ?? null;
  }
  const { error } = await supabase
    .from('event_registrations')
    .update(patch as never)
    .eq('id', registrationId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ============================================================================
// Pilote — Pass OXV (PR-27, sans QR)
// ============================================================================

export interface PassEvent {
  id: string;
  name: string;
  eventType: EventType;
  status: EventStatus;
  locationName: string;
  locationAddress: string | null;
  startsAt: string;
  endsAt: string;
  briefingAt: string | null;
  description: string | null;
}

const PASS_EVENT_COLS =
  'id, name, event_type, status, location_name, location_address, starts_at, ends_at, briefing_at, description';

function mapPassEvent(r: Record<string, unknown>): PassEvent {
  return {
    id: r.id as string,
    name: r.name as string,
    eventType: r.event_type as EventType,
    status: r.status as EventStatus,
    locationName: r.location_name as string,
    locationAddress: (r.location_address as string | null) ?? null,
    startsAt: r.starts_at as string,
    endsAt: r.ends_at as string,
    briefingAt: (r.briefing_at as string | null) ?? null,
    description: (r.description as string | null) ?? null,
  };
}

export interface MyRegistration {
  registrationId: string;
  status: RegistrationStatus;
  event: PassEvent | null;
}

/** Mes inscriptions (RLS own) + l'événement rattaché (selon visibilité RLS). */
export async function listMyRegistrations(): Promise<MyRegistration[]> {
  const { data, error } = await supabase
    .from('event_registrations')
    .select(`id, status, events!event_registrations_event_id_fkey(${PASS_EVENT_COLS})`)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[OXV][pilot][events] listMyRegistrations :', error.message);
    return [];
  }
  return (data ?? []).map((row: Record<string, unknown>) => {
    const joined = row.events as Record<string, unknown> | Record<string, unknown>[] | null;
    const evt = Array.isArray(joined) ? joined[0] : joined;
    return {
      registrationId: row.id as string,
      status: row.status as RegistrationStatus,
      event: evt ? mapPassEvent(evt) : null,
    };
  });
}

/** Événements ouverts à l'inscription (publics). */
export async function listOpenEvents(): Promise<PassEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select(PASS_EVENT_COLS)
    .eq('status', 'public')
    .order('starts_at', { ascending: true })
    .limit(50);
  if (error) {
    console.warn('[OXV][pilot][events] listOpenEvents :', error.message);
    return [];
  }
  return (data ?? []).map((r) => mapPassEvent(r as Record<string, unknown>));
}

/** Le pilote s'inscrit à un événement (statut `registered`). */
export async function registerForEvent(eventId: string): Promise<MutationResult> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { ok: false, error: 'Session expirée. Reconnectez-vous.' };
  const { error } = await supabase
    .from('event_registrations')
    .insert({ event_id: eventId, pilot_id: uid } as never);
  if (error) {
    // Violation d'unicité = déjà inscrit.
    if (error.code === '23505') return { ok: false, error: 'Vous êtes déjà inscrit.' };
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
