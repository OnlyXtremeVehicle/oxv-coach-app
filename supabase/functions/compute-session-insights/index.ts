// @ts-nocheck — Deno runtime, pas Node
// Edge Function : compute-session-insights (moteur mirror-insights-v1, app-side 7 virages)
//
// Body : { sessionId: string }
// Calcule la ligne `session_insights` d'une session À PARTIR de l'analyse déjà
// persistée (app_segment_analyses + laps + comptage telemetry_frames), puis
// l'upsert. RLS : session_insights est en écriture service_role UNIQUEMENT
// (« service writes insights » ALL) ; cette fonction est donc le SEUL chemin
// d'écriture des insights — d'où une edge function et pas du code app.
//
// Doctrine / règle d'or (simple, conforme, non spéculatif) : on ne calcule que
// ce qui dérive proprement de l'analyse réelle — anatomy (apex, G latéral,
// distances frein/accel estimées), data_quality, et un ideal_lap minimal
// (meilleur tour réel, sans gain inventé). dispersion / chassis_balance /
// load_transfer exigent du multi-tours / gyro calé sur de vraies données →
// laissés VIDES (le tracé affiche un état vide honnête). La réconciliation avec
// le moteur serveur 13 virages est un calibrage post-Valence.
//
// Sécurité : verify_jwt = true (déclenché par l'app authentifiée, après l'analyse).
// Le miroir testable de la logique de calcul est src/services/sessionInsightsEngine.ts.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ENGINE_VERSION = 'mirror-insights-v1';
const G = 9.81;

function distanceBetweenSpeeds(vFromKmh: number, vToKmh: number, gAbs: number): number {
  if (!gAbs || gAbs <= 0) return 0;
  const vFrom = vFromKmh / 3.6;
  const vTo = vToKmh / 3.6;
  return Math.round(Math.abs(vFrom * vFrom - vTo * vTo) / (2 * gAbs * G));
}

function num(v: unknown, dflt = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : dflt;
}

Deno.serve(async (req: Request) => {
  try {
    const { sessionId } = await req.json();
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'sessionId requis' }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    const { data: session } = await supabase
      .from('telemetry_sessions')
      .select('id, user_id')
      .eq('id', sessionId)
      .maybeSingle();
    if (!session) {
      return new Response(JSON.stringify({ error: 'session_not_found' }), { status: 404 });
    }

    // 1) Segments analysés (1 segment = 1 virage), triés.
    const { data: segRows } = await supabase
      .from('app_segment_analyses')
      .select(
        'segment_index, apex_speed_kmh, entry_speed_kmh, min_speed_kmh, exit_speed_kmh, max_g_lateral, max_g_braking, max_g_accel, margin_percent'
      )
      .eq('telemetry_session_id', sessionId)
      .order('segment_index', { ascending: true });

    const anatomy = (segRows ?? []).map((s: Record<string, unknown>) => ({
      corner_index: num(s.segment_index),
      apex_speed_kmh: s.apex_speed_kmh != null ? Number(num(s.apex_speed_kmh).toFixed(1)) : 0,
      brake_dist_m: distanceBetweenSpeeds(
        num(s.entry_speed_kmh),
        num(s.min_speed_kmh),
        num(s.max_g_braking)
      ),
      accel_dist_m: distanceBetweenSpeeds(
        num(s.exit_speed_kmh),
        num(s.min_speed_kmh),
        num(s.max_g_accel)
      ),
      g_lat_apex: Number(num(s.max_g_lateral).toFixed(2)),
    }));

    // 2) Tours valides (hors out/in lap).
    const { data: lapRows } = await supabase
      .from('laps')
      .select('lap_number, duration_seconds, is_outlap, is_inlap')
      .eq('session_id', sessionId);

    const validLaps = (lapRows ?? [])
      .filter((l: Record<string, unknown>) => !l.is_outlap && !l.is_inlap)
      .map((l: Record<string, unknown>) => ({ n: num(l.lap_number), t: num(l.duration_seconds) }))
      .filter((l) => l.t > 0);

    let idealLap: Record<string, unknown> | null = null;
    if (validLaps.length > 0) {
      const best = validLaps.reduce((m, l) => (l.t < m.t ? l : m), validLaps[0]);
      idealLap = {
        ideal_time_s: Number(best.t.toFixed(3)),
        real_best_s: Number(best.t.toFixed(3)),
        gap_s: 0,
        best_lap: best.n,
        loss_by_sector_pct: [],
        worst_sector: 0,
      };
    }

    // 3) Comptage des trames (total + fix valide) — fiabilité.
    const { count: frameCount } = await supabase
      .from('telemetry_frames')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId);
    const { count: validCount } = await supabase
      .from('telemetry_frames')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .eq('fix_valid', true);

    const frames = Math.max(0, frameCount ?? 0);
    const valid = validCount != null ? Math.max(0, validCount) : frames;
    const pctValid = frames > 0 ? Math.round((valid / frames) * 100) : 0;

    const dataQuality = {
      frames_used: frames,
      frames_dropped: Math.max(0, frames - valid),
      pct_valid: pctValid,
      corners_detected: anatomy.length,
      laps_detected: validLaps.length,
    };

    const row = {
      telemetry_session_id: sessionId,
      user_id: session.user_id,
      engine_version: ENGINE_VERSION,
      computed_at: new Date().toISOString(),
      n_laps: validLaps.length,
      n_frames: frames,
      anatomy,
      dispersion: {},
      chassis_balance: {},
      load_transfer: {},
      ideal_lap: idealLap,
      data_quality: dataQuality,
    };

    // Une ligne d'insights par session : on remplace l'éventuelle précédente.
    await supabase.from('session_insights').delete().eq('telemetry_session_id', sessionId);
    const { error: insErr } = await supabase.from('session_insights').insert(row);
    if (insErr) {
      return new Response(JSON.stringify({ error: 'persist_failed', detail: insErr.message }), {
        status: 500,
      });
    }

    return new Response(
      JSON.stringify({ ok: true, sessionId, corners: anatomy.length, laps: validLaps.length, frames }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
