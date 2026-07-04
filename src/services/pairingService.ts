/**
 * Appairage site ↔ app (Lot M3) — échange d'un code du site contre une session.
 *
 * Flux (edge `pair-app`, déployée, verify_jwt=false car pré-auth) :
 *   1. L'app poste { action: 'redeem', code } — sans JWT, l'utilisateur n'est
 *      pas encore connecté. L'edge vérifie le code (valide, non utilisé, non
 *      expiré), le consomme, et renvoie { token_hash }.
 *   2. L'app appelle supabase.auth.verifyOtp({ type: 'magiclink', token_hash })
 *      et obtient sa session — le listener onAuthStateChange du store auth
 *      prend le relais (chargement du profil, redirection par rôle).
 *
 * Sécurité : anti-brute-force côté serveur (10 tentatives/min/IP). Aucun code
 * ni token n'est journalisé ici.
 */

import { supabase } from '@/lib/supabase';
import {
  isPairingCodeComplete,
  normalizePairingCode,
  type PairingErrorCode,
} from '@/services/pairingLogic';

export type RedeemResult = { ok: true } | { ok: false; error: PairingErrorCode };

export async function redeemPairingCode(input: string): Promise<RedeemResult> {
  const code = normalizePairingCode(input);
  if (!isPairingCodeComplete(code)) {
    return { ok: false, error: 'invalid_or_expired' };
  }

  let tokenHash: string | null = null;
  try {
    const { data, error } = await supabase.functions.invoke('pair-app', {
      body: { action: 'redeem', code },
    });
    if (error) {
      // L'edge répond en JSON même en erreur ; on tente d'en extraire le code.
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        try {
          const body = (await ctx.json()) as { error?: string };
          if (body?.error === 'rate_limited') return { ok: false, error: 'rate_limited' };
          if (body?.error === 'invalid_or_expired')
            return { ok: false, error: 'invalid_or_expired' };
          if (body?.error === 'user_not_found') return { ok: false, error: 'user_not_found' };
          if (body?.error === 'link_failed') return { ok: false, error: 'link_failed' };
        } catch {
          // corps illisible — traité comme inconnu ci-dessous
        }
      }
      return { ok: false, error: 'unknown' };
    }
    tokenHash = (data as { token_hash?: string })?.token_hash ?? null;
  } catch {
    return { ok: false, error: 'network' };
  }

  if (!tokenHash) return { ok: false, error: 'unknown' };

  const { error: otpError } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: tokenHash,
  });
  if (otpError) return { ok: false, error: 'link_failed' };

  return { ok: true };
}
