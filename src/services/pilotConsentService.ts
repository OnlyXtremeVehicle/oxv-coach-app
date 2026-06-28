/**
 * Service côté pilote — consultation de ses coachs et gestion du
 * consentement RGPD au coaching.
 *
 * RLS coach_pilots :
 *   - SELECT autorisé : pilot_id = auth.uid()
 *   - UPDATE autorisé : pilot_id = auth.uid() (pour toggle pilot_consent_at)
 *
 * Le pilote ne peut PAS changer coach_id, pilot_id ni active. Seul l'admin
 * peut faire ça via /(admin)/coachs/[id].
 *
 * Doctrine : le consentement est libre, retiré à tout moment, et sans
 * justification. L'app n'insiste jamais ni ne moralise.
 */

import { supabase } from '@/lib/supabase';
import { OxvEvent } from '@/services/analyticsEvents';

/** Niveau de lecture accordé par le pilote (§6/§23), du plus restreint au plus ouvert. */
export type CoachAccessLevel = 'lecture_simple' | 'lecture_detaillee' | 'programme';

/** Les 3 niveaux, pour l'écran « Mon coach ». Libellés descriptifs, vouvoiement, sans emoji. */
export const COACH_ACCESS_LEVELS: { value: CoachAccessLevel; label: string; hint: string }[] = [
  {
    value: 'lecture_simple',
    label: 'Sessions seulement',
    hint: 'Votre coach voit vos sessions, vos tours et vos bilans. Pas la donnée brute.',
  },
  {
    value: 'lecture_detaillee',
    label: 'Analyse détaillée',
    hint: 'En plus : votre donnée brute et l’analyse virage par virage (Data Lab).',
  },
  {
    value: 'programme',
    label: 'Programme',
    hint: 'En plus : un accompagnement suivi dans la durée.',
  },
];

export interface MyCoachAssignment {
  /** ID de la ligne coach_pilots. */
  id: string;
  /** ID du coach (user role='coach'). */
  coachId: string;
  /** Nom du coach pour affichage (lecture seule, exposé via RLS users own + admin). */
  coachFirstName: string | null;
  coachLastName: string | null;
  coachEmail: string;
  /** Timestamp ISO du consentement, ou null si pas encore consenti. */
  pilotConsentAt: string | null;
  /** Niveau de lecture accordé (§6/§23). Sans effet tant que non consenti. */
  level: CoachAccessLevel;
  /** Si false, l'assignation est dormante côté admin (le coach ne verra rien). */
  active: boolean;
  /** Quand l'admin a créé l'assignation. */
  createdAt: string;
  /** Notes libres (généralement contexte assignation). */
  notes: string | null;
}

/**
 * Liste les assignations de coaching du pilote courant.
 * Retourne aussi les assignations non consenties (le pilote doit pouvoir
 * les voir pour consentir ou refuser).
 */
export async function listMyCoaches(): Promise<MyCoachAssignment[]> {
  const { data, error } = await supabase
    .from('coach_pilots')
    .select(
      'id, coach_id, pilot_consent_at, level, active, created_at, notes, users!coach_pilots_coach_id_fkey(email, first_name, last_name)'
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[OXV][pilot] listMyCoaches :', error.message);
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => {
    const joined = row.users as
      | { email?: string; first_name?: string | null; last_name?: string | null }
      | { email?: string; first_name?: string | null; last_name?: string | null }[]
      | null
      | undefined;
    const coach = Array.isArray(joined) ? joined[0] : joined;
    return {
      id: row.id as string,
      coachId: row.coach_id as string,
      coachEmail: coach?.email ?? '',
      coachFirstName: coach?.first_name ?? null,
      coachLastName: coach?.last_name ?? null,
      pilotConsentAt: (row.pilot_consent_at as string | null) ?? null,
      level: (row.level as CoachAccessLevel | null) ?? 'lecture_simple',
      active: Boolean(row.active),
      createdAt: row.created_at as string,
      notes: (row.notes as string | null) ?? null,
    };
  });
}

/**
 * Donne le consentement RGPD pour une assignation donnée, au niveau choisi par
 * le pilote (§6/§23). `lecture_simple` : sessions/tours/bilan. `lecture_detaillee`
 * et `programme` ouvrent en plus la donnée brute et l'analyse de virage.
 * Notifie le coach via push (fire-and-forget).
 */
export async function giveConsent(
  assignmentId: string,
  level: CoachAccessLevel = 'lecture_simple'
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase
    .from('coach_pilots')
    .update({ pilot_consent_at: new Date().toISOString(), level })
    .eq('id', assignmentId)
    .select('coach_id, pilot_id')
    .maybeSingle();

  if (error) {
    console.warn('[OXV][pilot] giveConsent :', error.message);
    return { ok: false, error: error.message };
  }

  // Notif au coach (fire-and-forget)
  if (data) {
    const row = data as { coach_id: string; pilot_id: string };
    const { data: pilot } = await supabase
      .from('users')
      .select('first_name')
      .eq('id', row.pilot_id)
      .maybeSingle();
    supabase.functions
      .invoke('notify-coach-consent-received', {
        body: {
          coachId: row.coach_id,
          pilotFirstName: (pilot as { first_name?: string | null } | null)?.first_name ?? null,
        },
      })
      .then(({ error: notifErr }) => {
        if (notifErr)
          console.warn('[OXV][pilot] notify-coach-consent-received :', notifErr.message);
      });
  }

  OxvEvent.coachConsentementDonne(level); // KPI coach_share_rate (§27)
  return { ok: true };
}

/**
 * Change le niveau de lecture d'une affiliation déjà consentie (§6/§23).
 * Restreindre (vers `lecture_simple`) coupe immédiatement l'accès du coach aux
 * frames et aux métriques de virage (RLS `is_detailed_coach_of`), sans rompre
 * l'affiliation ni l'accès aux sessions/bilans.
 */
export async function setConsentLevel(
  assignmentId: string,
  level: CoachAccessLevel
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('coach_pilots').update({ level }).eq('id', assignmentId);
  if (error) {
    console.warn('[OXV][pilot] setConsentLevel :', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Retire le consentement (revient à null). Le coach cesse immédiatement
 * de voir les données du pilote (RLS is_coach_of vérifie consent NOT NULL).
 * L'assignation reste en base — admin peut désactiver pour nettoyer.
 */
export async function revokeConsent(
  assignmentId: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('coach_pilots')
    .update({ pilot_consent_at: null })
    .eq('id', assignmentId);

  if (error) {
    console.warn('[OXV][pilot] revokeConsent :', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
