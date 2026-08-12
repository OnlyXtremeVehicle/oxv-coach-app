// =============================================================================
// supabase/functions/resend_webhook/index.ts
// =============================================================================
// Reçoit les events Resend (email.sent, .delivered, .opened, .clicked, etc.)
// et met à jour les colonnes de tracking sur ritual_dispatches.
//
// Configuration Resend :
// - Dashboard Resend → Webhooks → Add endpoint
// - URL : https://{PROJECT_REF}.supabase.co/functions/v1/resend_webhook
// - Events : sélectionner tous les types
// - Signing secret : copier la valeur générée et la stocker dans RESEND_WEBHOOK_SECRET
//
// Déploiement :
// supabase functions deploy resend_webhook --no-verify-jwt
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// -----------------------------------------------------------------------------
// HTTP entry point
// -----------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // 1. Lire le body brut (nécessaire pour vérifier la signature avant parsing)
    const rawBody = await req.text();

    // 2. Vérifier la signature Resend (HMAC SHA256)
    const signatureValid = await verifyResendSignature(req.headers, rawBody);
    if (!signatureValid) {
      console.warn('Signature Resend invalide — request rejected');
      return new Response('Invalid signature', { status: 401 });
    }

    // 3. Parser le payload
    const event = JSON.parse(rawBody) as ResendEvent;
    if (!event.type || !event.data?.email_id) {
      return new Response('Malformed event', { status: 400 });
    }

    // 4. Traiter l'event
    await processEvent(event);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Erreur resend_webhook:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

// -----------------------------------------------------------------------------
// Types Resend
// -----------------------------------------------------------------------------

interface ResendEvent {
  type: string;             // 'email.sent', 'email.opened', etc.
  created_at: string;       // ISO timestamp de l'event
  data: {
    email_id: string;       // = notre resend_message_id
    to?: string[];
    subject?: string;
    bounce?: { type?: string; description?: string };
    [key: string]: unknown;
  };
}

// -----------------------------------------------------------------------------
// Vérification de signature — spec Svix (Resend utilise Svix sous le capot)
// -----------------------------------------------------------------------------
// Resend signe via Svix avec les headers :
//   svix-id        : identifiant unique du message
//   svix-timestamp : timestamp Unix en secondes
//   svix-signature : "v1,<base64_signature>" (parfois plusieurs séparées par espace)
//
// Le contenu signé est : `${svix-id}.${svix-timestamp}.${body}`
// L'algorithme est HMAC-SHA256
// La clé secrète "whsec_xxxxx" doit être base64-décodée (sans le préfixe "whsec_")
// avant d'être utilisée comme clé HMAC.
// Référence : https://docs.svix.com/receiving/verifying-payloads/how-manual

async function verifyResendSignature(headers: Headers, body: string): Promise<boolean> {
  const rawSecret = Deno.env.get('RESEND_WEBHOOK_SECRET');
  if (!rawSecret) {
    console.error('RESEND_WEBHOOK_SECRET manquant');
    return false;
  }

  const svixId = headers.get('svix-id') ?? headers.get('webhook-id') ?? '';
  const svixTimestamp = headers.get('svix-timestamp') ?? headers.get('webhook-timestamp') ?? '';
  const svixSignature = headers.get('svix-signature') ?? headers.get('webhook-signature') ?? '';

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error('Headers Svix manquants', { svixId: !!svixId, svixTimestamp: !!svixTimestamp, svixSignature: !!svixSignature });
    return false;
  }

  // Décode la clé secrète (format "whsec_<base64>")
  const secretB64 = rawSecret.startsWith('whsec_') ? rawSecret.slice(6) : rawSecret;
  let secretBytes: Uint8Array;
  try {
    secretBytes = base64ToBytes(secretB64);
  } catch (e) {
    console.error('Secret base64 invalide:', (e as Error).message);
    return false;
  }

  // Calcule la signature attendue
  const signedContent = `${svixId}.${svixTimestamp}.${body}`;
  const expectedSig = await computeHmacBase64(signedContent, secretBytes);

  // svix-signature peut contenir plusieurs signatures séparées par espace,
  // chacune au format "v1,<base64>". On compare en constant-time avec chacune.
  const parts = svixSignature.split(' ');
  for (const part of parts) {
    const [version, sig] = part.split(',');
    if (version !== 'v1' || !sig) continue;
    if (constantTimeEqual(sig, expectedSig)) return true;
  }

  console.warn('Signature ne correspond pas. Attendu vs reçu (debug, ne pas logger en prod long-terme)');
  return false;
}

async function computeHmacBase64(payload: string, keyBytes: Uint8Array): Promise<string> {
  const messageData = new TextEncoder().encode(payload);
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  return arrayBufferToBase64(signature);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

// -----------------------------------------------------------------------------
// Traitement d'un event
// -----------------------------------------------------------------------------

async function processEvent(event: ResendEvent): Promise<void> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // 1. Retrouver le dispatch lié via resend_message_id
  const { data: dispatch } = await supabase
    .from('ritual_dispatches')
    .select('id')
    .eq('resend_message_id', event.data.email_id)
    .maybeSingle();

  // 2. Archiver l'event — SANS LES DONNÉES IDENTIFIANTES.
  //
  // ==========================================================================
  // MINIMISATION À LA SOURCE, ET POURQUOI C'EST MIEUX QU'UNE PURGE
  // ==========================================================================
  //
  // Cette insertion écrivait `raw_payload: event`, c'est-à-dire la charge
  // BRUTE du webhook : l'adresse du destinataire, le sujet, l'expéditeur, les
  // en-têtes. Relevé en production le 12/08/2026 : 49 lignes, **11 adresses
  // e-mail distinctes en clair**, du 16/06 au 21/07.
  //
  // On a d'abord corrigé en aval — `purge_user_data` rattache ces lignes par
  // l'adresse, et un cron les borne à six mois. Mais 21 des 49 lignes portent
  // des adresses **qui n'ont jamais eu de compte** : aucune purge par
  // utilisateur ne peut les atteindre, par construction.
  //
  // La vraie correction est ici. **Rien ne relit `raw_payload`** — vérifié :
  // aucune lecture dans les fonctions serveur ni dans l'application, et
  // l'événement est appliqué par `apply_resend_event` via des paramètres
  // séparés. Une colonne que personne ne lit et qui porte une adresse n'a pas
  // de raison d'être écrite (article 5.1.c, minimisation).
  //
  // Ce qu'on garde : de quoi diagnostiquer une non-délivrance — le type et la
  // description du rebond. Ce qu'on jette : `to`, `subject`, `from`, les
  // en-têtes, et tout le reste de la charge.
  //
  // `event_type`, `resend_email_id` et `occurred_at` restent en colonnes
  // propres : ils suffisent à compter et à recouper, et `resend_email_id` est
  // l'identifiant technique de Resend, pas une adresse.
  const chargeMinimale = {
    bounce_type: event.data.bounce?.type ?? null,
    bounce_description: event.data.bounce?.description ?? null,
  };

  const { error: insertErr } = await supabase
    .from('resend_events')
    .insert({
      event_type: event.type,
      resend_email_id: event.data.email_id,
      dispatch_id: dispatch?.id ?? null,
      occurred_at: event.created_at,
      raw_payload: chargeMinimale,
    });
  if (insertErr) {
    console.error('Erreur insert resend_events:', insertErr.message);
  }

  // 3. Si on a trouvé un dispatch correspondant, appliquer l'event
  if (dispatch?.id) {
    const bounceReason = event.data.bounce
      ? `${event.data.bounce.type ?? ''}: ${event.data.bounce.description ?? ''}`.trim()
      : null;

    const { error: applyErr } = await supabase.rpc('apply_resend_event', {
      p_dispatch_id: dispatch.id,
      p_event_type: event.type,
      p_occurred_at: event.created_at,
      p_bounce_reason: bounceReason,
    });
    if (applyErr) {
      console.error('Erreur apply_resend_event:', applyErr.message);
    }
  }
}
