// @ts-nocheck — Deno runtime, pas Node
// Edge Function : coach-ai-draft
//
// Assistant IA coach (C-1) — GÉNÉRATION d'un brouillon d'observation descriptive
// sur UN virage d'une session d'un pilote suivi. Le brouillon est inséré en
// status='draft' ; il n'atteint JAMAIS le pilote tel quel. La transformation en
// annotation (canal pilote) passe par coach-ai-validate, après relecture humaine.
//
// Body : { pilotId: string, sessionId: string, cornerIndex: number (1..7) }
//
// SÉCURITÉ (durcissement revue adversariale) :
//   - On lit les données du pilote via le JWT DU COACH (pas service_role) : la
//     RLS empêche par construction toute exfiltration cross-pilote.
//   - Gate fail-closed : rpc coach_ai_consent(pilotId) = (is_detailed_coach_of
//     ET pilote a activé coach_ai_enabled). Faux/erreur/absent → 403, AUCUNE
//     donnée envoyée à OpenAI.
//   - Payload OpenAI NON NOMINATIF (circuit + grandeurs du virage uniquement).
//   - Garde-fou doctrinal serveur (findForbiddenVerbs) sur la sortie AVANT
//     insertion : retry, puis refus 422 + log audit si encore en faute.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

// Miroir Deno du lexique aiSafetyFilter (cf. generate-debrief-ai). Duplication
// TRACÉE : le test app anti-divergence couvre chaque terme.
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

function findForbiddenVerbs(text: string): string[] {
  const found: string[] = [];
  for (const { re, label } of FORBIDDEN_PATTERNS) if (re.test(text)) found.push(label);
  return found;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  try {
    const { pilotId, sessionId, cornerIndex } = await req.json();
    if (!pilotId || !sessionId) return json({ error: 'pilotId et sessionId requis' }, 400);
    const corner = Number(cornerIndex);
    if (!Number.isInteger(corner) || corner < 1 || corner > 7) {
      return json({ error: 'cornerIndex invalide (1..7)' }, 400);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'non authentifié' }, 401);

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) return json({ error: 'OPENAI_API_KEY non configurée' }, 500);

    const url = Deno.env.get('SUPABASE_URL')!;
    // Client porteur du JWT DU COACH : toute lecture passe par la RLS du coach.
    const jwt = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: auth } = await jwt.auth.getUser();
    const coachId = auth?.user?.id;
    if (!coachId) return json({ error: 'session invalide' }, 401);

    // GATE fail-closed : coach détaillé consenti ET opt-in IA du pilote.
    const { data: allowed, error: gateErr } = await jwt.rpc('coach_ai_consent', {
      pilot_uuid: pilotId,
    });
    if (gateErr || allowed !== true) {
      return json({ error: 'coach_ai_not_allowed', detail: 'Consentement IA-coach requis.' }, 403);
    }

    // Lecture FACTUELLE via le JWT du coach (RLS is_detailed_coach_of). Si le
    // coach n'a pas accès, la requête revient vide → 404 (jamais d'exfiltration).
    const { data: session } = await jwt
      .from('telemetry_sessions')
      .select('id, user_id, circuit_name')
      .eq('id', sessionId)
      .maybeSingle();
    if (!session || session.user_id !== pilotId) {
      return json({ error: 'session_not_found' }, 404);
    }

    const { data: segments } = await jwt
      .from('app_segment_analyses')
      .select(
        'segment_index, segment_name, margin_percent, margin_zone, max_g_lateral, entry_speed_kmh, apex_speed_kmh, exit_speed_kmh'
      )
      .eq('telemetry_session_id', sessionId)
      .order('segment_index', { ascending: true });

    const seg = (segments ?? []).find(
      (s: Record<string, unknown>) => Number(s.segment_index) === corner
    );
    if (!seg) return json({ error: 'segment_not_found', detail: 'Virage non analysé.' }, 404);

    // Payload NON NOMINATIF : circuit + grandeurs du virage uniquement.
    const factual = `Virage : ${seg.segment_name ?? `virage ${corner}`}
Circuit : ${session.circuit_name ?? 'non renseigné'}
Marge : ${seg.margin_percent ?? '?'}% (${seg.margin_zone ?? '?'})
G latéral max : ${seg.max_g_lateral ?? '?'} g
Vitesses : entrée ${seg.entry_speed_kmh ?? '?'} km/h, apex ${seg.apex_speed_kmh ?? '?'} km/h, sortie ${seg.exit_speed_kmh ?? '?'} km/h`;

    const systemPrompt = `Tu rédiges une OBSERVATION FACTUELLE pour un coach, sur un seul virage. Tu n'es PAS un coach : tu décris ce que les capteurs ont mesuré, tu n'ordonnes rien, tu ne conseilles rien.

Doctrine NON NÉGOCIABLE :
- Vouvoiement systématique. Pas d'emoji. Pas d'exclamation. Phrases courtes, ton sobre.
- STRICTEMENT DESCRIPTIF : énonce les faits mesurés. Jamais de prescription, conseil, recommandation, correction.
- INTERDITS absolus : "freinez", "accélérez", "ouvrez les gaz", "tracez", "évitez", "poussez", "corrigez", "améliorez", "optimisez", "gagnez", "il faut", "vous devez", "vous devriez", "vous pouvez", "tu dois", "tu peux", "je vous conseille", "je vous recommande".
- Aucun score, aucun classement, aucune comparaison avec d'autres pilotes.
- Vocabulaire autorisé : "à observer", "à creuser la prochaine fois", "était-ce volontaire ?", "confortable", "terrain serré".

Format : 2 à 3 phrases courtes (max ~80 mots). Tu peux terminer par UNE question ouverte. Aucune consigne.`;

    const userPrompt = `${factual}

Rédige une observation descriptive de ce virage, selon la doctrine.`;

    async function callOpenAI(messages: { role: string; content: string }[]): Promise<string> {
      const res = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, messages, temperature: 0.5, max_tokens: 220 }),
      });
      if (!res.ok) throw new Error(`openai_http_${res.status}: ${(await res.text()).slice(0, 200)}`);
      const j = await res.json();
      const text = j.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error('openai_empty_response');
      return text;
    }

    let text: string;
    try {
      text = await callOpenAI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);
    } catch (e) {
      return json({ error: 'openai_error', detail: e instanceof Error ? e.message : String(e) }, 502);
    }

    // Garde-fou doctrinal serveur AVANT insertion (le coach ne voit jamais une faute).
    let forbidden = findForbiddenVerbs(text);
    let retried = false;
    if (forbidden.length > 0) {
      retried = true;
      try {
        text = await callOpenAI([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
          { role: 'assistant', content: text },
          {
            role: 'user',
            content: `Votre réponse contenait des termes prescriptifs INTERDITS : ${forbidden.join(', ')}. Réécrivez l'observation en restant STRICTEMENT DESCRIPTIF, sans aucun de ces termes.`,
          },
        ]);
        forbidden = findForbiddenVerbs(text);
      } catch {
        forbidden = ['retry_failed'];
      }
    }

    if (forbidden.length > 0) {
      // Log audit via service_role (le coach ne peut pas écrire admin_audit).
      try {
        const svc = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
          auth: { persistSession: false },
        });
        await svc.from('admin_audit').insert({
          user_id: coachId,
          action: 'coach_ai_draft_rejected_doctrine',
          metadata: { coach_id: coachId, pilot_id: pilotId, session_id: sessionId, corner_index: corner, forbidden_terms: forbidden, retried },
        });
      } catch {
        // best effort
      }
      return json({ error: 'doctrine_violation', forbidden }, 422);
    }

    // Tronque à la borne CHECK (1..1000) par sécurité.
    const body = text.slice(0, 1000);

    // Insertion via le JWT du coach (RLS coach_ai_drafts_coach_insert, status='draft').
    const { data: inserted, error: insErr } = await jwt
      .from('coach_ai_drafts')
      .insert({
        coach_id: coachId,
        pilot_id: pilotId,
        telemetry_session_id: sessionId,
        corner_index: corner,
        generated_text: body,
        status: 'draft',
        provenance: 'openai_gpt-4o-mini',
        model_version: MODEL,
      })
      .select('id')
      .single();
    if (insErr || !inserted) {
      return json({ error: 'persist_failed', detail: insErr?.message ?? 'no data' }, 500);
    }

    return json({ ok: true, draftId: inserted.id, text: body, retried }, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
