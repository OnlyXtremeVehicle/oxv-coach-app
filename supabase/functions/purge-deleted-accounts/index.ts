// =============================================================================
// purge-deleted-accounts — Droit a l'effacement RGPD (art. 17), charte 12 / S3.
//
// /!\ DRAFT — A VALIDER JURIDIQUEMENT et a TESTER sur une branche Supabase de
// dev (donnees de seed) AVANT tout deploiement en prod. Cette fonction SUPPRIME
// des donnees utilisateur de facon IRREVERSIBLE.
//
// Declenchee par pg_cron (quotidien) via pg_net, avec un Bearer = secret interne
// (edge_functions_invoke_secret, depuis Vault). verify_jwt = false (auto-auth).
// Voir README.md pour le deploiement + la planification cron.
//
// STRATEGIE : ANONYMISER-ET-PURGER (pas de hard-delete de la ligne users), car
// payments.user_id est NO ACTION (facturation legalement conservee -> un DELETE
// de users echouerait). Pour chaque compte dont le delai de grace (30 j) est
// ecoule :
//   1. Supprime les donnees personnelles effacables (telemetrie -> cascade
//      frames/laps/meteo, vehicules, documents, analyses, partages, circuits
//      perso, donnees coach, amities, objectifs, medias pilote, push).
//   2. Supprime les objets Storage du pilote (vehicules, documents, avatars,
//      audio) par prefixe userId.
//   3. Scrubbe le PII de la ligne users (email -> placeholder ; noms, adresse,
//      contacts d'urgence, donnees medicales, handle, avatar -> null). La ligne
//      reste pour le lien facturation.
//   4. Anonymise + bannit l'utilisateur Auth (pas de hard-delete : la cascade
//      auth.users -> public.users serait bloquee par payments). Empeche toute
//      reconnexion.
//
// POINTS A VALIDER (juridique + produit) avant deploiement :
//   - CONSERVES (obligation legale facturation) : payments, registrations,
//     stripe_customer_id. Confirmer la duree de retention + l'eventuelle
//     suppression cote Stripe (l'effacement Stripe est un appel API separe).
//   - medical_notes / blood_type : donnees de SANTE -> scrub confirme ici.
//   - email_log conserve les emails envoyes (PII residuel) : a arbitrer
//     (suppression vs retention pour audit de delivrabilite).
//   - Revoir la liste PERSONAL_TABLES de facon exhaustive a chaque nouvelle
//     table portant de la donnee personnelle.
// =============================================================================

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const INVOKE_SECRET = Deno.env.get('EDGE_FUNCTIONS_INVOKE_SECRET') ?? '';

// Tables de donnees personnelles a supprimer explicitement (la ligne users est
// conservee -> la cascade ON DELETE ne se declenche pas). On NE supprime PAS
// payments / registrations (facturation). Colonnes issues de l'audit des FK.
const PERSONAL_TABLES: { table: string; column: string }[] = [
  { table: 'telemetry_sessions', column: 'user_id' }, // -> cascade frames/laps/weather
  { table: 'vehicles', column: 'user_id' },
  { table: 'documents', column: 'user_id' },
  { table: 'app_session_analyses', column: 'user_id' },
  { table: 'app_segment_analyses', column: 'user_id' },
  { table: 'app_progression_shares', column: 'user_id' },
  { table: 'circuits', column: 'user_id' },
  { table: 'heritage_packs', column: 'user_id' },
  { table: 'ritual_dispatches', column: 'user_id' },
  { table: 'pilot_goals', column: 'user_id' },
  { table: 'session_media', column: 'pilot_user_id' },
  { table: 'coach_permissions', column: 'user_id' },
  { table: 'coach_pilots', column: 'pilot_id' },
  { table: 'coach_pilots', column: 'coach_id' },
  { table: 'coach_session_context', column: 'coach_id' },
  { table: 'coach_session_context', column: 'pilot_id' },
  { table: 'coach_corner_reference', column: 'coach_id' },
  { table: 'coach_reading_weights', column: 'coach_id' },
  { table: 'coach_roulages', column: 'coach_id' },
  { table: 'roulage_invitations', column: 'pilot_id' },
  { table: 'pilot_friendships', column: 'initiator_id' },
  { table: 'pilot_friendships', column: 'pilot_a' },
  { table: 'pilot_friendships', column: 'pilot_b' },
];

const STORAGE_BUCKETS = ['vehicles', 'documents', 'avatars', 'audio_briefings'];

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
  // 1. Donnees personnelles.
  for (const { table, column } of PERSONAL_TABLES) {
    const { error } = await admin.from(table).delete().eq(column, userId);
    if (error) throw new Error(`${table}.${column}: ${error.message}`);
  }

  // 2. Storage (best-effort, par prefixe userId/).
  for (const bucket of STORAGE_BUCKETS) {
    const { data: files } = await admin.storage.from(bucket).list(userId);
    if (files && files.length > 0) {
      await admin.storage.from(bucket).remove(files.map((f) => `${userId}/${f.name}`));
    }
  }

  // 3. Scrub PII de la ligne users (conservee pour le lien facturation).
  const { error: scrubErr } = await admin
    .from('users')
    .update({
      email: DELETED_EMAIL(userId),
      first_name: null,
      last_name: null,
      birth_date: null,
      phone: null,
      address_line: null,
      address_zip: null,
      address_city: null,
      address_country: null,
      emergency_contact_name: null,
      emergency_contact_phone: null,
      emergency_contact_relation: null,
      blood_type: null,
      medical_notes: null,
      ffsa_license: null,
      experience_years: null,
      avatar_url: null,
      public_handle: null,
      admin_notes: null,
      expo_push_token: null,
      notification_preferences: null,
      // stripe_customer_id : CONSERVE (reconciliation facturation — a confirmer).
    })
    .eq('id', userId);
  if (scrubErr) throw new Error(`users scrub: ${scrubErr.message}`);

  // 4. Anonymise + bannit l'utilisateur Auth (empeche la reconnexion ; pas de
  //    hard-delete pour ne pas declencher la cascade bloquee par payments).
  const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
    email: DELETED_EMAIL(userId),
    ban_duration: '876000h',
    user_metadata: {},
  });
  if (authErr) throw new Error(`auth: ${authErr.message}`);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
