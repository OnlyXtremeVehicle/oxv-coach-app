/**
 * Service consentements (PR-38) — source unique des choix IA du pilote.
 *
 * Centralise la lecture/écriture des consentements stockés sur `users` pour que
 * les Réglages ET le Centre de consentement écrivent par le MÊME chemin (pas de
 * divergence). Les deux consentements IA impliquent un transfert hors UE (OpenAI,
 * US) :
 *   - ai_debrief_enabled : opt-OUT, défaut ON (le débrief J+1 IA).
 *   - coach_ai_enabled   : opt-IN explicite, défaut OFF (assistant IA du coach).
 *
 * Le gate réel est côté serveur (edge functions) ; ici on persiste le choix, ce
 * qui rend vraie la promesse RGPD « désactivable dans vos paramètres ».
 *
 * DIVERGENCE DE COUVERTURE (contrat, à connaître) — deux écrans écrivent par ce
 * service, MAIS n'exposent pas le même jeu de consentements :
 *   - IA débrief + IA coach : présents dans les DEUX (Réglages app2 ET Centre de
 *     consentement unifié v1, app/(app)/consentements.tsx) — même write-path, pas
 *     de seconde source de vérité. Bon.
 *   - BIOMÉTRIE (capture + partage cardio = donnée de SANTÉ, la plus sensible) :
 *     exposée UNIQUEMENT dans Réglages (app2). Le Centre unifié v1 — qui se
 *     présente pourtant comme exhaustif (« chacun de ses consentements ») — ne la
 *     référence PAS. Sa revendication d'exhaustivité est donc inexacte pour le
 *     consentement le plus sensible tant que la section biométrie n'y est pas
 *     ajoutée (via ces MÊMES setters). Décision produit ouverte (surface
 *     juridique art. 7-3) — à trancher par Gabin : ajouter la section au Centre,
 *     ou atténuer sa revendication d'exhaustivité.
 */

import { supabase } from '@/lib/supabase';

export interface AiConsents {
  /** Débrief J+1 rédigé par IA (hors UE). Opt-out, défaut activé. */
  aiDebriefEnabled: boolean;
  /** Assistant IA du coach sur vos données (hors UE). Opt-in, défaut désactivé. */
  coachAiEnabled: boolean;
}

/**
 * Résultat d'une écriture de consentement. supabase-js ne rejette PAS sur une
 * erreur RLS/contrainte : il renvoie `{ error }`. Ces setters l'inspectent et le
 * renvoient ici, pour que l'appelant puisse annuler l'état optimiste et le
 * signaler (ne jamais afficher « activé » si l'écriture a raté). `error` porte le
 * message brut Supabase (diagnostic) ; l'UI le traduit en texte pilote.
 *
 * Rétro-compatibilité : l'ancienne signature était `Promise<void>`. Un appelant
 * v1 (ex. Centre de consentement unifié) qui ignore ce retour reste valide.
 */
export interface ConsentWriteResult {
  ok: boolean;
  error?: string;
}

export async function loadAiConsents(userId: string): Promise<AiConsents> {
  const { data } = await supabase
    .from('users')
    .select('ai_debrief_enabled, coach_ai_enabled')
    .eq('id', userId)
    .maybeSingle();
  const row = data as {
    ai_debrief_enabled?: boolean | null;
    coach_ai_enabled?: boolean | null;
  } | null;
  return {
    aiDebriefEnabled: row?.ai_debrief_enabled !== false,
    coachAiEnabled: row?.coach_ai_enabled === true,
  };
}

export async function setAiDebriefConsent(
  userId: string,
  next: boolean
): Promise<ConsentWriteResult> {
  const { error } = await supabase
    .from('users')
    .update({ ai_debrief_enabled: next } as never)
    .eq('id', userId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function setCoachAiConsent(
  userId: string,
  next: boolean
): Promise<ConsentWriteResult> {
  const { error } = await supabase
    .from('users')
    .update({ coach_ai_enabled: next } as never)
    .eq('id', userId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ============================================================================
// Consentements BIOMÉTRIE (BE-1, MISSION A)
//
// Le modèle est DEUX colonnes timestamptz sur `users`, distinctes des booléens
// IA ci-dessus :
//   - biometry_capture_consent_at      : capter le cardio en séance (Polar/Watch)
//   - biometry_coach_share_consent_at  : partager ce cardio avec le coach binôme
// NULL = OFF ; une date = consentement horodaté (traçabilité RGPD) ; révocation
// = retour à NULL. Défaut OFF pour les deux (donnée de santé, opt-in strict).
//
// Garde-fou d'invariant : le partage coach IMPLIQUE la capture. On maintient donc
// « share non-null ⇒ capture non-null » dans les deux sens :
//   - révoquer la capture révoque aussi le partage (on ne partage pas ce qu'on
//     ne capte plus) ;
//   - activer le partage active la capture si elle ne l'était pas encore (sans
//     écraser une date de capture antérieure, qui reste la preuve d'origine).
//
// Comme le service IA voisin de ce fichier, les updates `users` conservent le
// cast `as never` : le helper `.update()` typé de supabase-js l'exige encore sur
// cette table (colonnes générées), à l'identique de setAiDebriefConsent ci-dessus.
// ============================================================================

export interface BiometryConsents {
  /** Capter le cardio en séance. false tant que la colonne est NULL. */
  capture: boolean;
  /** Partager le cardio avec le coach binôme. false tant que la colonne est NULL. */
  coachShare: boolean;
}

export async function loadBiometryConsents(userId: string): Promise<BiometryConsents> {
  const { data } = await supabase
    .from('users')
    .select('biometry_capture_consent_at, biometry_coach_share_consent_at')
    .eq('id', userId)
    .maybeSingle();
  const row = data as {
    biometry_capture_consent_at?: string | null;
    biometry_coach_share_consent_at?: string | null;
  } | null;
  return {
    capture: row?.biometry_capture_consent_at != null,
    coachShare: row?.biometry_coach_share_consent_at != null,
  };
}

/**
 * Active (next=true → now()) ou révoque (next=false → NULL) le consentement de
 * CAPTURE cardio. Révoquer la capture révoque aussi le partage coach (garde-fou
 * d'invariant : impossible de partager un cardio qu'on ne capte plus).
 */
export async function setBiometryCaptureConsent(
  userId: string,
  next: boolean
): Promise<ConsentWriteResult> {
  const patch: {
    biometry_capture_consent_at: string | null;
    biometry_coach_share_consent_at?: string | null;
  } = { biometry_capture_consent_at: next ? new Date().toISOString() : null };
  if (!next) {
    // Révocation en cascade du partage.
    patch.biometry_coach_share_consent_at = null;
  }
  const { error } = await supabase
    .from('users')
    .update(patch as never)
    .eq('id', userId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * Active (next=true → now()) ou révoque (next=false → NULL) le consentement de
 * PARTAGE coach. Activer le partage active la capture si elle était absente
 * (garde-fou d'invariant), sans écraser une date de capture déjà posée.
 */
export async function setBiometryCoachShareConsent(
  userId: string,
  next: boolean
): Promise<ConsentWriteResult> {
  if (!next) {
    const { error } = await supabase
      .from('users')
      .update({ biometry_coach_share_consent_at: null } as never)
      .eq('id', userId);
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  const nowIso = new Date().toISOString();
  const current = await loadBiometryConsents(userId);
  const patch: {
    biometry_coach_share_consent_at: string;
    biometry_capture_consent_at?: string;
  } = { biometry_coach_share_consent_at: nowIso };
  if (!current.capture) {
    // Le partage implique la capture : on la pose maintenant.
    patch.biometry_capture_consent_at = nowIso;
  }
  const { error } = await supabase
    .from('users')
    .update(patch as never)
    .eq('id', userId);
  return error ? { ok: false, error: error.message } : { ok: true };
}
