// Edge Function : notify-coach-consent-received
//
// Envoie une notification push au coach quand un pilote vient de
// consentir au partage de ses données (depuis l'app pilote, écran
// /(app)/mon-coach).
//
// Body attendu : { coachId: string, pilotFirstName: string }
//
// Symétrique de notify-pilot-coach-assigned, mêmes contraintes de
// sécurité (verify_jwt + opt-in user vérifié).

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req: Request) => {
  try {
    const { coachId, pilotFirstName } = await req.json();
    if (!coachId) {
      return new Response(JSON.stringify({ error: 'coachId requis' }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    const { data: user, error } = await supabase
      .from('users')
      .select('expo_push_token, push_notif_enabled, first_name')
      .eq('id', coachId)
      .maybeSingle();

    if (error || !user) {
      return new Response(JSON.stringify({ skipped: 'coach_not_found' }), { status: 200 });
    }
    if (!user.expo_push_token || user.push_notif_enabled === false) {
      return new Response(JSON.stringify({ skipped: 'no_token_or_opted_out' }), { status: 200 });
    }

    const pilotLabel = pilotFirstName ? pilotFirstName : 'Un de vos pilotes';
    const body = {
      to: user.expo_push_token,
      title: 'Un pilote vous a accordé sa confiance.',
      body: `${pilotLabel} vous donne accès à ses sessions. Vous pouvez maintenant les consulter.`,
      data: { type: 'pilot_consented' },
      sound: null,
      priority: 'default',
    };

    const pushRes = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
    const pushJson = await pushRes.json();

    return new Response(JSON.stringify({ ok: true, expo: pushJson }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
