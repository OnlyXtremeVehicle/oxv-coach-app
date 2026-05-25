// @ts-nocheck — Deno runtime, pas Node
// Edge Function : cron-analyze-pending-sessions
//
// Balaye les telemetry_sessions completed sans analyse persistée et
// déclenche le calcul côté serveur (marge globale + zone). Rattrape
// les cas où l'app pilote a été tuée avant que analyzeAndPersistSession
// n'ait fini (Q37 sem 13).
//
// Important : NE PAS faire l'analyse trackviz par segment ici (parser
// UBX serait lourd à porter Deno). On fait juste la marge globale
// minimale via les laps. L'analyse complète se fera à la prochaine
// ouverture de l'app par le pilote.
//
// Schédulage : appelé par pg_cron toutes les heures (à configurer
// manuellement côté Supabase Dashboard → Database → Cron Jobs).
// SELECT cron.schedule('analyze-pending', '0 * * * *',
//   $$ SELECT net.http_post(
//     url := 'https://fouvuqkdxarjpjbqnsjq.supabase.co/functions/v1/cron-analyze-pending-sessions',
//     headers := jsonb_build_object('Content-Type', 'application/json')
//   ); $$);
//
// verify_jwt = false : appelable sans auth (cron + admin manuel).
// Mais on vérifie un secret header X-Cron-Token pour bloquer le public.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const MAX_SESSIONS_PER_RUN = 50;
const REGULARITY_WEIGHT = 0.6;
const SMOOTHNESS_WEIGHT = 0.4;
const VEHICLE_WEIGHT = 0.4;
const PILOT_WEIGHT = 0.6;
const DEFAULT_VEHICLE_G_LAT = 1.0;

function clampMargin(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, x));
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function computeRegularity(lapSeconds: number[]): number {
  return clampMargin(100 - Math.max(0, stddev(lapSeconds) - 1) * 25);
}

function computeSmoothness(gLats: number[]): number {
  return clampMargin(100 - Math.max(0, stddev(gLats) - 0.05) * 200);
}

function marginZoneOf(p: number): 'green' | 'yellow' | 'red' {
  if (p >= 30) return 'green';
  if (p >= 15) return 'yellow';
  return 'red';
}

Deno.serve(async (req: Request) => {
  try {
    // Optional security : check X-Cron-Token if present
    const expectedToken = Deno.env.get('CRON_TOKEN');
    if (expectedToken) {
      const got = req.headers.get('X-Cron-Token');
      if (got !== expectedToken) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
      }
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    // Sessions completed sans analyse persistée
    const { data: pending, error } = await supabase
      .from('telemetry_sessions')
      .select('id, user_id, max_g_lateral')
      .eq('status', 'completed')
      .not(
        'id',
        'in',
        `(SELECT telemetry_session_id FROM app_session_analyses WHERE margin_global IS NOT NULL)`
      )
      .limit(MAX_SESSIONS_PER_RUN);

    if (error) {
      // Fallback : si la sous-requête ne marche pas (RLS limit ou autre),
      // on fait 2 requêtes séparées
      const { data: allCompleted } = await supabase
        .from('telemetry_sessions')
        .select('id, user_id, max_g_lateral')
        .eq('status', 'completed')
        .limit(MAX_SESSIONS_PER_RUN * 4);
      const { data: existingAnalyses } = await supabase
        .from('app_session_analyses')
        .select('telemetry_session_id')
        .not('margin_global', 'is', null);
      const analyzedIds = new Set(
        (existingAnalyses ?? []).map((r: { telemetry_session_id: string }) => r.telemetry_session_id)
      );
      const filtered = (allCompleted ?? []).filter((s: { id: string }) => !analyzedIds.has(s.id));
      return processSessions(supabase, filtered.slice(0, MAX_SESSIONS_PER_RUN));
    }

    return processSessions(supabase, pending ?? []);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});

// deno-lint-ignore no-explicit-any
async function processSessions(supabase: any, sessions: any[]) {
  const results: { sessionId: string; ok: boolean; marginGlobal?: number; error?: string }[] = [];

  for (const session of sessions) {
    try {
      // Compute véhicule margin (G_lat observé vs seuil)
      const observedG = Number(session.max_g_lateral ?? 0);
      const vehicleMargin =
        observedG > 0
          ? clampMargin((1 - observedG / DEFAULT_VEHICLE_G_LAT) * 100)
          : 100;

      // Récupérer les laps valides (hors outlap/inlap)
      const { data: laps } = await supabase
        .from('laps')
        .select('duration_seconds, max_g_lateral, is_outlap, is_inlap')
        .eq('session_id', session.id);
      const validLaps = ((laps ?? []) as Array<{
        duration_seconds: number;
        max_g_lateral: number | null;
        is_outlap: boolean;
        is_inlap: boolean;
      }>).filter(
        (l) => !l.is_outlap && !l.is_inlap && l.duration_seconds > 0
      );

      let pilotMargin = 100;
      let regularity = 100;
      let smoothness = 100;
      if (validLaps.length >= 2) {
        regularity = computeRegularity(validLaps.map((l) => l.duration_seconds));
        smoothness = computeSmoothness(validLaps.map((l) => Number(l.max_g_lateral ?? 0)));
        pilotMargin = clampMargin(REGULARITY_WEIGHT * regularity + SMOOTHNESS_WEIGHT * smoothness);
      }

      const marginGlobal = clampMargin(
        VEHICLE_WEIGHT * vehicleMargin + PILOT_WEIGHT * pilotMargin
      );
      const zone = marginZoneOf(marginGlobal);

      // Upsert
      const { error: upsertErr } = await supabase.from('app_session_analyses').upsert(
        {
          telemetry_session_id: session.id,
          user_id: session.user_id,
          margin_global: marginGlobal,
          margin_zone: zone,
          margin_vehicle: vehicleMargin,
          margin_pilot: pilotMargin,
          margin_breakdown: {
            vehicle: vehicleMargin,
            pilot: pilotMargin,
            regularity,
            smoothness,
          },
          algo_version: 'cron-v1.0',
          computed_at: new Date().toISOString(),
        },
        { onConflict: 'telemetry_session_id' }
      );

      if (upsertErr) {
        results.push({ sessionId: session.id, ok: false, error: upsertErr.message });
      } else {
        results.push({ sessionId: session.id, ok: true, marginGlobal });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ sessionId: session.id, ok: false, error: msg });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  return new Response(
    JSON.stringify({
      ok: true,
      processed: results.length,
      successful: okCount,
      failed: results.length - okCount,
      results,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
