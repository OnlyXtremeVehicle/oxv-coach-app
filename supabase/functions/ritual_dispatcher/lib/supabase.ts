// =============================================================================
// lib/supabase.ts — Client Supabase pour l'Edge Function
// =============================================================================
// Utilise le service_role pour bypasser RLS (cette function tourne côté serveur
// et doit lire/écrire toutes les tables sans contrainte d'utilisateur).
// =============================================================================

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans les variables d\'environnement');
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedClient;
}

// -----------------------------------------------------------------------------
// Helpers de lecture
// -----------------------------------------------------------------------------

export interface DispatchRow {
  id: string;
  registration_id: string;
  user_id: string;
  session_id: string;
  ritual_type: 'jminus7' | 'jminus2' | 'jminus1';
  status: 'pending' | 'generating' | 'sent' | 'failed' | 'skipped';
  scheduled_for: string;
  attempt_count: number;
}

export interface DispatchContext {
  dispatch: DispatchRow;
  pilot: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    ritual_jminus7_enabled: boolean;
    ritual_jminus2_enabled: boolean;
    ritual_jminus1_enabled: boolean;
    /**
     * Consentement au traitement par IA — LA MÊME PORTE QUE LE DÉBRIEF.
     *
     * La politique de confidentialité affichée au pilote dit : « vous pouvez
     * désactiver le debrief assisté par IA dans vos paramètres. AUCUNE DONNÉE
     * ne sera alors transmise à ce prestataire américain ».
     *
     * Ce dispatcher ne lisait pas cette colonne. Le rituel J-2 envoyait donc le
     * prénom du pilote, la marque et le modèle de son véhicule et l'historique
     * de ses séances à OpenAI, puis le texte à ElevenLabs — pour un pilote qui
     * avait coupé l'IA dans ses réglages. La promesse d'absence TOTALE de
     * transfert était fausse par une seconde porte que le réglage ne fermait
     * pas.
     */
    ai_debrief_enabled: boolean | null;
  };
  session: {
    id: string;
    session_date: string;         // ISO date "2026-06-09"
    session_format: string;       // "Access", "Signature", etc.
  };
  registration: {
    id: string;
    ref: string;                  // "OXV-A4F92B11"
  };
  vehicle: {
    make: string;
    model: string;
    year: number | null;
  };
}

/**
 * Récupère les dispatches en attente arrivés à échéance.
 * Limité à 20 par batch pour éviter les timeouts (60s sur le plan Free).
 */
export async function fetchPendingDispatches(limit = 20): Promise<DispatchRow[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('ritual_dispatches')
    .select('id, registration_id, user_id, session_id, ritual_type, status, scheduled_for, attempt_count')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(limit);

  if (error) throw new Error(`Erreur lecture pending dispatches: ${error.message}`);
  return (data ?? []) as DispatchRow[];
}

/**
 * Verrouille un dispatch en passant son status à 'generating'.
 * Retourne true si le verrou a été pris, false si quelqu'un d'autre était plus rapide.
 * IMPORTANT : c'est un UPDATE conditionnel — si le status n'est plus 'pending'
 * (autre instance en cours), la mise à jour retourne 0 ligne et on saute ce dispatch.
 */
export async function lockDispatch(dispatchId: string): Promise<boolean> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('ritual_dispatches')
    .update({
      status: 'generating',
      last_attempt_at: new Date().toISOString(),
      attempt_count: 1, // sera incrémenté plus correctement via RPC si besoin
    })
    .eq('id', dispatchId)
    .eq('status', 'pending') // condition de verrou : seul un 'pending' peut devenir 'generating'
    .select('id');

  if (error) throw new Error(`Erreur verrouillage dispatch: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

/**
 * Récupère tout le contexte (pilote, session, registration, véhicule) nécessaire
 * aux handlers à partir d'un dispatch row.
 */
export async function loadDispatchContext(dispatch: DispatchRow): Promise<DispatchContext> {
  const supabase = getSupabaseClient();

  // Charge pilote
  const { data: pilot, error: pilotErr } = await supabase
    .from('users')
    .select(
      'id, first_name, last_name, email, ritual_jminus7_enabled, ritual_jminus2_enabled, ritual_jminus1_enabled, ai_debrief_enabled'
    )
    .eq('id', dispatch.user_id)
    .single();
  if (pilotErr || !pilot) throw new Error(`Pilote ${dispatch.user_id} introuvable: ${pilotErr?.message}`);

  // Charge session — schéma OXV : colonnes "date" et "format"
  // On lit les vraies colonnes et on remappe en JS pour éviter les surprises
  // avec les alias PostgREST.
  const { data: sessionRaw, error: sessionErr } = await supabase
    .from('sessions')
    .select('id, date, format')
    .eq('id', dispatch.session_id)
    .single();
  if (sessionErr || !sessionRaw) throw new Error(`Session ${dispatch.session_id} introuvable: ${sessionErr?.message}`);

  const session = {
    id: sessionRaw.id as string,
    session_date: sessionRaw.date as string,
    session_format: sessionRaw.format as string,
  };

  // Charge registration — pas de colonne "ref" → on génère un ID lisible.
  const { data: registration, error: regErr } = await supabase
    .from('registrations')
    .select('id, vehicle_id')
    .eq('id', dispatch.registration_id)
    .single();
  if (regErr || !registration) throw new Error(`Registration ${dispatch.registration_id} introuvable: ${regErr?.message}`);

  // Charge véhicule — schéma OXV : colonne "brand" (pas "make")
  let vehicle = { make: 'voiture', model: '', year: null as number | null };
  if (registration.vehicle_id) {
    const { data: v } = await supabase
      .from('vehicles')
      .select('brand, model, year')
      .eq('id', registration.vehicle_id)
      .single();
    if (v) vehicle = {
      make: (v.brand as string) ?? 'voiture',
      model: (v.model as string) ?? '',
      year: (v.year as number | null) ?? null,
    };
  }

  return {
    dispatch,
    pilot,
    session,
    registration: { id: registration.id, ref: `OXV-${registration.id.slice(0, 8).toUpperCase()}` },
    vehicle,
  };
}

// -----------------------------------------------------------------------------
// Helpers de mise à jour finale
// -----------------------------------------------------------------------------

export interface DispatchSuccessUpdate {
  payload: Record<string, unknown>;
  resend_message_id?: string;
  audio_storage_path?: string;
  audio_duration_sec?: number;
  openai_tokens_used?: number;
  elevenlabs_chars?: number;
}

export async function markDispatchSent(dispatchId: string, update: DispatchSuccessUpdate): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('ritual_dispatches')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      ...update,
    })
    .eq('id', dispatchId);
  if (error) throw new Error(`Erreur markDispatchSent: ${error.message}`);
}

export async function markDispatchFailed(dispatchId: string, errorMsg: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('ritual_dispatches')
    .update({
      status: 'failed',
      last_error: errorMsg.slice(0, 1000),
    })
    .eq('id', dispatchId);
  if (error) console.error(`Erreur markDispatchFailed: ${error.message}`);
  // On ne throw pas ici — si on échoue à marquer failed, on log seulement.
}

export async function markDispatchSkipped(dispatchId: string, reason: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('ritual_dispatches')
    .update({ status: 'skipped', last_error: reason.slice(0, 500) })
    .eq('id', dispatchId);
  if (error) console.error(`Erreur markDispatchSkipped: ${error.message}`);
}

// -----------------------------------------------------------------------------
// Upload de l'audio MP3 dans le bucket audio_briefings
// -----------------------------------------------------------------------------

/**
 * Upload le MP3 dans Storage et retourne un objet { path, signedUrl }.
 * Le path suit le pattern `{user_id}/{dispatch_id}.mp3` pour un nettoyage facile.
 * L'URL signée est valable 7 jours.
 */
export async function uploadAudioFile(
  dispatchId: string,
  userId: string,
  audioBuffer: ArrayBuffer
): Promise<{ path: string; signedUrl: string }> {
  const supabase = getSupabaseClient();
  const path = `${userId}/${dispatchId}.mp3`;

  const { error: uploadErr } = await supabase.storage
    .from('audio_briefings')
    .upload(path, audioBuffer, {
      contentType: 'audio/mpeg',
      upsert: true,
    });
  if (uploadErr) throw new Error(`Erreur upload audio: ${uploadErr.message}`);

  // URL signée 7 jours = 604 800 secondes
  const { data: signed, error: signedErr } = await supabase.storage
    .from('audio_briefings')
    .createSignedUrl(path, 604_800);
  if (signedErr || !signed) throw new Error(`Erreur création URL signée: ${signedErr?.message}`);

  return { path, signedUrl: signed.signedUrl };
}
