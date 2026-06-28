/**
 * Empreinte consolidée — persistance de la signature de pilotage (table
 * `pilot_signature_snapshots`, migration 0028). Reframe du « jumeau numérique ».
 *
 * On FIGE séance après séance les sorties DÉJÀ conformes de `computeSignature`
 * (bande de régularité, traits, axes) pour donner une MÉMOIRE au miroir et lire
 * une TENDANCE descriptive. Aucun score, aucune cible, aucune comparaison entre
 * pilotes. Own-row strict ; partage opt-in autonome par snapshot vers le coach.
 */

import { supabase } from '@/lib/supabase';
import { fetchSessionLaps } from '@/services/sessionsService';
import { listSegmentAnalysesForSession } from '@/services/segmentAnalysesService';
import {
  type SignatureAxis,
  type SignatureTrait,
  computeSignature,
} from '@/services/pilotSignatureService';

export interface SignatureSnapshot {
  id: string;
  sessionId: string | null;
  computedAt: string;
  regularityBand: string | null;
  traits: SignatureTrait[];
  axes: SignatureAxis[];
  turnSampleCount: number;
  sharedWithCoach: boolean;
}

const COLS =
  'id, session_id, computed_at, regularity_band, traits, axes, turn_sample_count, shared_with_coach';

function asTraits(v: unknown): SignatureTrait[] {
  return Array.isArray(v) ? (v as SignatureTrait[]) : [];
}
function asAxes(v: unknown): SignatureAxis[] {
  return Array.isArray(v) ? (v as SignatureAxis[]) : [];
}

function mapSnapshot(r: Record<string, unknown>): SignatureSnapshot {
  return {
    id: r.id as string,
    sessionId: (r.session_id as string | null) ?? null,
    computedAt: r.computed_at as string,
    regularityBand: (r.regularity_band as string | null) ?? null,
    traits: asTraits(r.traits),
    axes: asAxes(r.axes),
    turnSampleCount: Number(r.turn_sample_count ?? 0),
    sharedWithCoach: Boolean(r.shared_with_coach),
  };
}

export interface MutationResult {
  ok: boolean;
  id?: string;
  error?: string;
}

/**
 * Calcule la signature d'une séance et FIGE le snapshot (upsert : un seul par
 * séance source ; un recalcul met à jour en place et préserve le partage). Ne
 * fige que des sorties déjà conformes — aucun calcul de performance ajouté.
 */
export async function upsertSnapshotForSession(sessionId: string): Promise<MutationResult> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return { ok: false, error: 'Session expirée.' };

  const [segments, laps] = await Promise.all([
    listSegmentAnalysesForSession(sessionId),
    fetchSessionLaps(sessionId),
  ]);
  const lapTimesSeconds = laps
    .filter((l) => !l.is_outlap && !l.is_inlap && l.duration_seconds > 0)
    .map((l) => l.duration_seconds);

  const sig = computeSignature({
    segments: segments.map((s) => ({
      segmentIndex: s.segmentIndex,
      segmentName: s.segmentName,
      kind: s.kind,
      entrySpeedKmh: s.entrySpeedKmh,
      apexSpeedKmh: s.apexSpeedKmh,
      exitSpeedKmh: s.exitSpeedKmh,
      maxGLateral: s.maxGLateral,
      maxGBraking: s.maxGBraking,
      marginPercent: s.marginPercent,
    })),
    lapTimesSeconds,
  });

  // Pas de trait exploitable (séance sans donnée détaillée) → on ne fige rien.
  if (sig.traits.length === 0) return { ok: false, error: 'Pas de données exploitables.' };

  const regularityBand = sig.traits.find((t) => t.key === 'regularity')?.value ?? null;
  const payload = {
    regularity_band: regularityBand,
    traits: sig.traits as unknown,
    axes: sig.axes as unknown,
    turn_sample_count: sig.turnSampleCount,
    computed_at: new Date().toISOString(),
  };

  // Upsert manuel (l'index unique est partiel) : on préserve shared_with_coach.
  const { data: existing } = await supabase
    .from('pilot_signature_snapshots')
    .select('id')
    .eq('user_id', uid)
    .eq('session_id', sessionId)
    .maybeSingle();

  if (existing && (existing as { id: string }).id) {
    const id = (existing as { id: string }).id;
    const { error } = await supabase
      .from('pilot_signature_snapshots')
      .update(payload as never)
      .eq('id', id);
    return error ? { ok: false, error: error.message } : { ok: true, id };
  }

  const { data, error } = await supabase
    .from('pilot_signature_snapshots')
    .insert({ user_id: uid, session_id: sessionId, ...payload } as never)
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Enregistrement impossible.' };
  return { ok: true, id: (data as { id: string }).id };
}

/** Mes empreintes (RLS own-row), de la plus récente à la plus ancienne. */
export async function listMySnapshots(limit = 10): Promise<SignatureSnapshot[]> {
  const { data, error } = await supabase
    .from('pilot_signature_snapshots')
    .select(COLS)
    .order('computed_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[OXV][empreinte] listMySnapshots :', error.message);
    return [];
  }
  return (data ?? []).map((r) => mapSnapshot(r as Record<string, unknown>));
}

/** Partage / retire le partage d'une empreinte avec le coach (révocable). */
export async function setSnapshotShared(id: string, shared: boolean): Promise<MutationResult> {
  const { error } = await supabase
    .from('pilot_signature_snapshots')
    .update({ shared_with_coach: shared } as never)
    .eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true, id };
}

/**
 * Vue COACH (lecture seule) : les empreintes qu'un pilote suivi a explicitement
 * partagées. La RLS garantit shared_with_coach=true ET coach consenti. L'accès
 * est journalisé (log_coach_view) pour la conformité RGPD.
 */
export async function listSharedSnapshotsForPilot(pilotId: string): Promise<SignatureSnapshot[]> {
  const { data, error } = await supabase
    .from('pilot_signature_snapshots')
    .select(COLS)
    .eq('user_id', pilotId)
    .eq('shared_with_coach', true)
    .order('computed_at', { ascending: false });
  if (error) {
    console.warn('[OXV][empreinte] listSharedSnapshotsForPilot :', error.message);
    return [];
  }
  const snapshots = (data ?? []).map((r) => mapSnapshot(r as Record<string, unknown>));
  if (snapshots.length > 0) {
    await supabase
      .rpc('log_coach_view', { target_pilot_uuid: pilotId, action_subtype: 'empreinte_view' })
      .then(
        () => undefined,
        () => undefined
      );
  }
  return snapshots;
}
