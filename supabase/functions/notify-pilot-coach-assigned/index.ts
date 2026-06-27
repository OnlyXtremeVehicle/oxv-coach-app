// Edge Function : notify-pilot-coach-assigned
//
// Envoie une notification push au pilote quand un coach lui est assigné
// par l'admin OXV. Le pilote doit ensuite ouvrir l'app pour consentir.
//
// Appelée depuis l'app admin après assignPilotToCoach(). Body attendu :
//   { pilotId: string, coachFirstName: string }
//
// Le token Expo Push est lu depuis users.expo_push_token. Si null ou
// si push_notif_enabled = false, on no-op silencieusement.
//
// Sécurité : verify_jwt = true (cf. supabase/config.toml). Le gateway Supabase
// exige un JWT valide → un POST anonyme est rejeté avant d'atteindre le handler.
// L'admin n'est pas vérifié plus finement ici — la RLS sur coach_pilots côté DB
// l'a déjà fait au moment de l'INSERT. (Symétrique : notify-coach-consent-received.)

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req: Request) => {
  try {
    const { pilotId, coachFirstName } = await req.json();
    if (!pilotId) {
      return new Response(JSON.stringify({ error: 'pilotId requis' }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    // Lecture du token + opt-in pilote
    const { data: user, error } = await supabase
      .from('users')
      .select('expo_push_token, push_notif_enabled, first_name')
      .eq('id', pilotId)
      .maybeSingle();

    if (error || !user) {
      return new Response(JSON.stringify({ skipped: 'pilot_not_found' }), { status: 200 });
    }
    if (!user.expo_push_token || user.push_notif_enabled === false) {
      return new Response(JSON.stringify({ skipped: 'no_token_or_opted_out' }), { status: 200 });
    }

    const coachLabel = coachFirstName ? `${coachFirstName}` : 'Un coach OXV';
    const body = {
      to: user.expo_push_token,
      title: 'Un coach vous suit.',
      body: `${coachLabel} vous a été assigné par OXV. Ouvrez l'app quand vous le souhaitez pour donner votre accord.`,
      data: { type: 'coach_assigned' },
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
