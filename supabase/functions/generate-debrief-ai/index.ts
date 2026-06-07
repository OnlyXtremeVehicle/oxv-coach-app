// @ts-nocheck — Deno runtime, pas Node
// Edge Function : generate-debrief-ai
//
// Génère le debrief J+1 littéraire via OpenAI à partir des données de
// session du pilote. Substitue le fallback local debriefGenerator.ts
// (sem 13 J2) par une narration enrichie GPT.
//
// Body attendu : { sessionId: string }
// L'Edge Function récupère elle-même via service_role :
//   - session + pilote (telemetry_sessions + users)
//   - analyse globale (app_session_analyses)
//   - segments analysés (app_segment_analyses)
//   - laps (laps table)
// Puis appelle OpenAI avec un prompt doctrinal strict (verbes interdits,
// vouvoiement, structure 3 actes séparés par "---").
//
// Le résultat écrase app_session_analyses.debrief_text.
//
// Sécurité :
//   - verify_jwt = true (seul user authentifié peut appeler)
//   - Si OPENAI_API_KEY absent : 500, app fallback sur debriefGenerator local

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

Deno.serve(async (req: Request) => {
  try {
    const { sessionId } = await req.json();
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'sessionId requis' }), { status: 400 });
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY non configurée (fallback local utilisé)' }),
        { status: 500 }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    // Récupérer la session + le pilote + l'analyse
    const { data: session } = await supabase
      .from('telemetry_sessions')
      .select('id, user_id, circuit_name, started_at, lap_count, best_lap_seconds')
      .eq('id', sessionId)
      .maybeSingle();
    if (!session) {
      return new Response(JSON.stringify({ error: 'session_not_found' }), { status: 404 });
    }

    const { data: pilot } = await supabase
      .from('users')
      .select('first_name, pilot_level')
      .eq('id', session.user_id)
      .maybeSingle();

    const { data: analysis } = await supabase
      .from('app_session_analyses')
      .select('margin_global, margin_zone, margin_vehicle, margin_pilot, margin_breakdown')
      .eq('telemetry_session_id', sessionId)
      .maybeSingle();

    const { data: segments } = await supabase
      .from('app_segment_analyses')
      .select(
        'segment_index, segment_name, margin_percent, margin_zone, max_g_lateral, entry_speed_kmh, apex_speed_kmh, exit_speed_kmh'
      )
      .eq('telemetry_session_id', sessionId)
      .order('segment_index', { ascending: true });

    // Construit le contexte pour OpenAI
    const segmentsContext = (segments ?? [])
      .map(
        (s: Record<string, unknown>) =>
          `${s.segment_name ?? `virage ${s.segment_index}`}: marge ${s.margin_percent ?? '?'}% (${s.margin_zone ?? '?'}), G_lat ${s.max_g_lateral ?? '?'}g`
      )
      .join('\n');

    const systemPrompt = `Tu es OXV Mirror, une application de télémétrie pour pilotes de track day.

Doctrine NON NÉGOCIABLE pour ce debrief :
- Vouvoiement systématique
- AUCUN verbe directif : pas de "freinez", "accélérez", "ouvrez les gaz", "tracez", "évitez", "il faut", "vous devez", "vous devriez", "tu peux", "pousse"
- AUCUNE instruction de pilotage
- AUCUN score, AUCUN classement, AUCUNE comparaison avec d'autres pilotes
- L'app est un MIROIR, pas un coach. Vous décrivez ce qui s'est passé, vous ne dirigez pas
- Le ton est sobre, posetit, premium ferrari : pas d'emoji, pas d'exclamation, phrases courtes
- Vocabulaire autorisé : "à observer", "à creuser la prochaine fois", "était-ce volontaire ?", "confortable", "terrain serré", "apprivoisé"

Structure OBLIGATOIRE : 3 paragraphes séparés par exactement "\n---\n" (pas d'espaces) :

ACTE 1 - RÉCIT (~80 mots) : Narration de la session d'hier. Mentionnez éventuellement le nombre de tours, le best lap, et un virage marquant si la donnée est là.

ACTE 2 - MÉTA-ANALYSE (~60 mots) : Mise en perspective, le temps long. Ce que l'équilibre véhicule/pilote dit. Pas de jugement.

ACTE 3 - PRÉPARATION (~50 mots) : Invitation pour la prochaine fois. Mentionnez le virage à plus faible marge comme "terrain le plus serré" — jamais comme "à corriger". Phrase finale type "Une invitation, pas une consigne."`;

    const userPrompt = `Pilote : ${pilot?.first_name ?? 'le pilote'} (niveau ${pilot?.pilot_level ?? 'non renseigné'})
Circuit : ${session.circuit_name ?? 'Beltoise'}
Nombre de tours : ${session.lap_count ?? '?'}
Meilleur tour : ${session.best_lap_seconds ? `${session.best_lap_seconds}s` : 'inconnu'}

Marge globale : ${analysis?.margin_global ?? '?'}% (${analysis?.margin_zone ?? '?'})
Marge véhicule : ${analysis?.margin_vehicle ?? '?'}%
Marge pilote : ${analysis?.margin_pilot ?? '?'}%

Segments :
${segmentsContext || '(pas de segments analysés)'}

Génère le debrief 3 actes selon la doctrine.`;

    const oaiRes = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 600,
      }),
    });

    if (!oaiRes.ok) {
      const errText = await oaiRes.text();
      return new Response(JSON.stringify({ error: 'openai_error', detail: errText }), {
        status: 502,
      });
    }

    const oaiJson = await oaiRes.json();
    const generatedText = oaiJson.choices?.[0]?.message?.content?.trim();
    if (!generatedText) {
      return new Response(JSON.stringify({ error: 'openai_empty_response' }), { status: 502 });
    }

    // Sanity check : vérifie qu'il y a bien 3 paragraphes séparés par ---
    const parts = generatedText.split(/\n\s*---\s*\n/);
    if (parts.length !== 3) {
      // Format inattendu, on log mais on persiste quand même (l'écran #19 a
      // un parseDebrief tolérant qui split sur doubles sauts de ligne en fallback)
      console.warn('[OXV] OpenAI returned non-3-part format:', parts.length);
    }

    // Écrase debrief_text dans app_session_analyses
    const { error: updateError } = await supabase
      .from('app_session_analyses')
      .update({ debrief_text: generatedText })
      .eq('telemetry_session_id', sessionId);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'persist_failed', detail: updateError.message }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        sessionId,
        textLength: generatedText.length,
        parts: parts.length,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
