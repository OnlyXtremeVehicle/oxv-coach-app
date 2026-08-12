/**
 * Second facteur (TOTP) pour les comptes à privilèges.
 *
 * ===========================================================================
 * POURQUOI CE SERVICE, ET POURQUOI PERSONNE NE PEUT ENRÔLER À LA PLACE D'UN AUTRE
 * ===========================================================================
 *
 * La politique de confidentialité affichée au pilote annonce une
 * « authentification forte pour les comptes administrateurs (2FA TOTP
 * obligatoire) ». Vérifié en production le 12/08/2026 :
 *
 *     select count(f.id) from public.users u
 *       left join auth.mfa_factors f on f.user_id = u.id
 *      where u.role = 'admin'
 *     → 0
 *
 * Zéro facteur, sur trois comptes. Ni enrôlé, ni a fortiori vérifié. Et aucun
 * mécanisme côté code : ni écran d'enrôlement, ni contrôle du niveau
 * d'assurance dans la garde de l'espace admin.
 *
 * **L'enrôlement ne peut pas être délégué.** Un facteur enrôlé par un tiers est
 * un secret que ce tiers connaît — ce n'est alors plus un second facteur, c'est
 * un premier facteur dupliqué. La personne doit scanner le code avec SON
 * application d'authentification et confirmer avec un code qu'elle seule lit.
 * Ce service porte la mécanique ; le geste reste à son titulaire.
 *
 * ===========================================================================
 * CE QUE DIT LE DROIT, ET CE QU'IL NE DIT PAS
 * ===========================================================================
 *
 * **Le RGPD n'impose pas le 2FA.** Ni l'article 5.1.f ni l'article 32 ne
 * l'exigent à eux seuls, et l'écrire dans un document affaiblirait OXV devant
 * un contrôleur qui le sait.
 *
 * La CNIL le RECOMMANDE expressément dans deux hypothèses qui visent OXV de
 * plein fouet : les traitements de données sensibles au sens de l'article 9
 * (le cardio des pilotes en est), et les comptes à privilèges.
 *
 * Ce qui est en revanche certain : annoncer une mesure qu'on n'applique pas est
 * un écart entre le déclaré et le réel, et c'est cet écart qui se sanctionne.
 *
 * ===========================================================================
 * TOTP, PAS SMS
 * ===========================================================================
 *
 * La CNIL recommande de combiner un facteur de connaissance et un facteur de
 * possession. Le SMS n'en est pas un bon : il s'intercepte, et il se détourne
 * par portabilité frauduleuse. On reste sur TOTP, et on ne bascule pas « pour
 * la commodité ».
 *
 * **Les codes de secours sont indispensables**, faute de quoi la mesure sera
 * contournée en pratique le jour d'une perte de téléphone. Supabase n'en génère
 * pas : la procédure est un second facteur enrôlé sur un second appareil, ou un
 * accès de récupération conservé hors ligne. C'est écrit dans la marche à
 * suivre — voir `docs/juridique/08_2FA_ADMIN.md`.
 */

import { supabase } from '@/lib/supabase';

import { type NiveauAssurance } from './mfaLogic';

export { doitPresenterFacteur, sansSecondFacteur, type NiveauAssurance } from './mfaLogic';

/** Lit le niveau d'assurance de la session. Ne lève jamais. */
export async function lireNiveauAssurance(): Promise<NiveauAssurance> {
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) return { courant: null, requis: null };
    return {
      courant: (data.currentLevel as 'aal1' | 'aal2' | null) ?? null,
      requis: (data.nextLevel as 'aal1' | 'aal2' | null) ?? null,
    };
  } catch {
    return { courant: null, requis: null };
  }
}

export interface EnrolementCommence {
  factorId: string;
  /** Le secret à saisir à la main si le QR ne passe pas. */
  secret: string;
  /** L'URI `otpauth://` — à rendre en QR. */
  uri: string;
}

/**
 * Commence l'enrôlement d'un facteur TOTP.
 *
 * Rend le secret ET l'URI : le secret sert au cas où l'appareil ne peut pas
 * lire de QR. **Ni l'un ni l'autre ne doit être journalisé** — ce sont des
 * secrets d'authentification, et un journal part chez un tiers.
 */
export async function commencerEnrolement(
  nom = 'OXV Admin'
): Promise<{ ok: true; data: EnrolementCommence } | { ok: false; error: string }> {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: nom,
  });
  if (error || !data) return { ok: false, error: error?.message ?? 'Enrôlement impossible.' };
  return {
    ok: true,
    data: {
      factorId: data.id,
      secret: data.totp.secret,
      uri: data.totp.uri,
    },
  };
}

/**
 * Confirme l'enrôlement avec le code lu sur l'application d'authentification.
 *
 * Tant que ce pas n'est pas franchi, le facteur reste `unverified` et ne
 * protège rien. C'est le pas que personne ne peut faire à la place du
 * titulaire.
 */
export async function confirmerEnrolement(
  factorId: string,
  code: string
): Promise<{ ok: boolean; error?: string }> {
  const { data: chal, error: e1 } = await supabase.auth.mfa.challenge({ factorId });
  if (e1 || !chal) return { ok: false, error: e1?.message ?? 'Défi impossible.' };
  const { error: e2 } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: chal.id,
    code: code.trim(),
  });
  if (e2) return { ok: false, error: 'Code refusé. Vérifiez l’heure de votre téléphone.' };
  return { ok: true };
}

export interface FacteurInscrit {
  id: string;
  nom: string;
  verifie: boolean;
}

/** Les facteurs TOTP du compte, vérifiés ou non. */
export async function listerFacteurs(): Promise<FacteurInscrit[]> {
  try {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error || !data) return [];
    return (data.totp ?? []).map((f) => ({
      id: f.id,
      nom: f.friendly_name ?? 'Second facteur',
      verifie: f.status === 'verified',
    }));
  } catch {
    return [];
  }
}

/**
 * Élève la session courante en présentant un code.
 *
 * Appelée quand `doitPresenterFacteur` est vrai : le compte a un facteur, la
 * session ne l'a pas encore présenté.
 */
export async function eleverSession(
  factorId: string,
  code: string
): Promise<{ ok: boolean; error?: string }> {
  return confirmerEnrolement(factorId, code);
}

/**
 * Retire un facteur.
 *
 * Volontairement exposé : un second facteur qu'on ne peut pas retirer est un
 * compte qu'on perd avec son téléphone. La protection contre le retrait abusif
 * est que l'appel exige une session déjà élevée — Supabase le vérifie.
 */
export async function retirerFacteur(factorId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  return error ? { ok: false, error: error.message } : { ok: true };
}
