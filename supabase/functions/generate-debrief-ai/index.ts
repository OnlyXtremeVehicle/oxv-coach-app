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
// RGPD (S5, charte 12) :
//   - Le payload envoyé à OpenAI (US) est NON NOMINATIF : pas de prénom, pas
//     d'identifiant — seulement le niveau déclaré, le circuit et des grandeurs
//     de roulage (marges, vitesses, G). Minimisation du transfert hors-UE.
//   - Réglage opt-out : si users.ai_debrief_enabled = false, on n'appelle pas
//     OpenAI (403) ; l'app pilote retombe sur le générateur local descriptif.
//
// GARDE-FOU DOCTRINAL (cahier OXV Mirror §11 : "debrief IA strictement
// descriptif, jamais prescriptif"). Le prompt ne suffit pas — un LLM peut
// déraper. On scanne donc la SORTIE générée :
//   1. Génération GPT
//   2. Scan des verbes interdits sur le texte produit
//   3. Si violation → 1 retry avec consigne renforcée listant les fautes
//   4. Si encore en faute → on REFUSE de persister (422), l'app pilote
//      fallback sur le générateur local descriptif (maîtrisé, sûr)
// Ainsi rien d'interdit ne peut atteindre le pilote, même si GPT dérape.
//
// Sécurité :
//   - verify_jwt = true (seul user authentifié peut appeler)
//   - Si OPENAI_API_KEY absent : 500, app fallback sur debriefGenerator local

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

// ---------------------------------------------------------------------------
// Garde-fou : verbes/expressions interdits dans le texte généré.
// Aligné sur scripts/check-doctrine.ts (catégorie verbes de pilotage +
// prescriptions). On ne garde QUE les patterns pertinents pour un debrief
// (pas les termes anglais UI tap/swipe ni les jugements bravo qui visent
// l'interface). Tout ce qui ORDONNE ou CONSEILLE est banni.
// ---------------------------------------------------------------------------
const FORBIDDEN_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\bfreinez\b/i, label: 'freinez' },
  { re: /\baccélérez\b/i, label: 'accélérez' },
  { re: /\bouvrez les gaz\b/i, label: 'ouvrez les gaz' },
  { re: /\btracez\b/i, label: 'tracez' },
  { re: /\bévitez\b/i, label: 'évitez' },
  { re: /\bpoussez\b/i, label: 'poussez' },
  { re: /\bcorrigez\b/i, label: 'corrigez' },
  { re: /\baméliorez\b/i, label: 'améliorez' },
  { re: /\boptimisez\b/i, label: 'optimisez' },
  { re: /\bgagnez\b/i, label: 'gagnez' },
  { re: /\bil faut\b/i, label: 'il faut' },
  { re: /\bvous devez\b/i, label: 'vous devez' },
  { re: /\bvous devriez\b/i, label: 'vous devriez' },
  { re: /\bvous pouvez\b/i, label: 'vous pouvez' },
  { re: /\btu dois\b/i, label: 'tu dois' },
  { re: /\btu peux\b/i, label: 'tu peux' },
  { re: /\bje vous conseille\b/i, label: 'je vous conseille' },
  { re: /\bje vous recommande\b/i, label: 'je vous recommande' },
];

/** Retourne la liste des verbes interdits trouvés dans le texte (vide = propre). */
function findForbiddenVerbs(text: string): string[] {
  const found: string[] = [];
  for (const { re, label } of FORBIDDEN_PATTERNS) {
    if (re.test(text)) found.push(label);
  }
  return found;
}

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

    // RGPD (S5) : on ne lit QUE le niveau (donnée non identifiante). Le prénom
    // n'est plus transmis à OpenAI — il restait identifiant couplé au circuit/
    // perfs. `ai_debrief_enabled` porte le réglage opt-out (défaut : actif).
    const { data: pilot } = await supabase
      .from('users')
      .select('pilot_level, ai_debrief_enabled')
      .eq('id', session.user_id)
      .maybeSingle();

    // Gate opt-out (S5) : si le pilote a désactivé le débrief assisté par IA,
    // on n'appelle PAS OpenAI. L'app retombe sur le générateur local descriptif.
    if (pilot && pilot.ai_debrief_enabled === false) {
      return new Response(
        JSON.stringify({ error: 'ai_debrief_disabled', detail: 'Opt-out IA actif — fallback local.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

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

    const systemPrompt = `Tu es OXV Mirror, une application de RESTITUTION FACTUELLE de données de roulage sur circuit. Tu n'es PAS un coach : tu ne conseilles pas, tu ne corriges pas, tu n'ordonnes pas. Tu décris ce que les capteurs ont mesuré, le pilote interprète seul.

Doctrine NON NÉGOCIABLE (toute violation rend le texte inutilisable) :
- Vouvoiement systématique.
- STRICTEMENT DESCRIPTIF : énonce des faits mesurés. Jamais de prescription, de conseil, de recommandation, de correction.
- AUCUN verbe directif ni d'incitation. Interdits absolus : "freinez", "accélérez", "ouvrez les gaz", "tracez", "évitez", "poussez", "corrigez", "améliorez", "optimisez", "gagnez", "il faut", "vous devez", "vous devriez", "vous pouvez", "tu dois", "tu peux", "je vous conseille", "je vous recommande".
- AUCUN score, AUCUN classement, AUCUNE comparaison avec d'autres pilotes.
- L'app est un MIROIR. Elle montre. Elle ne dirige pas.
- Ton sobre, posé, premium "Ferrari sec" : pas d'emoji, pas d'exclamation, phrases courtes.
- Vocabulaire autorisé : "à observer", "à creuser la prochaine fois", "était-ce volontaire ?", "confortable", "terrain serré", "apprivoisé".

Structure OBLIGATOIRE : 3 paragraphes séparés par exactement "\n---\n" (pas d'espaces autour des tirets) :

ACTE 1 — RÉCIT (~80 mots) : Narration factuelle de la session. Mentionnez les faits mesurés disponibles (nombre de tours, meilleur tour, un virage marquant par sa donnée). Au passé, descriptif.

ACTE 2 — CE QUE MONTRENT LES CHIFFRES (~60 mots) : Mise en relation NEUTRE des faits mesurés (équilibre des marges, régularité observée). Décrivez ce que les données montrent, sans porter de jugement ni en tirer de leçon. Pas de "il faudrait", pas de "cela suggère de".

ACTE 3 — LA PROCHAINE FOIS (~50 mots) : Désignez factuellement le virage à plus faible marge comme "le terrain le plus serré de cette session" — comme un simple constat, jamais comme "à corriger" ni "à travailler". Posez éventuellement une question ouverte ("était-ce volontaire ?"). Phrase finale : "Un constat, pas une consigne."`;

    // RGPD (S5) : payload non nominatif — pas de prénom, pas d'identifiant.
    const userPrompt = `Pilote : niveau ${pilot?.pilot_level ?? 'non renseigné'}
Circuit : ${session.circuit_name ?? 'Beltoise'}
Nombre de tours : ${session.lap_count ?? '?'}
Meilleur tour : ${session.best_lap_seconds ? `${session.best_lap_seconds}s` : 'inconnu'}

Marge globale : ${analysis?.margin_global ?? '?'}% (${analysis?.margin_zone ?? '?'})
Marge véhicule : ${analysis?.margin_vehicle ?? '?'}%
Marge pilote : ${analysis?.margin_pilot ?? '?'}%

Segments :
${segmentsContext || '(pas de segments analysés)'}

Génère le debrief 3 actes selon la doctrine.`;

    // Helper d'appel OpenAI — réutilisé pour la génération initiale + retry.
    async function callOpenAI(messages: { role: string; content: string }[]): Promise<string> {
      const res = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: MODEL, messages, temperature: 0.6, max_tokens: 600 }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`openai_http_${res.status}: ${errText.slice(0, 200)}`);
      }
      const json = await res.json();
      const text = json.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error('openai_empty_response');
      return text;
    }

    // --- Génération initiale ---
    let generatedText: string;
    try {
      generatedText = await callOpenAI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return new Response(JSON.stringify({ error: 'openai_error', detail: msg }), { status: 502 });
    }

    // --- GARDE-FOU : scan des verbes interdits sur la sortie ---
    let forbidden = findForbiddenVerbs(generatedText);
    let retried = false;

    if (forbidden.length > 0) {
      retried = true;
      console.warn('[OXV] debrief IA : verbes interdits détectés, retry :', forbidden.join(', '));
      // Retry unique avec consigne renforcée listant précisément les fautes.
      try {
        generatedText = await callOpenAI([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
          { role: 'assistant', content: generatedText },
          {
            role: 'user',
            content: `Votre réponse contenait des termes prescriptifs INTERDITS : ${forbidden.join(', ')}. Réécrivez le debrief entièrement en restant STRICTEMENT DESCRIPTIF. Remplacez toute formulation qui conseille, ordonne ou recommande par un simple constat factuel. N'utilisez aucun des termes interdits. Gardez la structure 3 actes séparés par "\\n---\\n".`,
          },
        ]);
        forbidden = findForbiddenVerbs(generatedText);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('[OXV] debrief IA : retry échoué :', msg);
        forbidden = ['retry_failed'];
      }
    }

    // Si après retry le texte est TOUJOURS en faute → on REFUSE de persister.
    // L'app pilote tombera sur le générateur local descriptif (sûr).
    if (forbidden.length > 0) {
      // Trace RGPD/doctrine : on loggue le refus pour audit.
      await supabase
        .from('admin_audit')
        .insert({
          user_id: session.user_id,
          action: 'debrief_ai_rejected_doctrine',
          metadata: {
            session_id: sessionId,
            forbidden_terms: forbidden,
            retried,
          },
        })
        .then(
          () => undefined,
          () => undefined,
        );

      return new Response(
        JSON.stringify({
          error: 'doctrine_violation',
          detail: 'Texte généré non conforme à la doctrine après retry — fallback local requis.',
          forbidden,
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } },
      );
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
        retried,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
