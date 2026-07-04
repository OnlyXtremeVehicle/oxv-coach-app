/**
 * Présences jour J (Lot M3) — check-in sur les tables du SITE.
 *
 * Le site (oxvehicle.fr) vit sur `sessions` + `registrations` ; ses KPI, la
 * demande d'avis J+1 (cron) et la livraison des médias s'appuient sur
 * `registrations.attended_at`. L'app pointe donc la présence LÀ, pas seulement
 * dans `event_registrations` (héritage, migration M4 à venir).
 *
 * RLS : admin uniquement pour la liste (les inscriptions des autres) ; le
 * pointage passe par la policy update admin. Aucune donnée de télémétrie ici.
 */

import { supabase } from '@/lib/supabase';

export interface AttendanceRegistration {
  id: string;
  userId: string;
  pilotName: string;
  offerType: string;
  status: string;
  slotChoice: string | null;
  attendedAt: string | null;
}

export interface AttendanceSession {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  format: string | null;
  isPrivate: boolean;
  privateClientName: string | null;
  registrations: AttendanceRegistration[];
}

/**
 * Sessions du jour (fuseau du device) avec leurs inscriptions et le nom du
 * pilote. Deux requêtes + un mapping — pas de dépendance à une FK PostgREST.
 */
export async function listTodayAttendance(): Promise<AttendanceSession[]> {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const dayIso = `${y}-${m}-${d}`;

  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('id, date, start_time, end_time, format, is_private, private_client_name')
    .eq('date', dayIso)
    .order('start_time', { ascending: true });
  if (sessionsError || !sessions || sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);
  const { data: regs } = await supabase
    .from('registrations')
    .select('id, user_id, session_id, offer_type, status, slot_choice, attended_at')
    .in('session_id', sessionIds)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: true });

  const userIds = [...new Set((regs ?? []).map((r) => r.user_id))];
  const names = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .in('id', userIds);
    for (const u of users ?? []) {
      const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
      names.set(u.id, name || 'Pilote');
    }
  }

  return sessions.map((s) => ({
    id: s.id,
    date: s.date,
    startTime: s.start_time,
    endTime: s.end_time,
    format: s.format,
    isPrivate: Boolean(s.is_private),
    privateClientName: s.private_client_name,
    registrations: (regs ?? [])
      .filter((r) => r.session_id === s.id)
      .map((r) => ({
        id: r.id,
        userId: r.user_id,
        pilotName: names.get(r.user_id) ?? 'Pilote',
        offerType: String(r.offer_type),
        status: String(r.status),
        slotChoice: r.slot_choice,
        attendedAt: r.attended_at,
      })),
  }));
}

/** Pointe (ou dépointe) la présence — horodatage `attended_at` du site. */
export async function setAttendance(
  registrationId: string,
  attended: boolean
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('registrations')
    .update({ attended_at: attended ? new Date().toISOString() : null })
    .eq('id', registrationId);
  return error ? { ok: false, error: error.message } : { ok: true };
}
