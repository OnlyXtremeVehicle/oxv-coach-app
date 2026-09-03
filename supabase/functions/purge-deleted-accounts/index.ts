// =============================================================================
// purge-deleted-accounts — Droit a l'effacement RGPD (art. 17), charte 12 / S3.
//
// /!\ VERSION 5 (SEC-1) — PRÉPARÉE, NON DÉPLOYÉE — approbation fondateur
// requise. La version 4 est actuellement ACTIVE en prod (source identique a
// l'ancien contenu de ce fichier) mais AUCUN cron ne l'invoque (constat du
// 19/07/2026 : cron.job prod sans job de purge) -> a planifier au deploiement.
//
// DIFF v4 (prod) -> v5 (ce fichier) — audit complet :
// docs/architecture/14_PURGE_MATRIX.md
//   1. Tout le DML passe dans la fonction SQL transactionnelle
//      public.purge_user_data(uuid) (migration 20260719_sec1_purge_sante.sql,
//      egalement PREPAREE NON APPLIQUEE). Tout-ou-rien, et perimetre etendu :
//      ~20 tables ignorees par la v4 (coach_profiles avec SIRET/payment_link,
//      coach_annotations, coach_messages, session_intentions, pilot_sheets,
//      session_feedback, demandes_inscription, contact_messages, support_*,
//      media, media_exports, event_registrations, partner_*, scenic_routes,
//      social_pings, duels, crews, app_pairing_codes, ping_rsvps) + scrub users
//      etendu (bio, socials, media, livery, vehicle, car_number,
//      affiliation_code, suspension_reason, pavillon) + anonymisations
//      (coaching_bookings, email_log, admin_audit, device_assignments).
//      Tables futures : incident_reports -> ANONYMISER (jamais purger,
//      TODO_AVOCAT E5) ; biometry_raw -> purge (donnee de sante).
//   2. Storage : couverture 4 -> 8 buckets prefixes par userId (ajout
//      pilot-media, session-media, telemetry_raw, coach-media) ; suppression
//      RECURSIVE (la v4 ignorait silencieusement les chemins imbriques
//      session-media/{uid}/{sessionId}/x) ; bucket coach-audio (objets nommes
//      par annotationId, sans prefixe user) purge via les ids collectes AVANT
//      la purge DB ; objets de la table media retires en best-effort (file_url
//      parsee). Bucket invoices CONSERVE (facturation).
//   3. Fail-closed : un echec storage fait echouer le compte courant (les
//      lignes DB restent -> retry au cron suivant), au lieu du best-effort
//      silencieux de la v4.
//
// ORDRE DE DEPLOIEMENT (apres approbation) : migration D'ABORD (la fonction
// purge_user_data doit exister), puis cette edge, puis test sur branche dev,
// puis planification du cron (voir README.md).
//
// Declenchee par pg_cron (quotidien) via pg_net, avec un Bearer = secret
// interne (edge_functions_invoke_secret, depuis Vault). verify_jwt = false
// (auto-auth).
//
// STRATEGIE : ANONYMISER-ET-PURGER (pas de hard-delete de la ligne users), car
// payments.user_id est NO ACTION (facturation legalement conservee -> un DELETE
// de users echouerait). Pour chaque compte dont le delai de grace (30 j) est
// ecoule :
//   1. Collecte les references storage portees par des lignes DB (audio des
//      annotations coach, file_url de media) AVANT de les supprimer.
//   2. Supprime les objets Storage du pilote (recursif, fail-closed).
//   3. rpc purge_user_data : purge + anonymisation DB transactionnelles,
//      scrub PII de la ligne users (email -> placeholder, sante -> null).
//   4. Anonymise + bannit l'utilisateur Auth (pas de hard-delete).
// =============================================================================

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.114.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const INVOKE_SECRET = Deno.env.get('EDGE_FUNCTIONS_INVOKE_SECRET') ?? '';

// Buckets ranges par prefixe `{userId}/…` (conventions verifiees dans
// src/services/*). `invoices` est CONSERVE (facturation) ; `pavillon-photos`
// et `partner-media` : hors purge automatique (cf. matrice §D).
const PREFIX_BUCKETS = [
  'vehicles',
  'documents',
  'avatars',
  'audio_briefings',
  'pilot-media',
  'session-media',
  'telemetry_raw',
  'coach-media',
];

// coach-audio : objets nommes `{annotationId}` (pas de prefixe user) -> purge
// via la liste des annotations du compte, collectee avant la purge DB.
const COACH_AUDIO_BUCKET = 'coach-audio';

const REMOVE_CHUNK = 100;

const DELETED_EMAIL = (userId: string) => `deleted-${userId}@oxv.invalid`;

Deno.serve(async (req: Request): Promise<Response> => {
  // Auth interne : seul le cron (pg_net) porteur du secret peut invoquer.
  const auth = req.headers.get('Authorization') ?? '';
  if (!INVOKE_SECRET || auth !== `Bearer ${INVOKE_SECRET}`) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Cibles : grace ecoulee ET pas deja purgees (idempotence via le placeholder).
  const { data: targets, error: selErr } = await admin
    .from('users')
    .select('id')
    .not('deletion_scheduled_at', 'is', null)
    .lte('deletion_scheduled_at', new Date().toISOString())
    .not('email', 'like', 'deleted-%@oxv.invalid');

  if (selErr) return json({ ok: false, error: selErr.message }, 500);

  const results: Record<string, string> = {};
  for (const row of targets ?? []) {
    const userId = (row as { id: string }).id;
    try {
      await purgeUser(admin, userId);
      results[userId] = 'purged';
    } catch (e) {
      results[userId] = `error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  return json({ ok: true, count: Object.keys(results).length, results });
});

async function purgeUser(admin: SupabaseClient, userId: string): Promise<void> {
  // 1. Collectes AVANT la purge DB (les lignes portent les references storage).
  const audioIds = await collectCoachAudioIds(admin, userId);
  const mediaObjects = await collectMediaObjects(admin, userId);

  // 2. Storage d'abord, fail-closed : si un retrait echoue, on s'arrete — les
  //    lignes DB restent intactes et le run suivant retrouvera le compte.
  for (const bucket of PREFIX_BUCKETS) {
    const paths = await listAllUnder(admin, bucket, userId);
    await removeChunked(admin, bucket, paths);
  }
  await removeChunked(admin, COACH_AUDIO_BUCKET, audioIds);
  // media.file_url : best-effort documente (URLs heterogenes, parfois externes).
  for (const obj of mediaObjects) {
    const { error } = await admin.storage.from(obj.bucket).remove([obj.path]);
    if (error) console.warn(`media storage ${obj.bucket}/${obj.path}: ${error.message}`);
  }

  // 3. Purge + anonymisation DB transactionnelles (tout-ou-rien) + scrub users.
  //    Voir supabase/migrations/20260719_sec1_purge_sante.sql.
  const { error: rpcErr } = await admin.rpc('purge_user_data', { p_user: userId });
  if (rpcErr) throw new Error(`purge_user_data: ${rpcErr.message}`);

  // 4. Anonymise + bannit l'utilisateur Auth (empeche la reconnexion ; pas de
  //    hard-delete pour ne pas declencher la cascade bloquee par payments).
  const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
    email: DELETED_EMAIL(userId),
    ban_duration: '876000h',
    user_metadata: {},
  });
  if (authErr) throw new Error(`auth: ${authErr.message}`);
}

/** Ids des annotations audio du compte (objets `coach-audio/{annotationId}`). */
async function collectCoachAudioIds(admin: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await admin
    .from('coach_annotations')
    .select('id')
    .eq('coach_id', userId)
    .not('audio_url', 'is', null);
  if (error) throw new Error(`coach_annotations audio: ${error.message}`);
  return (data ?? []).map((r) => (r as { id: string }).id);
}

/** Objets storage references par media.file_url (uploads staff sur le pilote). */
async function collectMediaObjects(
  admin: SupabaseClient,
  userId: string
): Promise<{ bucket: string; path: string }[]> {
  const { data, error } = await admin.from('media').select('file_url').eq('user_id', userId);
  if (error) throw new Error(`media: ${error.message}`);
  const out: { bucket: string; path: string }[] = [];
  for (const row of data ?? []) {
    const parsed = parseStorageUrl((row as { file_url: string | null }).file_url ?? '');
    if (parsed) out.push(parsed);
  }
  return out;
}

/** Extrait bucket + chemin d'une URL Supabase Storage ; null si non reconnue. */
function parseStorageUrl(fileUrl: string): { bucket: string; path: string } | null {
  const m = fileUrl.match(
    /\/storage\/v1\/object\/(?:public|authenticated|sign)\/([^/]+)\/([^?]+)/
  );
  if (!m) return null;
  return { bucket: m[1], path: decodeURIComponent(m[2]) };
}

/**
 * Liste RECURSIVE des objets sous `prefix` (la v4 ne descendait pas dans les
 * sous-dossiers : les chemins imbriques etaient silencieusement ignores).
 * Les entrees dossier de list() n'ont pas d'id -> recursion.
 */
async function listAllUnder(
  admin: SupabaseClient,
  bucket: string,
  prefix: string
): Promise<string[]> {
  const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) {
    // Bucket absent (ex. branche de dev incomplete) : rien a purger ici.
    if (/bucket.*not.*found/i.test(error.message)) return [];
    throw new Error(`storage list ${bucket}/${prefix}: ${error.message}`);
  }
  const paths: string[] = [];
  for (const entry of data ?? []) {
    const entryPath = `${prefix}/${entry.name}`;
    const isFolder = !(entry as { id?: string | null }).id;
    if (isFolder) {
      paths.push(...(await listAllUnder(admin, bucket, entryPath)));
    } else {
      paths.push(entryPath);
    }
  }
  return paths;
}

/** Retrait par lots, fail-closed (une erreur = echec du compte courant). */
async function removeChunked(
  admin: SupabaseClient,
  bucket: string,
  paths: string[]
): Promise<void> {
  for (let i = 0; i < paths.length; i += REMOVE_CHUNK) {
    const chunk = paths.slice(i, i + REMOVE_CHUNK);
    const { error } = await admin.storage.from(bucket).remove(chunk);
    if (error) {
      if (/bucket.*not.*found/i.test(error.message)) return;
      throw new Error(`storage remove ${bucket}: ${error.message}`);
    }
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
