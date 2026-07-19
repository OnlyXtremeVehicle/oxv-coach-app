// =============================================================================
// supabase/functions/ritual_dispatcher/index.ts
// =============================================================================
// Point d'entrée HTTP de l'Edge Function.
// Appelé toutes les heures par pg_cron de 16h à 19h UTC (17h-21h Paris).
//
// Déploiement : supabase functions deploy ritual_dispatcher
// Test manuel  : curl -X POST {URL} -H "x-oxv-invoke-secret: {EDGE_FUNCTIONS_INVOKE_SECRET}"
// =============================================================================

import {
  fetchPendingDispatches,
  lockDispatch,
  loadDispatchContext,
  markDispatchSent,
  markDispatchFailed,
  markDispatchSkipped,
  DispatchContext,
} from './lib/supabase.ts';
import { handleJMinus7 } from './handlers/jminus7.ts';
import { handleJMinus2 } from './handlers/jminus2.ts';
import { handleJMinus1 } from './handlers/jminus1.ts';

// -----------------------------------------------------------------------------
// HTTP entry point
// -----------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // SEC-1 (19/07/2026) : l'ancienne garde décodait le JWT sans vérifier la
  // signature (token forgé accepté). Remplacée par le secret interne du Vault,
  // patron des jobs 7/8.
  const INVOKE_SECRET = Deno.env.get('EDGE_FUNCTIONS_INVOKE_SECRET') ?? '';
  const provided = req.headers.get('x-oxv-invoke-secret') ?? '';
  if (!INVOKE_SECRET || provided !== INVOKE_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const startedAt = Date.now();
  const results = {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    // -------- Récupère les dispatches échus --------
    const pending = await fetchPendingDispatches(20);
    results.processed = pending.length;

    if (pending.length === 0) {
      return jsonResponse({ ...results, duration_ms: Date.now() - startedAt, message: 'No pending dispatches' });
    }

    // -------- Traite chaque dispatch séquentiellement --------
    // On évite le parallélisme pour ne pas saturer les API externes (Eleven Labs
    // rate limit notamment) et pour avoir des logs lisibles en cas d'incident.
    for (const dispatch of pending) {
      try {
        await processDispatch(dispatch.id, results);
      } catch (e) {
        const msg = `Dispatch ${dispatch.id}: ${(e as Error).message}`;
        results.errors.push(msg);
        results.failed++;
        console.error(msg);
        await markDispatchFailed(dispatch.id, msg);
      }
    }

    return jsonResponse({ ...results, duration_ms: Date.now() - startedAt });
  } catch (e) {
    console.error('Erreur globale dispatcher:', e);
    return jsonResponse(
      { ...results, error: (e as Error).message, duration_ms: Date.now() - startedAt },
      500
    );
  }
});

// -----------------------------------------------------------------------------
// Traitement d'un dispatch
// -----------------------------------------------------------------------------

async function processDispatch(dispatchId: string, results: { sent: number; skipped: number; failed: number }) {
  // 1) Verrou (status pending → generating)
  const locked = await lockDispatch(dispatchId);
  if (!locked) {
    console.log(`Dispatch ${dispatchId}: déjà verrouillé par un autre worker, skip`);
    return;
  }

  // 2) Charge le contexte complet
  const dispatch = (await fetchPendingDispatches(1)).find(d => d.id === dispatchId);
  // ↑ Approximation : en pratique on devrait avoir une fetch par ID. Refactor possible.
  // Pour rester simple, on recharge depuis la fonction utilitaire fetchDispatchById.
  // → Implémentons-la inline ici pour clarté :
  const ctx = await loadContextById(dispatchId);

  // 3) Vérification opt-in
  const optInKey = `ritual_${ctx.dispatch.ritual_type}_enabled` as
    | 'ritual_jminus7_enabled'
    | 'ritual_jminus2_enabled'
    | 'ritual_jminus1_enabled';
  if (!ctx.pilot[optInKey]) {
    await markDispatchSkipped(dispatchId, `Pilote a désactivé ${ctx.dispatch.ritual_type}`);
    results.skipped++;
    return;
  }

  // 4) Branchement selon le type
  switch (ctx.dispatch.ritual_type) {
    case 'jminus7': {
      const r = await handleJMinus7(ctx);
      await markDispatchSent(dispatchId, {
        payload: r.payload,
        resend_message_id: r.resend_message_id,
      });
      break;
    }
    case 'jminus2': {
      const r = await handleJMinus2(ctx);
      await markDispatchSent(dispatchId, {
        payload: r.payload,
        resend_message_id: r.resend_message_id,
        audio_storage_path: r.audio_storage_path,
        audio_duration_sec: r.audio_duration_sec,
        openai_tokens_used: r.openai_tokens_used,
        elevenlabs_chars: r.elevenlabs_chars,
      });
      break;
    }
    case 'jminus1': {
      const r = await handleJMinus1(ctx);
      await markDispatchSent(dispatchId, {
        payload: r.payload,
        resend_message_id: r.resend_message_id,
      });
      break;
    }
    default:
      throw new Error(`Type de rituel inconnu: ${ctx.dispatch.ritual_type}`);
  }

  results.sent++;
  console.log(`Dispatch ${dispatchId} (${ctx.dispatch.ritual_type}): envoyé à ${ctx.pilot.email}`);
}

// -----------------------------------------------------------------------------
// Helpers locaux
// -----------------------------------------------------------------------------

async function loadContextById(dispatchId: string): Promise<DispatchContext> {
  // On a besoin du dispatch row par ID — comme le lockDispatch a déjà passé le
  // status à 'generating', on requête avec ce statut.
  const { getSupabaseClient } = await import('./lib/supabase.ts');
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('ritual_dispatches')
    .select('id, registration_id, user_id, session_id, ritual_type, status, scheduled_for, attempt_count')
    .eq('id', dispatchId)
    .single();

  if (error || !data) throw new Error(`Dispatch ${dispatchId} introuvable: ${error?.message}`);

  return await loadDispatchContext(data as Parameters<typeof loadDispatchContext>[0]);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
