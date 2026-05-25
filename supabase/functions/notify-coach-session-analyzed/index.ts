// @ts-nocheck — Deno runtime, pas Node
/**
 * Edge Function — notify-coach-session-analyzed
 *
 * Envoie une push notification Expo à TOUS les coachs actifs+consentis
 * d'un pilote quand une nouvelle analyse de session est complétée
 * (insertion dans `app_session_analyses`).
 *
 * Déclenchée par le trigger Postgres `app_session_analyses_after_insert`
 * (migration 0022) qui appelle cette fonction via pg_net.
 *
 * Doctrine OXV :
 *   - Titre sobre : « Nouveau bilan de {prénom pilote} »
 *   - Corps : « {circuit} · marge {X} % »
 *   - Deep-link : /(coach)/pilote/[pilotId] pour ouvrir le détail
 *
 * Symétrique de notify-pilot-coach-annotated (PR-J).
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface Payload {
  analysis_id: string;
  telemetry_session_id: string;
  pilot_id: string;
  margin_global: number | null;
  margin_zone: 'green' | 'yellow' | 'red' | null;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const payload: Payload = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      console.error('[notify-coach-session-analyzed] env manquant');
      return new Response('Server misconfigured', { status: 500 });
    }
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Récupère le pilote (prénom + circuit de la session)
    const { data: pilot } = await supabase
      .from('users')
      .select('first_name, last_name')
      .eq('id', payload.pilot_id)
      .maybeSingle();

    const { data: session } = await supabase
      .from('telemetry_sessions')
      .select('circuit_name')
      .eq('id', payload.telemetry_session_id)
      .maybeSingle();

    const pilotName =
      [pilot?.first_name, pilot?.last_name].filter(Boolean).join(' ') || 'votre pilote';
    const circuit = session?.circuit_name ?? 'Circuit';

    // 2. Récupère tous les coachs actifs+consentis du pilote, avec leurs push tokens
    const { data: assignments } = await supabase
      .from('coach_pilots')
      .select('coach_id, users!coach_pilots_coach_id_fkey(expo_push_token)')
      .eq('pilot_id', payload.pilot_id)
      .eq('active', true)
      .not('pilot_consent_at', 'is', null);

    if (!assignments || assignments.length === 0) {
      return new Response(JSON.stringify({ skipped: 'no_coaches' }), { status: 200 });
    }

    // 3. Filtre les coachs qui ont un push token
    const recipients = (assignments as Array<{ coach_id: string; users: { expo_push_token: string | null } | null }>)
      .map((a) => ({ coachId: a.coach_id, token: a.users?.expo_push_token }))
      .filter((r): r is { coachId: string; token: string } => Boolean(r.token));

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ skipped: 'no_tokens' }), { status: 200 });
    }

    // 4. Prépare et envoie les notifs (Expo supporte un array de messages)
    const marginText =
      payload.margin_global !== null ? ` · marge ${Math.round(payload.margin_global)} %` : '';

    const messages = recipients.map((r) => ({
      to: r.token,
      sound: 'default' as const,
      title: `Nouveau bilan de ${pilotName}`,
      body: `${circuit}${marginText}`,
      data: {
        type: 'session_analyzed',
        pilotId: payload.pilot_id,
        sessionId: payload.telemetry_session_id,
        analysisId: payload.analysis_id,
      },
      categoryId: 'coach_alert',
      channelId: 'coach',
    }));

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn('[notify-coach-session-analyzed] Expo push fail :', response.status, text);
      return new Response(JSON.stringify({ ok: false, status: response.status }), {
        status: 502,
      });
    }

    const result = await response.json();
    return new Response(
      JSON.stringify({ ok: true, recipient_count: recipients.length, expo: result }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[notify-coach-session-analyzed] error :', message);
    return new Response(JSON.stringify({ ok: false, error: message }), { status: 500 });
  }
});
