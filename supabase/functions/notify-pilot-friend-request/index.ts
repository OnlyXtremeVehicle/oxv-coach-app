// @ts-nocheck — Deno runtime, pas Node
/**
 * Edge Function — notify-pilot-friend-request
 *
 * Envoie une push notification Expo au destinataire d'une nouvelle
 * demande d'amitié (Feature Duel pédagogique).
 *
 * Déclenchée par le trigger Postgres `pilot_friendships_after_insert`
 * (migration 0028) qui appelle cette fonction via pg_net.
 *
 * Doctrine OXV :
 *   - Titre sobre : « {prénom initiator} souhaite vous comparer »
 *   - Corps : « Ouvrez Amis pour répondre. »
 *   - Deep-link : /(app)/amis pour ouvrir la liste avec la demande
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface Payload {
  friendship_id: string;
  initiator_id: string;
  recipient_id: string;
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

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('[friend-request] env vars manquantes');
    return new Response('Misconfigured', { status: 500 });
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (!payload.recipient_id || !payload.initiator_id) {
    return new Response('Missing recipient_id or initiator_id', { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Lookup destinataire (token + préférences)
  const { data: recipient } = await supabase
    .from('users')
    .select('expo_push_token, push_notif_enabled')
    .eq('id', payload.recipient_id)
    .maybeSingle<UserRow>();

  if (!recipient?.expo_push_token) {
    console.warn('[friend-request] destinataire sans token push');
    return new Response(JSON.stringify({ skipped: 'no_token' }), { status: 200 });
  }
  if (recipient.push_notif_enabled === false) {
    console.warn('[friend-request] destinataire a désactivé les notifs');
    return new Response(JSON.stringify({ skipped: 'opted_out' }), { status: 200 });
  }

  // Lookup initiator (nom à afficher)
  const { data: initiator } = await supabase
    .from('users')
    .select('first_name, public_handle')
    .eq('id', payload.initiator_id)
    .maybeSingle<UserRow>();

  const initiatorName =
    initiator?.first_name ??
    (initiator?.public_handle ? `@${initiator.public_handle}` : 'Un pilote');

  const expoPayload = {
    to: recipient.expo_push_token,
    sound: 'default',
    title: `${initiatorName} souhaite vous comparer`,
    body: 'Ouvrez Amis pour répondre.',
    data: {
      type: 'friend_request',
      friendshipId: payload.friendship_id,
      initiatorId: payload.initiator_id,
    },
  };

  const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(expoPayload),
  });

  const expoJson = await expoRes.json().catch(() => null);
  if (!expoRes.ok) {
    console.error('[friend-request] Expo push fail', expoRes.status, expoJson);
    return new Response(JSON.stringify({ error: 'expo_push_failed', detail: expoJson }), {
      status: 502,
    });
  }

  return new Response(JSON.stringify({ ok: true, expo: expoJson }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
