/**
 * Service B2B Event Report (migration 0023).
 *
 * L'admin GÉNÈRE un rapport par (événement, partenaire) : les compteurs de
 * participation sont SNAPSHOTTÉS depuis `event_registrations` (que seul l'admin
 * lit) ; le partenaire ne voit que l'agrégat figé, et seulement une fois
 * `status = 'shared'`. Aucune donnée pilote individuelle ne transite.
 */

import { supabase } from '@/lib/supabase';

import { type PassEvent } from './eventsService';

export type B2BReportStatus = 'draft' | 'shared';

export interface B2BReport {
  id: string;
  eventId: string;
  partnerId: string;
  registeredCount: number;
  checkedInCount: number;
  mediaSummary: string | null;
  conclusion: string | null;
  status: B2BReportStatus;
  generatedAt: string;
  updatedAt: string;
}

const COLS =
  'id, event_id, partner_id, registered_count, checked_in_count, media_summary, conclusion, status, generated_at, updated_at';

function map(r: Record<string, unknown>): B2BReport {
  return {
    id: r.id as string,
    eventId: r.event_id as string,
    partnerId: r.partner_id as string,
    registeredCount: Number(r.registered_count ?? 0),
    checkedInCount: Number(r.checked_in_count ?? 0),
    mediaSummary: (r.media_summary as string | null) ?? null,
    conclusion: (r.conclusion as string | null) ?? null,
    status: r.status as B2BReportStatus,
    generatedAt: r.generated_at as string,
    updatedAt: r.updated_at as string,
  };
}

export interface ReportResult {
  ok: boolean;
  report?: B2BReport;
  error?: string;
}

/** Charge le rapport (event, partner) s'il existe (admin). */
export async function getReport(eventId: string, partnerId: string): Promise<B2BReport | null> {
  const { data, error } = await supabase
    .from('b2b_event_reports')
    .select(COLS)
    .eq('event_id', eventId)
    .eq('partner_id', partnerId)
    .maybeSingle();
  if (error || !data) return null;
  return map(data as Record<string, unknown>);
}

/**
 * Génère/rafraîchit le rapport (admin) : snapshot des compteurs depuis les
 * inscriptions. Préserve l'éditorial (media/conclusion) et le statut existants.
 */
export async function generateReport(eventId: string, partnerId: string): Promise<ReportResult> {
  const { data: auth } = await supabase.auth.getUser();
  const base = supabase.from('event_registrations');
  const { count: registered } = await base
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .neq('status', 'cancelled');
  const { count: checkedIn } = await supabase
    .from('event_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('status', 'checked_in');

  const { data, error } = await supabase
    .from('b2b_event_reports')
    .upsert(
      {
        event_id: eventId,
        partner_id: partnerId,
        registered_count: registered ?? 0,
        checked_in_count: checkedIn ?? 0,
        generated_by: auth?.user?.id ?? null,
        generated_at: new Date().toISOString(),
      } as never,
      { onConflict: 'event_id,partner_id' }
    )
    .select(COLS)
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Génération impossible.' };
  return { ok: true, report: map(data as Record<string, unknown>) };
}

export interface ReportPatch {
  mediaSummary?: string;
  conclusion?: string;
  status?: B2BReportStatus;
}

/** Édite l'éditorial / le statut (admin). */
export async function updateReport(
  id: string,
  patch: ReportPatch
): Promise<{ ok: boolean; error?: string }> {
  const row: Record<string, unknown> = {};
  if (patch.mediaSummary !== undefined) row.media_summary = patch.mediaSummary.trim() || null;
  if (patch.conclusion !== undefined) row.conclusion = patch.conclusion.trim() || null;
  if (patch.status !== undefined) row.status = patch.status;
  const { error } = await supabase
    .from('b2b_event_reports')
    .update(row as never)
    .eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export interface MySharedReport extends B2BReport {
  event: PassEvent | null;
}

const PARTNER_COLS = `${COLS}, events!b2b_event_reports_event_id_fkey(id, name, event_type, status, location_name, location_address, starts_at, ends_at, briefing_at, description)`;

/** Rapports PARTAGÉS du partenaire (RLS : own + shared). */
export async function listMySharedReports(): Promise<MySharedReport[]> {
  const { data, error } = await supabase
    .from('b2b_event_reports')
    .select(PARTNER_COLS)
    .order('generated_at', { ascending: false });
  if (error) {
    console.warn('[OXV][partner][b2b] listMySharedReports :', error.message);
    return [];
  }
  return (data ?? []).map((row: Record<string, unknown>) => {
    const joined = row.events as Record<string, unknown> | Record<string, unknown>[] | null;
    const e = Array.isArray(joined) ? joined[0] : joined;
    return {
      ...map(row),
      event: e
        ? {
            id: e.id as string,
            name: e.name as string,
            eventType: e.event_type as PassEvent['eventType'],
            status: e.status as PassEvent['status'],
            locationName: e.location_name as string,
            locationAddress: (e.location_address as string | null) ?? null,
            startsAt: e.starts_at as string,
            endsAt: e.ends_at as string,
            briefingAt: (e.briefing_at as string | null) ?? null,
            description: (e.description as string | null) ?? null,
          }
        : null,
    };
  });
}
