/**
 * Service parrainage & écuries (A3) — v2.
 *
 * S'adosse INTÉGRALEMENT aux fonctions serveur déjà en production (cf.
 * docs/architecture/12_CREWS_PROD.md) : aucune table n'est créée ni écrite en
 * direct côté mutations. Toute la logique de rattachement vit dans la fonction
 * SECURITY DEFINER `oxv_redeem_referral` (fail-closed par construction).
 *
 * RPC serveur consommées :
 *   - oxv_get_my_referral_code() → text        (code d'affiliation de l'appelant)
 *   - oxv_redeem_referral(p_code) → jsonb       ({ok, crew_id} | {ok:false, error})
 *   - oxv_my_crew_id()          → uuid | null   (l'écurie de l'appelant)
 *   - oxv_name_my_crew(p_name)  → jsonb         (nomme l'écurie de l'appelant)
 *
 * Le mapping d'erreurs (jsonb → message FR vouvoyé) est pur et testé dans
 * `referralLogic.ts`. Ce fichier ne fait que l'I/O.
 */

import { supabase } from '@/lib/supabase';
import { interpretRedeem, REDEEM_ERROR_MESSAGES, REDEEM_UNKNOWN_ERROR } from './referralLogic';

/** Résultat public d'une tentative de parrainage. */
export interface RedeemOutcome {
  ok: boolean;
  error?: string;
  crewId?: string;
}

/** Vue de l'écurie de l'appelant (capitaine + membres). */
export interface MyCrew {
  crewId: string;
  name: string | null;
  members: { userId: string; role: string }[];
}

/**
 * Renvoie le code de parrainage de l'appelant (le génère côté serveur s'il
 * n'existe pas encore). Erreur transport/RLS remontée (jamais avalée).
 */
export async function getMyCode(): Promise<string> {
  const { data, error } = await supabase.rpc('oxv_get_my_referral_code');
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Code de parrainage indisponible pour le moment.');
  return data;
}

/**
 * Utilise un code de parrainage : rattache l'appelant à l'écurie du parrain.
 *
 * Idempotent : rejouer alors qu'on est déjà dans une écurie n'est PAS un échec —
 * on confirme l'écurie courante et on renvoie un succès stable (même crewId).
 * Un code vide/inconnu, l'auto-parrainage et l'absence d'auth remontent en
 * messages FR vouvoyés (cf. `referralLogic`).
 */
export async function redeem(code: string): Promise<RedeemOutcome> {
  const trimmed = code.trim();
  if (!trimmed) return { ok: false, error: REDEEM_ERROR_MESSAGES.code_invalide };

  const { data, error } = await supabase.rpc('oxv_redeem_referral', { p_code: trimmed });
  if (error) return { ok: false, error: error.message };

  const result = interpretRedeem(data);

  if (result.alreadyMember) {
    // Déjà rattaché : le serveur ne renvoie pas de crew_id dans ce cas, on le
    // résout pour offrir un résultat idempotent identique au premier succès.
    // Un échec de résolution ne dégrade PAS le succès (état déjà atteint) — on le
    // journalise sans le remonter comme erreur.
    const crewId = await currentCrewId().catch((e: unknown) => {
      console.warn(
        '[OXV][referral] résolution écurie courante :',
        e instanceof Error ? e.message : String(e)
      );
      return null;
    });
    return { ok: true, crewId: crewId ?? undefined };
  }

  return { ok: result.ok, error: result.error, crewId: result.crewId };
}

/**
 * L'écurie de l'appelant avec ses membres, ou null s'il n'appartient à aucune.
 * Lecture bornée par RLS (`oxv_my_crew_id` + policies `crews`/`crew_members`).
 */
export async function getMyCrew(): Promise<MyCrew | null> {
  const crewId = await currentCrewId();
  if (!crewId) return null;

  const { data: crew, error: crewErr } = await supabase
    .from('crews')
    .select('id, name')
    .eq('id', crewId)
    .maybeSingle();
  if (crewErr) throw new Error(crewErr.message);
  if (!crew) return null;

  const { data: members, error: memErr } = await supabase
    .from('crew_members')
    .select('user_id, role')
    .eq('crew_id', crewId)
    .order('joined_at', { ascending: true });
  if (memErr) throw new Error(memErr.message);

  return {
    crewId,
    name: crew.name ?? null,
    members: (members ?? []).map((m) => ({ userId: m.user_id, role: m.role })),
  };
}

/**
 * Nomme (ou renomme) l'écurie de l'appelant. Réservé au capitaine côté serveur
 * (RLS + logique de la fonction) ; un refus remonte en message FR.
 */
export async function nameMyCrew(name: string): Promise<{ ok: boolean; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: 'Le nom de l’écurie ne peut pas être vide.' };

  const { data, error } = await supabase.rpc('oxv_name_my_crew', { p_name: trimmed });
  if (error) return { ok: false, error: error.message };

  const raw: unknown = data;
  const obj = (raw ?? {}) as { ok?: unknown; error?: unknown };
  if (obj.ok === true) return { ok: true };
  const code = typeof obj.error === 'string' && obj.error ? obj.error : REDEEM_UNKNOWN_ERROR;
  return { ok: false, error: code };
}

/**
 * Identifiant de l'écurie courante via la fonction serveur, ou null. Erreur
 * transport/RLS remontée.
 */
async function currentCrewId(): Promise<string | null> {
  const { data, error } = await supabase.rpc('oxv_my_crew_id');
  if (error) throw new Error(error.message);
  return data ?? null;
}
