/**
 * Tests RLS pour pilot_friendships (Feature Duel pédagogique).
 *
 * Vérifie :
 *   - Création d'une demande : seul l'initiator peut, et il doit être membre.
 *   - Self-friendship interdite.
 *   - Non-membre ne SELECT pas la friendship.
 *   - Acceptation : le destinataire peut passer status pending → accepted.
 *   - Accès élargi : ami accepté peut SELECT app_session_analyses du pilote.
 *   - Isolement : non-ami ne peut PAS lire les bilans d'un autre.
 *
 * Skip auto si TEST_SUPABASE_URL absent.
 */

import {
  RLS_TEST_ENABLED,
  adminClient,
  cleanupTestUsers,
  createTestUser,
  type TestUser,
  userClient,
} from './setup';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function seedAnalysis(adminClient: any, pilotId: string, sessionId: string): Promise<void> {
  await adminClient.from('app_session_analyses').insert({
    telemetry_session_id: sessionId,
    user_id: pilotId,
    margin_global: 42,
    margin_zone: 'green',
    margin_vehicle: 80,
    margin_pilot: 65,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function seedSession(adminClient: any, pilotId: string): Promise<string> {
  const { data } = await adminClient
    .from('telemetry_sessions')
    .insert({
      user_id: pilotId,
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
      status: 'completed',
      circuit_name: 'Beltoise',
    })
    .select('id')
    .single();
  return (data as { id: string }).id;
}

function canonicalPair(a: string, b: string): { pilotA: string; pilotB: string } {
  return a < b ? { pilotA: a, pilotB: b } : { pilotA: b, pilotB: a };
}

(RLS_TEST_ENABLED ? describe : describe.skip)('RLS pilot_friendships', () => {
  let alice: TestUser;
  let bob: TestUser;
  let carol: TestUser; // tiers non-membre
  let aliceSessionId: string;
  let bobSessionId: string;

  beforeAll(async () => {
    alice = await createTestUser('pilot');
    bob = await createTestUser('pilot');
    carol = await createTestUser('pilot');
    const admin = adminClient();
    aliceSessionId = await seedSession(admin, alice.id);
    bobSessionId = await seedSession(admin, bob.id);
    await seedAnalysis(admin, alice.id, aliceSessionId);
    await seedAnalysis(admin, bob.id, bobSessionId);
  });

  afterAll(async () => {
    await cleanupTestUsers([alice, bob, carol]);
  });

  beforeEach(async () => {
    // Reset friendships entre tests pour isolation
    const admin = adminClient();
    await admin
      .from('pilot_friendships')
      .delete()
      .or(`pilot_a.eq.${alice.id},pilot_a.eq.${bob.id},pilot_a.eq.${carol.id}`);
  });

  test('Alice ne peut pas envoyer une demande à elle-même', async () => {
    const client = await userClient(alice.email, alice.password);
    const { pilotA, pilotB } = canonicalPair(alice.id, alice.id);
    const { error } = await client.from('pilot_friendships').insert({
      pilot_a: pilotA,
      pilot_b: pilotB,
      initiator_id: alice.id,
      status: 'pending',
    } as never);
    expect(error).not.toBeNull(); // bloqué par CHECK pilot_a < pilot_b
  });

  test('Alice peut envoyer une demande à Bob (initiator = self, membre de la paire)', async () => {
    const client = await userClient(alice.email, alice.password);
    const { pilotA, pilotB } = canonicalPair(alice.id, bob.id);
    const { error } = await client.from('pilot_friendships').insert({
      pilot_a: pilotA,
      pilot_b: pilotB,
      initiator_id: alice.id,
      status: 'pending',
    } as never);
    expect(error).toBeNull();
  });

  test('Alice ne peut PAS créer une friendship en se déclarant initiator pour Carol→Bob', async () => {
    const client = await userClient(alice.email, alice.password);
    const { pilotA, pilotB } = canonicalPair(carol.id, bob.id);
    const { error } = await client.from('pilot_friendships').insert({
      pilot_a: pilotA,
      pilot_b: pilotB,
      initiator_id: carol.id, // pas Alice
      status: 'pending',
    } as never);
    // RLS bloque : initiator_id != auth.uid()
    expect(error).not.toBeNull();
  });

  test('Carol (non-membre) ne SELECT pas une friendship Alice↔Bob', async () => {
    const admin = adminClient();
    const { pilotA, pilotB } = canonicalPair(alice.id, bob.id);
    await admin.from('pilot_friendships').insert({
      pilot_a: pilotA,
      pilot_b: pilotB,
      initiator_id: alice.id,
      status: 'pending',
    } as never);

    const client = await userClient(carol.email, carol.password);
    const { data } = await client
      .from('pilot_friendships')
      .select('id')
      .eq('pilot_a', pilotA)
      .eq('pilot_b', pilotB);
    expect(data ?? []).toHaveLength(0);
  });

  test('Bob (destinataire) peut SELECT la friendship et la passer en accepted', async () => {
    const admin = adminClient();
    const { pilotA, pilotB } = canonicalPair(alice.id, bob.id);
    const { data: created } = await admin
      .from('pilot_friendships')
      .insert({
        pilot_a: pilotA,
        pilot_b: pilotB,
        initiator_id: alice.id,
        status: 'pending',
      } as never)
      .select('id')
      .single();
    const friendshipId = (created as { id: string }).id;

    const client = await userClient(bob.email, bob.password);
    const { data: visible } = await client
      .from('pilot_friendships')
      .select('id, status')
      .eq('id', friendshipId)
      .single();
    expect(visible).not.toBeNull();
    expect((visible as { status: string }).status).toBe('pending');

    const { error } = await client
      .from('pilot_friendships')
      .update({ status: 'accepted', responded_at: new Date().toISOString() } as never)
      .eq('id', friendshipId);
    expect(error).toBeNull();
  });

  test('Carol (non-membre) NE peut PAS UPDATE une friendship Alice↔Bob', async () => {
    const admin = adminClient();
    const { pilotA, pilotB } = canonicalPair(alice.id, bob.id);
    const { data: created } = await admin
      .from('pilot_friendships')
      .insert({
        pilot_a: pilotA,
        pilot_b: pilotB,
        initiator_id: alice.id,
        status: 'pending',
      } as never)
      .select('id')
      .single();
    const friendshipId = (created as { id: string }).id;

    const client = await userClient(carol.email, carol.password);
    const { error, count } = await client
      .from('pilot_friendships')
      .update({ status: 'accepted' } as never, { count: 'exact' })
      .eq('id', friendshipId);
    // Pas d'erreur mais 0 row affecté (RLS filtre silencieusement)
    expect(error).toBeNull();
    expect(count ?? 0).toBe(0);
  });

  test('Quand Alice et Bob sont amis, Alice peut SELECT app_session_analyses de Bob', async () => {
    const admin = adminClient();
    const { pilotA, pilotB } = canonicalPair(alice.id, bob.id);
    await admin.from('pilot_friendships').insert({
      pilot_a: pilotA,
      pilot_b: pilotB,
      initiator_id: alice.id,
      status: 'accepted',
      responded_at: new Date().toISOString(),
    } as never);

    const client = await userClient(alice.email, alice.password);
    const { data, error } = await client
      .from('app_session_analyses')
      .select('id, user_id, margin_global')
      .eq('user_id', bob.id);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  test('Carol (non-amie) NE peut PAS SELECT app_session_analyses de Bob', async () => {
    // Pas de friendship Carol↔Bob
    const client = await userClient(carol.email, carol.password);
    const { data } = await client
      .from('app_session_analyses')
      .select('id, user_id')
      .eq('user_id', bob.id);
    expect(data ?? []).toHaveLength(0);
  });

  test("Si la friendship est seulement 'pending', Alice ne voit toujours PAS les bilans de Bob", async () => {
    const admin = adminClient();
    const { pilotA, pilotB } = canonicalPair(alice.id, bob.id);
    await admin.from('pilot_friendships').insert({
      pilot_a: pilotA,
      pilot_b: pilotB,
      initiator_id: alice.id,
      status: 'pending', // pas encore acceptée
    } as never);

    const client = await userClient(alice.email, alice.password);
    const { data } = await client
      .from('app_session_analyses')
      .select('id')
      .eq('user_id', bob.id);
    expect(data ?? []).toHaveLength(0);
  });

  test("Après 'revoked', Alice ne voit plus les bilans de Bob", async () => {
    const admin = adminClient();
    const { pilotA, pilotB } = canonicalPair(alice.id, bob.id);
    await admin.from('pilot_friendships').insert({
      pilot_a: pilotA,
      pilot_b: pilotB,
      initiator_id: alice.id,
      status: 'revoked',
      responded_at: new Date().toISOString(),
    } as never);

    const client = await userClient(alice.email, alice.password);
    const { data } = await client
      .from('app_session_analyses')
      .select('id')
      .eq('user_id', bob.id);
    expect(data ?? []).toHaveLength(0);
  });

  test('Alice (amie de Bob) NE peut PAS UPDATE/DELETE une analyse de Bob (read-only)', async () => {
    const admin = adminClient();
    const { pilotA, pilotB } = canonicalPair(alice.id, bob.id);
    await admin.from('pilot_friendships').insert({
      pilot_a: pilotA,
      pilot_b: pilotB,
      initiator_id: alice.id,
      status: 'accepted',
      responded_at: new Date().toISOString(),
    } as never);

    const client = await userClient(alice.email, alice.password);
    const { error: upErr, count: upCount } = await client
      .from('app_session_analyses')
      .update({ margin_global: 99 } as never, { count: 'exact' })
      .eq('user_id', bob.id);
    expect(upErr).toBeNull();
    expect(upCount ?? 0).toBe(0);

    const { error: delErr, count: delCount } = await client
      .from('app_session_analyses')
      .delete({ count: 'exact' })
      .eq('user_id', bob.id);
    expect(delErr).toBeNull();
    expect(delCount ?? 0).toBe(0);
  });
});
