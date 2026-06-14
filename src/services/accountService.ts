/**
 * Service compte — droit à l'effacement (S3, charte 12 / RGPD art. 17).
 *
 * V1 côté app : le pilote demande la suppression ; on horodate la demande et
 * la date d'effacement (délai de grâce de 30 jours, conforme à la politique de
 * confidentialité §7.3). L'effacement RÉEL (auth.users + cascade) est porté par
 * une edge function planifiée à écrire (service_role) — un client RLS ne peut
 * pas se supprimer de auth.users. Pendant la grâce, le compte reste réactivable.
 *
 * Les colonnes deletion_requested_at / deletion_scheduled_at existent déjà en base.
 */

import { supabase } from '@/lib/supabase';

/** Délai de grâce avant effacement définitif (politique de confidentialité §7.3). */
export const DELETION_GRACE_DAYS = 30;

export interface DeletionResult {
  ok: boolean;
  /** Date ISO de l'effacement prévu (now + grâce), si la demande a été posée. */
  scheduledFor?: string;
  error?: string;
}

/**
 * Pose une demande de suppression de compte : horodate la demande et planifie
 * l'effacement à J+30. Best-effort ; l'appelant déconnecte ensuite le pilote.
 */
export async function requestAccountDeletion(userId: string): Promise<DeletionResult> {
  const now = new Date();
  const scheduled = new Date(now.getTime() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);

  const { error } = await supabase
    .from('users')
    .update({
      deletion_requested_at: now.toISOString(),
      deletion_scheduled_at: scheduled.toISOString(),
    } as never)
    .eq('id', userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, scheduledFor: scheduled.toISOString() };
}
