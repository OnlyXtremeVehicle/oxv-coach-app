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

import { decisionPointage } from './presenceLogic';

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
  /** Circuit de la journée (M6) — nom résolu, null si non renseigné. */
  circuitName: string | null;
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
    .select('id, date, start_time, end_time, format, is_private, private_client_name, circuit_id')
    .eq('date', dayIso)
    .order('start_time', { ascending: true });
  // UNE PANNE N'EST PAS UNE JOURNÉE SANS SÉANCE.
  //
  // Les deux rendaient `[]`, et l'écran de pointage affichait « aucune séance
  // aujourd'hui » aussi bien quand il n'y en avait pas que quand la lecture
  // avait échoué. Le jour J, au portail, c'est la différence entre « personne
  // n'est attendu » et « je ne sais pas qui est attendu ».
  if (sessionsError) throw new Error(sessionsError.message);
  if (!sessions || sessions.length === 0) return [];

  // Résout le nom du circuit de chaque journée (M6), une requête groupée.
  const circuitIds = [...new Set(sessions.map((s) => s.circuit_id).filter(Boolean))] as string[];
  const circuitNames = new Map<string, string>();
  if (circuitIds.length > 0) {
    const { data: circuits } = await supabase
      .from('circuits')
      .select('id, name')
      .in('id', circuitIds);
    for (const c of circuits ?? []) circuitNames.set(c.id, c.name);
  }

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
    circuitName: s.circuit_id ? (circuitNames.get(s.circuit_id) ?? null) : null,
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

/**
 * Pointe (ou dépointe) la présence — horodatage `attended_at` du site.
 *
 * ---
 *
 * LA PRÉSENCE NE SE POSE QUE DEPUIS `pending` OU `confirmed`
 *
 * Cette fonction écrivait `attended_at` sans jamais regarder le statut. Un
 * pilote **annulé**, **déclaré absent** ou dont le paiement est en attente
 * pouvait donc être marqué présent d'un seul geste. `attended_at` alimente les
 * indicateurs du site, la demande d'avis J+1 et la livraison des médias : une
 * présence fausse s'y propage sans jamais lever d'erreur.
 *
 * L'enum de `registration_status_enum` ne protégeait rien ici : il borne
 * `status`, pas `attended_at`. Les deux colonnes pouvaient diverger librement.
 *
 * La garde est **fail-closed** : sans lecture fiable du statut courant, on
 * n'écrit pas. Décider à l'aveugle, c'est reprendre le risque qu'on ferme.
 *
 * Le DÉPOINTAGE reste toujours permis — c'est la correction d'une erreur, et
 * une garde qui empêche de réparer finit contournée à la main dans la base.
 */
/**
 * Pointe ou dépointe une présence.
 *
 * `pointeurId` — QUI pointe. La colonne `registrations.attended_by` existe
 * depuis L33 (02/08/2026) : sans elle, la ligne affirmait une présence que
 * personne n'assumait, et une contestation de facturation était insoluble. Le
 * cahier le dit : « une inscription vaut un paiement ».
 *
 * L'identité vient de l'appelant plutôt que d'`auth.uid()` : un service ne
 * devine pas qui agit, il le reçoit.
 */
export async function setAttendance(
  registrationId: string,
  attended: boolean,
  pointeurId: string | null = null
): Promise<{ ok: boolean; error?: string }> {
  if (attended) {
    const { data, error: lecture } = await supabase
      .from('registrations')
      .select('status, attended_at')
      .eq('id', registrationId)
      .maybeSingle();

    if (lecture) return { ok: false, error: lecture.message };
    if (!data) return { ok: false, error: 'Inscription introuvable.' };

    const decision = decisionPointage(data.status, data.attended_at != null, true);
    if (!decision.autorise) return { ok: false, error: decision.raison };
  }

  const maintenant = new Date().toISOString();
  const { error } = await supabase
    .from('registrations')
    .update({
      attended_at: attended ? maintenant : null,
      // L'AUTEUR ET L'INSTANT DU GESTE, distincts de l'heure de présence.
      // Dépointer efface la présence mais garde la trace de qui l'a fait :
      // c'est justement le geste qu'on voudra pouvoir expliquer.
      attended_by: pointeurId,
      attendance_updated_at: maintenant,
    })
    .eq('id', registrationId);
  return error ? { ok: false, error: error.message } : { ok: true };
}
