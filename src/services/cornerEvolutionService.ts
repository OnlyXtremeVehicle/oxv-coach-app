/**
 * Service évolution de virage (L3 DATA) — loader fin SELECT-only qui alimente
 * le cœur pur `buildCornerEvolution`.
 *
 * SELF-ONLY : ne lit que des frames du pilote courant via `loadLapFrames`
 * (lecteur self-only) et l'horodatage de ses propres séances. Aucun accès
 * coach, aucun passage d'un autre pilote.
 *
 * DONNÉES RÉELLES : une panne DB sur la résolution des horodatages REMONTE en
 * erreur (pas d'ordre inventé). Les passages sans forme exploitable sont
 * écartés par le cœur pur.
 *
 * La logique vit dans `cornerEvolutionLogic.ts` (pur, testé), ré-exportée ici.
 */

import { supabase } from '@/lib/supabase';
import {
  buildCornerEvolution,
  type CornerEvolution,
  type CornerPassInput,
  type CornerWindow,
} from '@/services/cornerEvolutionLogic';
import { loadLapFrames } from '@/services/sessionTelemetryService';

export {
  buildCornerEvolution,
  sliceAndNormalize,
  DEFAULT_MAX_PASSES,
  type CornerEvolution,
  type CornerPass,
  type CornerPassInput,
  type CornerPassPoint,
  type CornerWindow,
} from '@/services/cornerEvolutionLogic';

/**
 * Charge et superpose les traces d'un même virage sur plusieurs séances du
 * pilote.
 *
 * @param sessionIds          séances à superposer (self-only).
 * @param lapNumberBySession  tour retenu pour chaque séance.
 * @param corner              fenêtre de progression du virage [0..1].
 * @param opts.maxPasses      nombre de passages superposés (défaut 5).
 */
export async function loadCornerEvolution(
  sessionIds: string[],
  lapNumberBySession: Record<string, number>,
  corner: CornerWindow,
  opts?: { maxPasses?: number }
): Promise<CornerEvolution> {
  if (sessionIds.length === 0) return { passes: [] };

  // Horodatages réels des séances (pour l'ordre antéchronologique). SELECT-only.
  const { data, error } = await supabase
    .from('telemetry_sessions')
    .select('id, started_at')
    .in('id', sessionIds);

  if (error) throw new Error(error.message);

  const startedAtById = new Map<string, string>();
  for (const row of (data ?? []) as { id: string; started_at: string }[]) {
    startedAtById.set(row.id, row.started_at);
  }

  const passes: CornerPassInput[] = [];
  for (const sessionId of sessionIds) {
    const lapNumber = lapNumberBySession[sessionId];
    const startedAt = startedAtById.get(sessionId);
    // Sans tour ciblé ou sans horodatage, le passage n'est ni chargeable ni
    // ordonnable : on l'écarte plutôt que d'inventer une position.
    if (lapNumber === undefined || startedAt === undefined) continue;

    const frames = await loadLapFrames(sessionId, lapNumber);
    passes.push({ sessionId, startedAt, frames });
  }

  return buildCornerEvolution(passes, corner, opts);
}
