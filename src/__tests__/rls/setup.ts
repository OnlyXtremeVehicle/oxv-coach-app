/**
 * Setup helpers pour les tests RLS coach.
 *
 * Crée des comptes éphémères (coach + pilote) sur un projet Supabase
 * de test, exécute les scénarios RLS, nettoie après chaque test.
 *
 * Pré-requis env (sinon les tests sont skippés) :
 *   - TEST_SUPABASE_URL       : URL projet Supabase de test (branch ci-test)
 *   - TEST_SUPABASE_SERVICE_KEY : service_role key du projet de test
 *
 * On utilise un PROJET DE TEST séparé du projet prod pour éviter toute
 * contamination de données réelles. Voir docs/TESTS_RLS_SETUP.md pour
 * créer une Supabase Branch ci-test.
 *
 * Les tests créent des users via l'API admin (service_role), puis
 * obtiennent un client authentifié (anon key + JWT) pour vérifier les
 * RLS du point de vue de chaque rôle.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * CES 85 TESTS N'ONT JAMAIS TOURNÉ — mesuré le 02/09/2026.
 *
 * `gh api repos/OnlyXtremeVehicle/oxv-coach-app/actions/secrets` rend
 * `{"total_count": 0}` : le dépôt n'a jamais porté `TEST_SUPABASE_URL` ni
 * `TEST_SUPABASE_SERVICE_KEY`, donc ce drapeau a toujours valu `false`, donc
 * chaque suite est passée en `describe.skip` depuis son écriture.
 *
 * Ce n'est PAS un vert silencieux, et il faut le dire précisément : la CI
 * (`.github/workflows/check.yml`) échoue en dur — `exit 1` — dès qu'on est en
 * pull request ou sur `main`. La porte tient donc là où elle compte. Ce qui ne
 * tient pas, c'est ici : sur une branche de travail, `npm test` affiche « 18
 * suites skipped » sans dire lesquelles ni pourquoi, et une suite anonyme qu'on
 * ne lance pas ressemble beaucoup à une suite qui passe.
 *
 * C'est ainsi qu'un défaut de cette aide a survécu DIX SEMAINES : depuis L32
 * (02/08), `assignCoachToPilot` posait des affiliations que le déclencheur
 * refermait aussitôt, et pas un seul des 27 appels ne pouvait le signaler.
 *
 * SORTIE : créer un projet Supabase de TEST — jamais la production — et poser
 * ses deux clés dans les secrets GitHub. Voir `docs/architecture/17_CI_RLS_SETUP.md`.
 */
export const RLS_TEST_ENABLED =
  Boolean(process.env.TEST_SUPABASE_URL) && Boolean(process.env.TEST_SUPABASE_SERVICE_KEY);

if (!RLS_TEST_ENABLED && process.env.CI !== 'true') {
  // Une ligne, une fois, au chargement. Le silence est ce qui a coûté dix
  // semaines ; on ne le reproduit pas, et on ne hurle pas non plus.
  console.warn(
    '[OXV][RLS] 85 tests de politique NON EXÉCUTÉS — TEST_SUPABASE_URL / ' +
      'TEST_SUPABASE_SERVICE_KEY absents. Ils sont bloquants en pull request et ' +
      'sur main. Voir docs/architecture/17_CI_RLS_SETUP.md.'
  );
}

const SUPABASE_URL = process.env.TEST_SUPABASE_URL ?? '';
const SERVICE_KEY = process.env.TEST_SUPABASE_SERVICE_KEY ?? '';
const ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY ?? '';

/**
 * Client admin (service_role) — bypass RLS. Sert UNIQUEMENT à créer/
 * supprimer des users de test et à seed des données. Jamais utilisé pour
 * tester les policies elles-mêmes.
 */
export function adminClient(): SupabaseClient {
  if (!RLS_TEST_ENABLED) {
    throw new Error(
      'RLS tests not enabled — TEST_SUPABASE_URL / TEST_SUPABASE_SERVICE_KEY missing'
    );
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Client authentifié comme user X — respecte les RLS. C'est ce client
 * qu'on utilise pour vérifier ce qu'un user peut/ne peut pas voir.
 */
export async function userClient(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Cannot sign in test user ${email} : ${error.message}`);
  return client;
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  role: 'pilot' | 'coach' | 'admin' | 'partner';
}

/**
 * Crée un user de test via l'API admin avec un email/password aléatoire.
 * Insère aussi la ligne `users` correspondante (trigger Supabase Auth
 * ne le fait pas automatiquement pour les projets OXV).
 */
export async function createTestUser(
  role: 'pilot' | 'coach' | 'admin' | 'partner'
): Promise<TestUser> {
  const admin = adminClient();
  const email = `rls-test-${role}-${Date.now()}-${Math.floor(Math.random() * 10000)}@oxv.test`;
  const password = `T3st-${Math.random().toString(36).slice(2)}-${Date.now()}`;

  // 1. Crée le user Auth
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authErr || !authData.user) {
    throw new Error(`createUser failed: ${authErr?.message ?? 'no data'}`);
  }
  const userId = authData.user.id;

  // 2. Insère la ligne users (la table métier OXV)
  const { error: usersErr } = await admin.from('users').insert({
    id: userId,
    email,
    first_name: `Test${role}`,
    last_name: 'RLS',
    role,
    is_admin: role === 'admin',
    pact_accepted_at: new Date().toISOString(),
    cgu_accepted_at: new Date().toISOString(),
    privacy_accepted_at: new Date().toISOString(),
  } as never);
  if (usersErr) {
    // Cleanup auth si users insert fail
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    throw new Error(`users insert failed: ${usersErr.message}`);
  }

  return { id: userId, email, password, role };
}

/**
 * Crée une assignation coach-pilot ACCEPTÉE dans `coach_pilots`.
 *
 * Elle naît `status = 'active'`, et c'est `status` qui commande : depuis L32
 * (02/08/2026), `active` n'est plus qu'une vue de cette colonne, entretenue par
 * un déclencheur. Voir le corps pour ce que l'ancienne écriture provoquait.
 *
 * Si `consented`, remplit aussi `pilot_consent_at`. Les deux axes restent
 * SÉPARÉS : les trois appels `consented = false` du dépôt restent négatifs par
 * la seule clause `pilot_consent_at is not null`, sans dépendre du statut.
 *
 * `level` fixe le niveau de lecture gradué (§6/§23) — par défaut
 * `lecture_detaillee` (accès complet, comportement legacy).
 */
export async function assignCoachToPilot(
  coachId: string,
  pilotId: string,
  consented: boolean,
  level: 'lecture_simple' | 'lecture_detaillee' | 'programme' = 'lecture_detaillee'
): Promise<string> {
  const admin = adminClient();
  const { data, error } = (await admin
    .from('coach_pilots')
    .insert({
      coach_id: coachId,
      pilot_id: pilotId,
      pilot_consent_at: consented ? new Date().toISOString() : null,
      // `active` est DÉRIVÉE de `status` par `trg_aligner_active_sur_status`
      // (migration 20260802183047, L32) : l'écrire à la main ne sert à rien, le
      // déclencheur l'écrase aussitôt à `(status = 'active')`. Le commentaire de
      // colonne posé par cette migration le dit en toutes lettres — « DÉRIVÉE de
      // status — ne pas écrire à la main ».
      //
      // Cette aide écrivait `active: true` depuis le 25/05/2026, dix semaines
      // AVANT le déclencheur. Depuis le 02/08, toute affiliation qu'elle pose
      // naît donc `status='pending'`, donc `active=false`, et les trois
      // fonctions d'accès rendent `false` : les assertions POSITIVES des huit
      // suites RLS côté coach ne peuvent pas passer.
      //
      // Personne ne l'a vu parce que ces 85 tests n'ont jamais tourné : le
      // dépôt n'a aucun secret `TEST_SUPABASE_*`, `RLS_TEST_ENABLED` est faux,
      // et tout est `describe.skip`. Une garde qu'on ne lance pas ne garde rien.
      status: 'active',
      level,
    } as never)
    .select('id')
    .single()) as unknown as { data: { id: string } | null; error: { message: string } | null };
  if (error || !data) throw new Error(`assignCoachToPilot failed: ${error?.message ?? 'no data'}`);
  return data.id;
}

/** Insère une frame télémétrie minimale pour une session (donnée DÉTAILLÉE). */
export async function createTestFrame(sessionId: string): Promise<void> {
  const admin = adminClient();
  const { error } = await admin
    .from('telemetry_frames')
    .insert({ session_id: sessionId, elapsed_ms: 0 } as never);
  if (error) throw new Error(`createTestFrame failed: ${error.message}`);
}

/** Insère une analyse de segment (virage) minimale pour une session/pilote (donnée DÉTAILLÉE). */
export async function createTestSegmentAnalysis(sessionId: string, pilotId: string): Promise<void> {
  const admin = adminClient();
  const { error } = await admin
    .from('app_segment_analyses')
    .insert({ telemetry_session_id: sessionId, user_id: pilotId, segment_index: 0 } as never);
  if (error) throw new Error(`createTestSegmentAnalysis failed: ${error.message}`);
}

/**
 * Crée une session minimale pour un pilote et renvoie son id.
 */
export async function createTestSession(pilotId: string): Promise<string> {
  const admin = adminClient();
  const { data, error } = await admin
    .from('telemetry_sessions')
    .insert({
      user_id: pilotId,
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
      status: 'completed',
      circuit_name: 'Test Circuit',
    } as never)
    .select('id')
    .single();
  if (error || !data) throw new Error(`createTestSession failed: ${error?.message ?? 'no data'}`);
  return (data as { id: string }).id;
}

/**
 * Cleanup : supprime cascade tous les users créés. Les tables liées
 * (sessions, annotations, etc.) cascadent via ON DELETE CASCADE.
 */
export async function cleanupTestUsers(users: TestUser[]): Promise<void> {
  const admin = adminClient();
  for (const u of users) {
    await admin.auth.admin.deleteUser(u.id).catch(() => undefined);
    // Cleanup users row au cas où le trigger cascade ne couvre pas
    await admin
      .from('users')
      .delete()
      .eq('id', u.id)
      .then(
        () => undefined,
        () => undefined
      );
  }
}
