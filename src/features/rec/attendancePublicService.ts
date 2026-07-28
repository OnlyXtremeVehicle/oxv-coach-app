/**
 * Service C1 « Qui roule » (V2-L2) — inscrits opt-in d'une journée.
 *
 * S'adosse à la migration `20260719160000_l2_show_attendance.sql` DÉJÀ
 * APPLIQUÉE en prod :
 *   - colonne `users.show_attendance` (opt-in, défaut false, fail-closed) ;
 *   - fonction DEFINER `session_attendance_public(p_session uuid)` gatée :
 *     seuls les inscrits de la journée lisent la liste, seuls les opt-in y
 *     figurent (handle + avatar + crew, jamais le nom complet).
 *
 * Les types Supabase ne sont PAS régénérés dans ce lot (régénération en fin de
 * lot L2). L'appel RPC et la colonne `show_attendance` passent donc par un
 * accès localisé non typé — même patron sanctionné que circuitsService pour
 * les colonnes hors types générés.
 *
 * Le mapping des lignes est PUR et testé dans `preparationLogic.ts`.
 */

import { supabase } from '@/lib/supabase';

import { mapAttendanceRows, type AttendanceMember } from './preparationLogic';

/**
 * Inscrits opt-in de la journée `sessionId` (session site). RLS/DEFINER bornent
 * la lecture aux inscrits ; un non-inscrit ou une journée sans opt-in renvoie
 * `[]`. Erreur transport → `[]` (section calme, jamais de donnée fabriquée) :
 * une liste sociale absente vaut mieux qu'un état d'erreur alarmant.
 */
export async function listAttendance(
  sessionId: string,
  selfUserId?: string | null
): Promise<AttendanceMember[]> {
  // Migration C1 non régénérée dans les types : cast localisé de l'appel RPC.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rpc = supabase.rpc as any;
  const { data, error } = await rpc('session_attendance_public', { p_session: sessionId });
  if (error) {
    console.warn('[OXV][rec][attendance] listAttendance :', error.message);
    return [];
  }
  return mapAttendanceRows(Array.isArray(data) ? (data as unknown[]) : [], {
    selfUserId: selfUserId ?? null,
  });
}

/** Mon opt-in courant (`users.show_attendance`). Fail-closed : false par défaut. */
export async function getMyAttendanceOptIn(): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return false;
  // Colonne show_attendance absente des types générés : accès localisé.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table = supabase.from('users') as any;
  const { data, error } = await table.select('show_attendance').eq('id', uid).maybeSingle();
  if (error || !data) return false;
  return data.show_attendance === true;
}

/** Bascule mon opt-in (update own-row `users.show_attendance`). */
export async function setMyAttendanceOptIn(
  next: boolean
): Promise<{ ok: boolean; error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { ok: false, error: 'Vous devez être connecté.' };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table = supabase.from('users') as any;
  const { error } = await table.update({ show_attendance: next }).eq('id', uid);
  if (error) {
    console.warn('[OXV][rec][attendance] setMyAttendanceOptIn :', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Résout l'id de session SITE de MA journée `dateIso` (même logique que la v1
 * `loadDayLogistics`) : nécessaire comme `p_session` pour l'attendance et pour
 * `convoysService.getForSession`. RLS registrations own-row. Aucune journée
 * correspondante (ou annulée/archivée) → null.
 *
 * ---
 *
 * L'AMBIGUÏTÉ NE SE TRANCHE PAS TOUTE SEULE
 *
 * Cette fonction faisait `.find(...)` sur la liste des sessions du jour et
 * retenait **la première** non annulée. Tant qu'un pilote n'a qu'une inscription
 * par date, la première EST la bonne. Dès qu'il en a deux — deux circuits, une
 * journée privée et une publique — le choix devenait arbitraire, silencieux, et
 * décidait à quelle journée sa présence et son convoi seraient rattachés.
 *
 * Rien ne l'aurait signalé : l'ordre de `.in(...)` n'est pas garanti, donc le
 * défaut aurait pu changer de réponse d'un appel à l'autre.
 *
 * Doctrine du lot 12 : « une séance sans inscription reste sans inscription —
 * c'est un fait, pas un trou à combler. » Ici : **plusieurs journées candidates
 * rendent `null`**, comme aucune. L'appelant affiche l'absence plutôt qu'un
 * rattachement inventé.
 *
 * Le rapprochement PAR DATE reste, lui, légitime et nécessaire : c'est la seule
 * façon de savoir laquelle de mes journées est aujourd'hui. Ce qui était fautif,
 * c'est de trancher une égalité sans le dire.
 */
export async function resolveDaySessionId(userId: string, dateIso: string): Promise<string | null> {
  const { data: regs } = await supabase
    .from('registrations')
    .select('session_id, status')
    .eq('user_id', userId)
    .or('status.is.null,status.neq.cancelled')
    .order('created_at', { ascending: false })
    .limit(100);
  const sessionIds = [...new Set((regs ?? []).map((r) => r.session_id).filter(Boolean))];
  if (sessionIds.length === 0) return null;

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, date, status')
    .in('id', sessionIds)
    .eq('date', dateIso)
    .limit(5);
  const candidates = (sessions ?? []).filter(
    (s) => s.status !== 'cancelled' && s.status !== 'archived'
  );
  if (candidates.length !== 1) {
    if (candidates.length > 1) {
      console.warn(
        `[OXV][rec] ${candidates.length} journées inscrites le ${dateIso} : aucune retenue.`
      );
    }
    return null;
  }
  return candidates[0].id;
}
