/**
 * Service candidatures fondateur (lot BE-1, Mission B) — I/O Supabase.
 *
 * Table `founder_applications` : une ligne par utilisateur (contrainte UNIQUE
 * sur `user_id`). Le statut est FORCÉ à `pending` à l'insert par un trigger
 * côté serveur ; ce service ne le fixe donc jamais. RLS : le pilote lit et
 * insère sa propre ligne, l'admin voit tout.
 *
 * La règle (bornes de motivation, libellés) vit dans `founderLogic` (pur,
 * testé) ; ici on ne fait que la persistance. Erreurs remontées, jamais
 * masquées : écriture → { ok, error } ; lecture → défaut sûr après log.
 *
 * Ton OXV : vouvoiement, sec, sans emoji.
 */

import { supabase } from '@/lib/supabase';
import {
  validateMotivation,
  normalizeFounderStatus,
  type FounderApplicationStatus,
} from './founderLogic';

/** Vue « ma candidature » exposée à l'UI. */
export interface MyFounderApplication {
  status: FounderApplicationStatus;
  createdAt: string;
  decidedAt: string | null;
}

/**
 * Dépose (ou tente de déposer) MA candidature fondateur. Valide la motivation
 * via `founderLogic`, insère la ligne (statut posé par le trigger serveur).
 * Une violation d'unicité (`user_id`) signifie qu'une candidature existe déjà.
 */
export async function apply(
  motivation: string,
  referrerCode?: string
): Promise<{ ok: boolean; error?: string }> {
  const check = validateMotivation(motivation);
  if (!check.ok) return { ok: false, error: check.error };

  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { ok: false, error: 'Session expirée. Reconnectez-vous.' };

  const referrer = referrerCode?.trim();
  const { error } = await supabase.from('founder_applications').insert({
    user_id: uid,
    motivation: motivation.trim(),
    referrer_code: referrer && referrer.length > 0 ? referrer : null,
  });

  if (error) {
    // 23505 = unique_violation sur user_id : candidature déjà envoyée.
    if (error.code === '23505') {
      return { ok: false, error: 'Votre candidature a déjà été envoyée.' };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Lit MA candidature, ou `null` si je n'en ai pas déposé. Le filtre explicite
 * sur `user_id` est nécessaire : un admin verrait sinon toutes les lignes
 * (RLS « admin all »), ce qui ferait échouer `maybeSingle`.
 */
export async function getMyApplication(): Promise<MyFounderApplication | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return null;

  const { data, error } = await supabase
    .from('founder_applications')
    .select('status, created_at, decided_at')
    .eq('user_id', uid)
    .maybeSingle();

  if (error) {
    console.warn('[OXV][founder] getMyApplication :', error.message);
    return null;
  }
  if (!data) return null;

  return {
    status: normalizeFounderStatus(data.status),
    createdAt: data.created_at,
    decidedAt: data.decided_at,
  };
}

/**
 * Nombre de fondateurs validés (candidatures `approved`), via la fonction RPC
 * `founders_count`. Retourne 0 après log si l'appel échoue.
 */
export async function getFoundersCount(): Promise<number> {
  const { data, error } = await supabase.rpc('founders_count');
  if (error) {
    console.warn('[OXV][founder] getFoundersCount :', error.message);
    return 0;
  }
  return typeof data === 'number' ? data : 0;
}
