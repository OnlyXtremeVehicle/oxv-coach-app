/**
 * Service admin pour la gestion des coachs et leurs assignations.
 *
 * Utilisable uniquement par les users avec is_admin() = true (les RLS
 * sur coach_pilots + users le garantissent : policies admin_all).
 *
 * Fonctions exposées :
 *   - listCoaches() — tous les users role='coach'
 *   - listPilots() — tous les users role='pilot' (pour le picker assignation)
 *   - listAssignmentsForCoach(coachId) — assignations d'un coach donné
 *   - assignPilotToCoach({ coachId, pilotId, notes }) — INSERT
 *   - toggleAssignmentActive(assignmentId, active) — UPDATE active
 *   - forcePilotConsent(assignmentId) — UPDATE pilot_consent_at = NOW()
 *     (à utiliser SEULEMENT quand le pilote a consenti par voie hors-app,
 *     ex : papier signé. L'app pilote V1.1 aura un toggle propre.)
 */

import { supabase } from '@/lib/supabase';

export interface CoachRow {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
  /** Nombre de pilotes actifs assignés (calculé en JS). */
  activeAssignmentsCount: number;
}

export interface PilotRow {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  pilotLevel: string | null;
}

export interface AssignmentRow {
  id: string;
  coachId: string;
  pilotId: string;
  pilotEmail: string;
  pilotFirstName: string | null;
  pilotLastName: string | null;
  createdAt: string;
  active: boolean;
  pilotConsentAt: string | null;
  notes: string | null;
}

// ============================================================================
// Coachs
// ============================================================================

export async function listCoaches(): Promise<CoachRow[]> {
  const { data: coaches, error } = await supabase
    .from('users')
    .select('id, email, first_name, last_name, created_at')
    .eq('role', 'coach')
    .order('last_name', { ascending: true });

  if (error) {
    console.warn('[OXV][admin] listCoaches :', error.message);
    return [];
  }

  // Compte les assignations actives pour chaque coach (1 requête)
  const ids = (coaches ?? []).map((c) => c.id as string);
  const counts = await fetchActiveAssignmentsCount(ids);

  return (coaches ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    email: row.email as string,
    firstName: (row.first_name as string | null) ?? null,
    lastName: (row.last_name as string | null) ?? null,
    createdAt: row.created_at as string,
    activeAssignmentsCount: counts.get(row.id as string) ?? 0,
  }));
}

async function fetchActiveAssignmentsCount(coachIds: string[]): Promise<Map<string, number>> {
  if (coachIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('coach_pilots')
    .select('coach_id')
    .in('coach_id', coachIds)
    .eq('active', true);
  if (error || !data) return new Map();
  const counts = new Map<string, number>();
  for (const row of data as { coach_id: string }[]) {
    counts.set(row.coach_id, (counts.get(row.coach_id) ?? 0) + 1);
  }
  return counts;
}

// ============================================================================
// Pilotes
// ============================================================================

export async function listPilots(): Promise<PilotRow[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, first_name, last_name, pilot_level')
    .eq('role', 'pilot')
    .order('last_name', { ascending: true });

  if (error) {
    console.warn('[OXV][admin] listPilots :', error.message);
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    email: row.email as string,
    firstName: (row.first_name as string | null) ?? null,
    lastName: (row.last_name as string | null) ?? null,
    pilotLevel: (row.pilot_level as string | null) ?? null,
  }));
}

// ============================================================================
// Assignations
// ============================================================================

export async function listAssignmentsForCoach(coachId: string): Promise<AssignmentRow[]> {
  const { data, error } = await supabase
    .from('coach_pilots')
    .select(
      'id, coach_id, pilot_id, created_at, active, pilot_consent_at, notes, users!coach_pilots_pilot_id_fkey(email, first_name, last_name)'
    )
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[OXV][admin] listAssignmentsForCoach :', error.message);
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => {
    const joined = row.users as
      | { email?: string; first_name?: string | null; last_name?: string | null }
      | { email?: string; first_name?: string | null; last_name?: string | null }[]
      | null
      | undefined;
    const pilot = Array.isArray(joined) ? joined[0] : joined;
    return {
      id: row.id as string,
      coachId: row.coach_id as string,
      pilotId: row.pilot_id as string,
      pilotEmail: pilot?.email ?? '',
      pilotFirstName: pilot?.first_name ?? null,
      pilotLastName: pilot?.last_name ?? null,
      createdAt: row.created_at as string,
      active: Boolean(row.active),
      pilotConsentAt: (row.pilot_consent_at as string | null) ?? null,
      notes: (row.notes as string | null) ?? null,
    };
  });
}

export async function assignPilotToCoach(input: {
  coachId: string;
  pilotId: string;
  createdBy: string;
  notes?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('coach_pilots').insert({
    coach_id: input.coachId,
    pilot_id: input.pilotId,
    created_by: input.createdBy,
    notes: input.notes ?? null,
    // pilot_consent_at reste null → le coach ne verra rien tant que le
    // pilote n'a pas consenti (via /(app)/mon-coach ou forcePilotConsent).
  });

  if (error) {
    console.warn('[OXV][admin] assignPilotToCoach :', error.message);
    return { ok: false, error: error.message };
  }

  // Fire-and-forget : notif au pilote (avec prénom du coach pour le message)
  const { data: coach } = await supabase
    .from('users')
    .select('first_name')
    .eq('id', input.coachId)
    .maybeSingle();
  supabase.functions
    .invoke('notify-pilot-coach-assigned', {
      body: {
        pilotId: input.pilotId,
        coachFirstName: (coach as { first_name?: string | null } | null)?.first_name ?? null,
      },
    })
    .then(({ error: notifErr }) => {
      if (notifErr) console.warn('[OXV][admin] notify-pilot-coach-assigned :', notifErr.message);
    });

  return { ok: true };
}

export async function toggleAssignmentActive(
  assignmentId: string,
  active: boolean
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('coach_pilots').update({ active }).eq('id', assignmentId);

  if (error) {
    console.warn('[OXV][admin] toggleAssignmentActive :', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Envoie un email d'invitation au coach via Edge Function Resend.
 * Le coach doit déjà exister en base (créé par admin manuellement et
 * promu via promoteToCoach). Cet email lui donne les instructions
 * pour télécharger l'app, se connecter, et signer le pacte coaching.
 */
export async function sendCoachInvitation(input: {
  email: string;
  firstName: string | null;
  lastName: string | null;
  temporaryPassword?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.functions.invoke('send-coach-invitation', {
    body: {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      temporaryPassword: input.temporaryPassword,
    },
  });
  if (error) {
    console.warn('[OXV][admin] sendCoachInvitation :', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Promeut un user (role='pilot') en coach (role='coach').
 * Action réversible via demoteToPilot.
 */
export async function promoteToCoach(userId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('users').update({ role: 'coach' }).eq('id', userId);
  if (error) {
    console.warn('[OXV][admin] promoteToCoach :', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Rétrograde un coach en pilote (role='pilot').
 *
 * À utiliser quand l'admin se trompe, ou quand un coach quitte ses
 * fonctions. Les assignations coach_pilots existantes deviennent
 * dormantes (le user perd ses droits via is_coach_of qui filtre sur
 * active=true ET consent NOT NULL — la double-protection RLS tient).
 *
 * V1.1 : faire en transaction avec désactivation explicite des
 * assignations pour un nettoyage immédiat.
 */
export async function demoteToPilot(userId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('users').update({ role: 'pilot' }).eq('id', userId);
  if (error) {
    console.warn('[OXV][admin] demoteToPilot :', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Force le consentement RGPD pour une assignation donnée.
 *
 * À utiliser SEULEMENT quand le pilote a consenti par voie hors-app
 * (ex : signature sur papier lors d'un track day). L'app pilote V1.1
 * exposera un toggle propre pour que le pilote consente lui-même.
 *
 * Trace : created_by côté admin_audit (à câbler en V1.1).
 */
export async function forcePilotConsent(
  assignmentId: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('coach_pilots')
    .update({ pilot_consent_at: new Date().toISOString() })
    .eq('id', assignmentId);

  if (error) {
    console.warn('[OXV][admin] forcePilotConsent :', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
