/**
 * Tests RLS — accès coach aux sessions des pilotes.
 *
 * Vérifie les policies définies en migration 0016 :
 *   - telemetry_sessions_coach_select : un coach voit les sessions
 *     d'un pilote uniquement si is_coach_of(user_id) === true,
 *     c'est-à-dire :
 *       a) une ligne `coach_pilots` existe (coach_id, pilot_id, active=true)
 *       b) ET pilot_consent_at IS NOT NULL
 *
 * Skip automatique si TEST_SUPABASE_URL / TEST_SUPABASE_SERVICE_KEY
 * ne sont pas en env (CI standard).
 */

import {
  RLS_TEST_ENABLED,
  type TestUser,
  adminClient,
  assignCoachToPilot,
  cleanupTestUsers,
  createTestSession,
  createTestUser,
  userClient,
} from './setup';

const describeIf = RLS_TEST_ENABLED ? describe : describe.skip;

describeIf('RLS — coach access to pilot sessions', () => {
  const created: TestUser[] = [];

  afterAll(async () => {
    await cleanupTestUsers(created);
  });

  it("Coach non-assigné ne voit pas les sessions d'un pilote", async () => {
    const coach = await createTestUser('coach');
    const pilot = await createTestUser('pilot');
    created.push(coach, pilot);

    const sessionId = await createTestSession(pilot.id);

    const coachClient = await userClient(coach.email, coach.password);
    const { data } = await coachClient.from('telemetry_sessions').select('id').eq('id', sessionId);

    expect(data ?? []).toHaveLength(0);
  });

  it('Coach assigné mais pilote non-consentant ne voit pas les sessions', async () => {
    const coach = await createTestUser('coach');
    const pilot = await createTestUser('pilot');
    created.push(coach, pilot);

    await assignCoachToPilot(coach.id, pilot.id, false); // pas consenti
    const sessionId = await createTestSession(pilot.id);

    const coachClient = await userClient(coach.email, coach.password);
    const { data } = await coachClient.from('telemetry_sessions').select('id').eq('id', sessionId);

    expect(data ?? []).toHaveLength(0);
  });

  it('Coach assigné + pilote consentant VOIT les sessions', async () => {
    const coach = await createTestUser('coach');
    const pilot = await createTestUser('pilot');
    created.push(coach, pilot);

    await assignCoachToPilot(coach.id, pilot.id, true); // consenti
    const sessionId = await createTestSession(pilot.id);

    const coachClient = await userClient(coach.email, coach.password);
    const { data, error } = await coachClient
      .from('telemetry_sessions')
      .select('id')
      .eq('id', sessionId);

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(1);
  });

  it("Coach ne peut PAS modifier une session d'un pilote suivi", async () => {
    const coach = await createTestUser('coach');
    const pilot = await createTestUser('pilot');
    created.push(coach, pilot);

    await assignCoachToPilot(coach.id, pilot.id, true);
    const sessionId = await createTestSession(pilot.id);

    const coachClient = await userClient(coach.email, coach.password);
    const { error } = await coachClient
      .from('telemetry_sessions')
      .update({ circuit_name: 'PIRATED' })
      .eq('id', sessionId);

    // RLS bloque silencieusement les UPDATE (pas d'erreur, mais 0 ligne touchée)
    // On vérifie que la donnée est intacte via le client admin
    const admin = adminClient();
    const { data: check } = await admin
      .from('telemetry_sessions')
      .select('circuit_name')
      .eq('id', sessionId)
      .single();
    expect((check as { circuit_name: string } | null)?.circuit_name).toBe('Test Circuit');
    expect(error).toBeNull(); // RLS bloque silencieusement, pas d'erreur explicite
  });

  it("Pilote autre ne voit pas les sessions d'un autre pilote", async () => {
    const pilotA = await createTestUser('pilot');
    const pilotB = await createTestUser('pilot');
    created.push(pilotA, pilotB);

    const sessionId = await createTestSession(pilotA.id);

    const clientB = await userClient(pilotB.email, pilotB.password);
    const { data } = await clientB.from('telemetry_sessions').select('id').eq('id', sessionId);

    expect(data ?? []).toHaveLength(0);
  });
});
