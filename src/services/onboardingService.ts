/**
 * Persistance de l'onboarding pilote.
 *
 * Chaque action onboarding (niveau pilote, acceptation CGU/RGPD/Pacte,
 * complétion finale) écrit dans `users` côté Supabase. En cas de réseau
 * absent, l'action est enqueue dans `offlineQueue` pour rejouage à la
 * reconnexion (cf. doctrine offline-first).
 *
 * Toutes les actions sont **idempotentes** — rejouer la même acceptation
 * ne crée pas de doublon, juste un overwrite (write-through MMKV + DB).
 */

import { supabase } from '@/lib/supabase';
import { OxvEvent } from '@/services/analyticsEvents';
import { enqueueAction } from '@/services/offlineQueue';
import { useAuthStore } from '@/store/useAuthStore';

export const PACT_VERSION = '1.0';
export const COACH_PACT_VERSION = '1.0';
export const CGU_VERSION = '1.0';
export const PRIVACY_VERSION = '1.0';

export type PilotLevelChoice = 'debutant' | 'intermediaire' | 'confirme' | 'expert';

export async function setPilotLevel(level: PilotLevelChoice): Promise<boolean> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return false;

  const { error } = await supabase.from('users').update({ pilot_level: level }).eq('id', userId);

  if (error) {
    enqueueAction({
      kind: 'update_pilot_level',
      payload: { userId, level },
    });
    console.warn('[OXV] setPilotLevel offline-queued :', error.message);
    return false;
  }
  await useAuthStore.getState().refreshProfile();
  return true;
}

/**
 * Enregistre l'acceptation CGU/confidentialité + le consentement (opt-in
 * EXPLICITE) au débrief enrichi par IA. `aiDebriefConsent=false` par défaut :
 * aucun transfert vers OpenAI (US) tant que le pilote ne l'a pas autorisé ici.
 * Désactivable/réactivable ensuite dans les réglages.
 */
export async function acceptCguAndPrivacy(aiDebriefConsent = false): Promise<boolean> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return false;

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('users')
    .update({
      cgu_accepted_at: now,
      cgu_version: CGU_VERSION,
      privacy_accepted_at: now,
      privacy_version: PRIVACY_VERSION,
      ai_debrief_enabled: aiDebriefConsent,
    })
    .eq('id', userId);

  if (error) {
    enqueueAction({
      kind: 'accept_cgu_privacy',
      payload: { userId, cguVersion: CGU_VERSION, privacyVersion: PRIVACY_VERSION },
    });
    console.warn('[OXV] acceptCguAndPrivacy offline-queued :', error.message);
    return false;
  }
  await useAuthStore.getState().refreshProfile();
  return true;
}

export async function acceptPact(): Promise<boolean> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return false;

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('users')
    .update({
      pact_accepted_at: now,
      pact_version: PACT_VERSION,
    })
    .eq('id', userId);

  if (error) {
    enqueueAction({
      kind: 'accept_pact',
      payload: { userId, pactVersion: PACT_VERSION },
    });
    console.warn('[OXV] acceptPact offline-queued :', error.message);
    return false;
  }
  await useAuthStore.getState().refreshProfile();
  return true;
}

/**
 * Acceptation du Pacte de coaching (pour les users role='coach').
 * Distinct de acceptPact() qui est le Pacte de pilotage.
 */
export async function acceptCoachPact(): Promise<boolean> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return false;

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('users')
    .update({
      coach_pact_accepted_at: now,
      coach_pact_version: COACH_PACT_VERSION,
    })
    .eq('id', userId);

  if (error) {
    enqueueAction({
      kind: 'accept_coach_pact',
      payload: { userId, coachPactVersion: COACH_PACT_VERSION },
    });
    console.warn('[OXV] acceptCoachPact offline-queued :', error.message);
    return false;
  }
  await useAuthStore.getState().refreshProfile();
  return true;
}

/**
 * Marque l'onboarding comme terminé. Appelé à la fin du flux #06 après
 * acceptation du Pacte. À partir de là, le routeur app/index.tsx redirige
 * vers `(app)/` plutôt que `(onboarding)/`.
 */
export async function completeOnboarding(): Promise<boolean> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return false;

  const { error } = await supabase
    .from('users')
    .update({ profile_completed_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    console.warn('[OXV] completeOnboarding échec :', error.message);
    return false;
  }
  await useAuthStore.getState().refreshProfile();
  OxvEvent.onboardingTermine(); // KPI activation_pilote (§27)
  return true;
}

/**
 * Indique si l'utilisateur a tout signé et peut entrer dans l'app.
 * Le pacte requis dépend du rôle : pilote signe pact_accepted_at,
 * coach signe coach_pact_accepted_at.
 */
export function isOnboardingComplete(profile: {
  profile_completed_at: string | null;
  pact_accepted_at: string | null;
  coach_pact_accepted_at?: string | null;
  cgu_accepted_at: string | null;
  role?: 'pilot' | 'admin' | 'coach' | 'partner' | 'pro_pilot';
}): boolean {
  const baseSigned = Boolean(profile.profile_completed_at && profile.cgu_accepted_at);
  if (!baseSigned) return false;

  // Coach signe le pacte de coaching, pas le pacte de pilotage
  if (profile.role === 'coach') {
    return Boolean(profile.coach_pact_accepted_at);
  }
  // Pilote (et admin par défaut) signe le pacte de pilotage
  return Boolean(profile.pact_accepted_at);
}
