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

export const RLS_TEST_ENABLED =
  Boolean(process.env.TEST_SUPABASE_URL) && Boolean(process.env.TEST_SUPABASE_SERVICE_KEY);

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
  role: 'pilot' | 'coach' | 'admin';
}

/**
 * Crée un user de test via l'API admin avec un email/password aléatoire.
 * Insère aussi la ligne `users` correspondante (trigger Supabase Auth
 * ne le fait pas automatiquement pour les projets OXV).
 */
export async function createTestUser(role: 'pilot' | 'coach' | 'admin'): Promise<TestUser> {
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
 * Crée une assignation coach-pilot dans `coach_pilots`. Si `consented`,
 * remplit aussi `pilot_consent_at`.
 */
export async function assignCoachToPilot(
  coachId: string,
  pilotId: string,
  consented: boolean
): Promise<string> {
  const admin = adminClient();
  const { data, error } = (await admin
    .from('coach_pilots')
    .insert({
      coach_id: coachId,
      pilot_id: pilotId,
      pilot_consent_at: consented ? new Date().toISOString() : null,
      active: true,
    } as never)
    .select('id')
    .single()) as unknown as { data: { id: string } | null; error: { message: string } | null };
  if (error || !data) throw new Error(`assignCoachToPilot failed: ${error?.message ?? 'no data'}`);
  return data.id;
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
