/**
 * Waivers — service (P3, décharge e-sign). Décisions fondateur 2026-07-12 :
 * signature SIMPLE, timing À LA RÉSERVATION, périmètre PILOTE. Écrit une trace
 * IMMUABLE (RLS : le pilote lit/crée les siennes, jamais update/delete) scellée
 * par l'empreinte du texte signé (LEGAL_DOCUMENTS.decharge.hash, calculée au
 * build — pas de crypto runtime). Le pilote reste seul responsable de sa
 * déclaration ; l'app horodate et conserve la preuve.
 *
 * ⚠ Gaté par le flag `pilot_waivers` (OFF) jusqu'à relecture du texte par un
 *   avocat. Rien de légalement effectif n'est présenté tant que le flag est OFF.
 */

import * as Application from 'expo-application';
import { Platform } from 'react-native';

import { LEGAL_DOCUMENTS } from '@/legal/legalDocuments';
import { supabase } from '@/lib/supabase';
import { isFlagEnabled } from '@/services/featureFlagsService';
import { isValidSignerName, type WaiverSignatureLite } from '@/services/waiverLogic';
import { useAuthStore } from '@/store/useAuthStore';

const WAIVER_SLUG = 'decharge';
/** Version en vigueur, DÉRIVÉE de l'en-tête du document (bouge avec l'empreinte). */
export const WAIVER_VERSION = LEGAL_DOCUMENTS[WAIVER_SLUG]?.version ?? '0.1';

export interface WaiverSignature extends WaiverSignatureLite {
  id: string;
  signedAt: string;
  signedFullName: string;
  sessionId: string | null;
}

interface WaiverRow {
  id: string;
  waiver_version: string;
  booking_id: string | null;
  session_id: string | null;
  signed_full_name: string;
  signed_at: string;
}

function mapRow(r: WaiverRow): WaiverSignature {
  return {
    id: r.id,
    waiverVersion: r.waiver_version,
    bookingId: r.booking_id ?? null,
    sessionId: r.session_id ?? null,
    signedFullName: r.signed_full_name,
    signedAt: r.signed_at,
  };
}

/**
 * Enregistre la signature de la décharge par le pilote courant. Best-effort :
 * une erreur réseau renvoie `ok:false` (le pilote pourra re-signer) — pas de file
 * offline ici, la signature se fait dans un contexte connecté (réservation).
 */
export async function acceptWaiver(input: {
  fullName: string;
  bookingId?: string | null;
  sessionId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return { ok: false, error: 'not_authenticated' };

  // Défense en profondeur : rien de signable tant que le flag est OFF (texte non
  // relu par un avocat), même via un appel hors de l'écran gardé.
  if (!(await isFlagEnabled('pilot_waivers'))) return { ok: false, error: 'waivers_disabled' };

  const name = input.fullName.trim();
  if (!isValidSignerName(name)) return { ok: false, error: 'invalid_name' };

  const doc = LEGAL_DOCUMENTS[WAIVER_SLUG];
  if (!doc) return { ok: false, error: 'waiver_text_missing' };

  const { error } = await supabase.from('pilot_waiver_signatures').insert({
    user_id: userId,
    booking_id: input.bookingId ?? null,
    session_id: input.sessionId ?? null,
    waiver_version: WAIVER_VERSION,
    document_hash: doc.hash,
    signed_full_name: name,
    app_version: Application.nativeApplicationVersion ?? null,
    user_agent: `${Platform.OS} ${String(Platform.Version)}`,
  });

  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Signatures du pilote courant (les siennes, RLS), plus récentes d'abord. */
export async function listMyWaivers(): Promise<WaiverSignature[]> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return [];
  const { data } = await supabase
    .from('pilot_waiver_signatures')
    .select('id, waiver_version, booking_id, session_id, signed_full_name, signed_at')
    .eq('user_id', userId)
    .order('signed_at', { ascending: false });
  return ((data as unknown as WaiverRow[] | null) ?? []).map(mapRow);
}
