// @ts-nocheck — Deno runtime, pas Node
// Edge Function : coach-ai-validate
//
// Assistant IA coach (C-1) — VALIDATION humaine d'un brouillon. Le coach a relu
// et éventuellement ÉDITÉ le texte ; cette fonction RE-FILTRE le texte final côté
// serveur, puis (si conforme) crée l'annotation coach_annotations (canal pilote,
// ai_assisted=true) et marque le brouillon 'validated'.
//
// Body : { draftId: string, editedText: string, visibility: 'private'|'shared' }
//
// Pourquoi une edge : la RLS interdit au coach de poser status='validated'
// lui-même (anti-auto-publication). La transition + la création d'annotation
// passent par service_role APRÈS re-filtrage — le texte édité ne peut donc pas
// contourner la doctrine. La création d'annotation déclenche en plus le trigger
// doctrinal en base (double rempart).

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

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
    const { draftId, editedText, visibility } = await req.json();
    if (!draftId) return json({ error: 'draftId requis' }, 400);
    const text = typeof editedText === 'string' ? editedText.trim() : '';
    if (text.length < 1 || text.length > 1000) return json({ error: 'texte invalide (1..1000)' }, 400);
    if (visibility !== 'private' && visibility !== 'shared') {
      return json({ error: 'visibility invalide' }, 400);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'non authentifié' }, 401);

    const url = Deno.env.get('SUPABASE_URL')!;
    const jwt = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: auth } = await jwt.auth.getUser();
    const coachId = auth?.user?.id;
    if (!coachId) return json({ error: 'session invalide' }, 401);

    // Charge le brouillon via le JWT du coach : la RLS garantit que c'est le sien
    // (coach_id = auth.uid() AND is_detailed_coach_of). Sinon introuvable.
    const { data: draft } = await jwt
      .from('coach_ai_drafts')
      .select('id, coach_id, pilot_id, telemetry_session_id, corner_index, status')
      .eq('id', draftId)
      .maybeSingle();
    if (!draft || draft.coach_id !== coachId) return json({ error: 'draft_not_found' }, 404);
    if (draft.status !== 'draft') return json({ error: 'draft_not_pending', status: draft.status }, 409);

    // RE-FILTRE du texte ÉDITÉ côté serveur (le cœur du durcissement).
    const forbidden = findForbiddenVerbs(text);
    if (forbidden.length > 0) {
      return json({ error: 'doctrine_violation', forbidden }, 422);
    }

    // service_role : créer l'annotation + valider le brouillon (la RLS interdit
    // au coach de poser 'validated' lui-même). Le trigger doctrinal en base
    // re-vérifie la note partagée (double rempart).
    const svc = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    });

    const { data: annotation, error: annErr } = await svc
      .from('coach_annotations')
      .insert({
        coach_id: draft.coach_id,
        pilot_id: draft.pilot_id,
        telemetry_session_id: draft.telemetry_session_id,
        corner_index: draft.corner_index,
        body: text,
        visibility,
        ai_assisted: true,
      })
      .select('id')
      .single();
    if (annErr || !annotation) {
      // Le trigger doctrinal peut rejeter (check_violation) — message clair.
      const detail = annErr?.message ?? 'no data';
      const doctrine = /doctrine_violation/i.test(detail);
      return json({ error: doctrine ? 'doctrine_violation' : 'annotation_failed', detail }, doctrine ? 422 : 500);
    }

    const { error: updErr } = await svc
      .from('coach_ai_drafts')
      .update({
        status: 'validated',
        resulting_annotation_id: annotation.id,
        validated_at: new Date().toISOString(),
      })
      .eq('id', draftId);
    if (updErr) {
      return json({ error: 'draft_update_failed', detail: updErr.message, annotationId: annotation.id }, 500);
    }

    return json({ ok: true, annotationId: annotation.id }, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
