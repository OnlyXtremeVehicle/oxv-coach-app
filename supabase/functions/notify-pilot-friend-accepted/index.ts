// @ts-nocheck — Deno runtime, pas Node
/**
 * Edge Function — notify-pilot-friend-accepted
 *
 * Envoie une push notification Expo à l'initiator d'une demande d'amitié
 * quand le destinataire vient de l'accepter (Feature Duel pédagogique).
 *
 * Déclenchée par le trigger Postgres `pilot_friendships_after_update`
 * (migration 0028) sur transition status pending → accepted.
 *
 * Doctrine OXV :
 *   - Titre : « {prénom responder} a accepté »
 *   - Corps : « Vous pouvez désormais comparer vos bilans. »
 *   - Deep-link : /(app)/cote-a-cote/{responder_id} pour ouvrir la vue côte à côte
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface Payload {
  friendship_id: string;
  initiator_id: string;
  responder_id: string;
}

interface UserRow {
  expo_push_token: string | null;
  first_name: string | null;
  public_handle: string | null;
  push_notif_enabled: boolean | null;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Défense en profondeur : cette fonction est déclenchée par le trigger
  // Postgres `pilot_friendships_after_update` (pg_net), qui porte
  // `Authorization: Bearer <edge_functions_invoke_secret>` (cf. migration 0028).
  // On rejette tout appel dont le Bearer ne matche pas le secret, pour bloquer
  // un POST anonyme forgé sur l'URL publique (verify_jwt=false). Si le secret
  // n'est pas configuré côté Edge (env vide), on laisse passer pour ne pas
  // casser les notifs (best-effort) — un WARNING signale la garde inactive.
  const invokeSecret = Deno.env.get('EDGE_FUNCTIONS_INVOKE_SECRET');
  if (invokeSecret) {
    if ((req.headers.get('Authorization') ?? '') !== `Bearer ${invokeSecret}`) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
    }
  } else {
    console.warn('[friend-accepted] EDGE_FUNCTIONS_INVOKE_SECRET non configuré — garde trigger désactivée');
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('[friend-accepted] env vars manquantes');
    return new Response('Misconfigured', { status: 500 });
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (!payload.initiator_id || !payload.responder_id) {
    return new Response('Missing initiator_id or responder_id', { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Lookup initiator (le destinataire de la notif)
  const { data: initiator } = await supabase
    .from('users')
    .select('expo_push_token, push_notif_enabled')
    .eq('id', payload.initiator_id)
    .maybeSingle<UserRow>();

  if (!initiator?.expo_push_token) {
    console.warn('[friend-accepted] initiator sans token push');
    return new Response(JSON.stringify({ skipped: 'no_token' }), { status: 200 });
  }
  if (initiator.push_notif_enabled === false) {
    console.warn('[friend-accepted] initiator a désactivé les notifs');
    return new Response(JSON.stringify({ skipped: 'opted_out' }), { status: 200 });
  }

  // Lookup responder (nom à afficher)
  const { data: responder } = await supabase
    .from('users')
    .select('first_name, public_handle')
    .eq('id', payload.responder_id)
    .maybeSingle<UserRow>();

  const responderName =
    responder?.first_name ??
    (responder?.public_handle ? `@${responder.public_handle}` : 'Un pilote');

  const expoPayload = {
    to: initiator.expo_push_token,
    sound: 'default',
    title: `${responderName} a accepté`,
    body: 'Vous pouvez désormais comparer vos bilans.',
    data: {
      type: 'friend_accepted',
      friendshipId: payload.friendship_id,
      friendId: payload.responder_id,
    },
  };

  const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(expoPayload),
  });

  const expoJson = await expoRes.json().catch(() => null);
  if (!expoRes.ok) {
    console.error('[friend-accepted] Expo push fail', expoRes.status, expoJson);
    return new Response(JSON.stringify({ error: 'expo_push_failed', detail: expoJson }), {
      status: 502,
    });
  }

  return new Response(JSON.stringify({ ok: true, expo: expoJson }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
