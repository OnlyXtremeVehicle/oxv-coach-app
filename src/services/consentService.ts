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
