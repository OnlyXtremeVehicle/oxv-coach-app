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
 */

import { supabase } from '@/lib/supabase';

export interface AiConsents {
  /** Débrief J+1 rédigé par IA (hors UE). Opt-out, défaut activé. */
  aiDebriefEnabled: boolean;
  /** Assistant IA du coach sur vos données (hors UE). Opt-in, défaut désactivé. */
  coachAiEnabled: boolean;
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

export async function setAiDebriefConsent(userId: string, next: boolean): Promise<void> {
  await supabase
    .from('users')
    .update({ ai_debrief_enabled: next } as never)
    .eq('id', userId);
}

export async function setCoachAiConsent(userId: string, next: boolean): Promise<void> {
  await supabase
    .from('users')
    .update({ coach_ai_enabled: next } as never)
    .eq('id', userId);
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
export async function setBiometryCaptureConsent(userId: string, next: boolean): Promise<void> {
  const patch: {
    biometry_capture_consent_at: string | null;
    biometry_coach_share_consent_at?: string | null;
  } = { biometry_capture_consent_at: next ? new Date().toISOString() : null };
  if (!next) {
    // Révocation en cascade du partage.
    patch.biometry_coach_share_consent_at = null;
  }
  await supabase
    .from('users')
    .update(patch as never)
    .eq('id', userId);
}

/**
 * Active (next=true → now()) ou révoque (next=false → NULL) le consentement de
 * PARTAGE coach. Activer le partage active la capture si elle était absente
 * (garde-fou d'invariant), sans écraser une date de capture déjà posée.
 */
export async function setBiometryCoachShareConsent(userId: string, next: boolean): Promise<void> {
  if (!next) {
    await supabase
      .from('users')
      .update({ biometry_coach_share_consent_at: null } as never)
      .eq('id', userId);
    return;
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
  await supabase
    .from('users')
    .update(patch as never)
    .eq('id', userId);
}
