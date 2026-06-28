/**
 * Service événements (migration 0021). Lecture côté app : un événement rattaché
 * à une capture sert au bandeau « mode démo » du Bilan, au Pass OXV et au B2B
 * Report. La création/édition (admin) s'ajoute en PR-21.
 *
 * `internal_notes` n'est JAMAIS sélectionné ici (contrôle au niveau requête,
 * comme `users.admin_notes`).
 */

import { supabase } from '@/lib/supabase';

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
