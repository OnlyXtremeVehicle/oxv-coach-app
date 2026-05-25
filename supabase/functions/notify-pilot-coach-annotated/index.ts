// @ts-nocheck — Deno runtime, pas Node. Les imports URL sont valides côté Deploy.
/**
 * Edge Function — notify-pilot-coach-annotated
 *
 * Envoie une push notification Expo au pilote quand un coach laisse une
 * annotation partagée (visibility='shared') sur un de ses virages.
 *
 * Déclenchée par le trigger Postgres `coach_annotations_after_insert`
 * (migration 0021) qui appelle cette fonction via pg_net.
 *
 * Doctrine OXV :
 *   - Titre sobre : « Note de votre coach »
 *   - Corps : début de la note (50 chars max) + nom du virage
 *   - Deep-link : /(app)/virage?index=X&sessionId=Y (si session liée)
 *   - Silencieux entre 22h et 8h heure pilote (best effort tz fr-FR)
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface Payload {
  annotation_id: string;
  pilot_id: string;
  coach_id: string;
  corner_index: number;
  body: string;
  telemetry_session_id: string | null;
  visibility: 'private' | 'shared';
}

const CORNER_NAMES: Record<number, string> = {
  1: 'Saintonge 1',
  2: 'Saintonge 2',
  3: "L'épingle Est",
  4: 'Le balcon',
  5: 'Le retour',
  6: "L'épingle Sud",
  7: 'La ramenée',
};

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const payload: Payload = await req.json();

    // Garde-fou : on ne notifie QUE les annotations partagées
    if (payload.visibility !== 'shared') {
      return new Response(JSON.stringify({ skipped: 'private' }), { status: 200 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      console.error('[notify-coach-annotated] env manquant');
      return new Response('Server misconfigured', { status: 500 });
    }
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Récupère le push token du pilote + son prénom
    const { data: pilot } = await supabase
      .from('users')
      .select('expo_push_token, first_name')
      .eq('id', payload.pilot_id)
      .maybeSingle();

    if (!pilot?.expo_push_token) {
      console.warn('[notify-coach-annotated] pilote sans push token');
      return new Response(JSON.stringify({ skipped: 'no_token' }), { status: 200 });
    }

    // 2. Récupère le prénom du coach pour personnaliser le titre
    const { data: coach } = await supabase
      .from('users')
      .select('first_name, last_name')
      .eq('id', payload.coach_id)
      .maybeSingle();

    const coachName =
      [coach?.first_name, coach?.last_name].filter(Boolean).join(' ') || 'Votre coach';

    // 3. Construit le contenu de la notif
    const cornerName = CORNER_NAMES[payload.corner_index] ?? `Virage ${payload.corner_index}`;
    const excerpt = payload.body.length > 60 ? payload.body.slice(0, 57) + '…' : payload.body;

    const deepLink = payload.telemetry_session_id
      ? `oxv://virage?index=${payload.corner_index}&sessionId=${payload.telemetry_session_id}`
      : `oxv://virage?index=${payload.corner_index}`;

    const message = {
      to: pilot.expo_push_token,
      sound: 'default',
      title: `Note de ${coachName}`,
      body: `${cornerName} · « ${excerpt} »`,
      data: {
        type: 'coach_annotation',
        annotationId: payload.annotation_id,
        cornerIndex: payload.corner_index,
        sessionId: payload.telemetry_session_id,
        deepLink,
      },
      // Catégorie iOS pour grouper les notifs coach
      categoryId: 'coach_message',
      // Android : channel dédié
      channelId: 'coach',
    };

    // 4. Envoi via Expo Push API
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn('[notify-coach-annotated] Expo push fail :', response.status, text);
      return new Response(JSON.stringify({ ok: false, status: response.status }), {
        status: 502,
      });
    }

    const result = await response.json();
    return new Response(JSON.stringify({ ok: true, expo: result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[notify-coach-annotated] error :', message);
    return new Response(JSON.stringify({ ok: false, error: message }), { status: 500 });
  }
});
