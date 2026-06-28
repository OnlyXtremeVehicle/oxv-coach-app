/**
 * Tests RLS — matrice rôle × télémétrie (PR-13, dette P0-2).
 *
 * Codifie la RÈGLE CARDINALE de la doctrine (07_DATA_POLICY §148) : **le
 * partenaire ne voit JAMAIS la télémétrie**, et un pilote ne voit que la sienne.
 * Ces tests échoueraient si une future migration ouvrait par erreur les tables
 * télémétrie à un autre rôle.
 *
 * Skip automatique si TEST_SUPABASE_URL / TEST_SUPABASE_SERVICE_KEY absents.
 */

import {
  RLS_TEST_ENABLED,
  type TestUser,
  cleanupTestUsers,
  createTestFrame,
  createTestSession,
  createTestUser,
  userClient,
} from './setup';

const describeIf = RLS_TEST_ENABLED ? describe : describe.skip;

describeIf('RLS — matrice rôle × télémétrie', () => {
  const created: TestUser[] = [];
  afterAll(async () => {
    await cleanupTestUsers(created);
  });

  it('NÉGATIF — un partenaire ne voit AUCUNE session ni trame télémétrie', async () => {
    const pilot = await createTestUser('pilot');
    const partner = await createTestUser('partner');
    created.push(pilot, partner);
    const sessionId = await createTestSession(pilot.id);
    await createTestFrame(sessionId);

    const c = await userClient(partner.email, partner.password);
    expect(
      (await c.from('telemetry_sessions').select('id').eq('id', sessionId)).data ?? []
    ).toHaveLength(0);
    expect(
      (await c.from('telemetry_frames').select('id').eq('session_id', sessionId)).data ?? []
    ).toHaveLength(0);
  });

  it('NÉGATIF — un pilote ne voit pas la session d un autre pilote', async () => {
    const a = await createTestUser('pilot');
    const b = await createTestUser('pilot');
    created.push(a, b);
    const sessionId = await createTestSession(a.id);

    const cb = await userClient(b.email, b.password);
    expect(
      (await cb.from('telemetry_sessions').select('id').eq('id', sessionId)).data ?? []
    ).toHaveLength(0);
  });

  it('POSITIF — le pilote voit SA propre session', async () => {
    const a = await createTestUser('pilot');
    created.push(a);
    const sessionId = await createTestSession(a.id);

    const ca = await userClient(a.email, a.password);
    expect(
      (await ca.from('telemetry_sessions').select('id').eq('id', sessionId)).data ?? []
    ).toHaveLength(1);
  });
});
