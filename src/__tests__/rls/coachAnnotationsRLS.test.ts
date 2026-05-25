/**
 * Tests RLS — annotations coach sur les virages d'un pilote.
 *
 * Vérifie les policies définies en migration 0020 :
 *   - coach_annotations_coach_all : un coach peut CRUD ses propres
 *     annotations uniquement sur un pilote qu'il suit (is_coach_of).
 *   - coach_annotations_pilot_select : un pilote voit les annotations
 *     where pilot_id = auth.uid() AND visibility = 'shared' AND
 *     deleted_at IS NULL.
 *
 * Skip automatique si TEST_SUPABASE_URL absent.
 */

import {
  RLS_TEST_ENABLED,
  type TestUser,
  adminClient,
  assignCoachToPilot,
  cleanupTestUsers,
  createTestUser,
  userClient,
} from './setup';

const describeIf = RLS_TEST_ENABLED ? describe : describe.skip;

describeIf('RLS — coach annotations', () => {
  const created: TestUser[] = [];

  afterAll(async () => {
    await cleanupTestUsers(created);
  });

  it('Coach assigné peut INSERT une annotation partagée', async () => {
    const coach = await createTestUser('coach');
    const pilot = await createTestUser('pilot');
    created.push(coach, pilot);
    await assignCoachToPilot(coach.id, pilot.id, true);

    const coachClient = await userClient(coach.email, coach.password);
    const { data, error } = await coachClient
      .from('coach_annotations')
      .insert({
        coach_id: coach.id,
        pilot_id: pilot.id,
        corner_index: 3,
        body: 'Test annotation',
        visibility: 'shared',
      })
      .select('id')
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });

  it('Coach non-assigné ne peut PAS INSERT sur un pilote', async () => {
    const coach = await createTestUser('coach');
    const pilot = await createTestUser('pilot');
    created.push(coach, pilot);
    // pas d'assignation

    const coachClient = await userClient(coach.email, coach.password);
    const { error } = await coachClient.from('coach_annotations').insert({
      coach_id: coach.id,
      pilot_id: pilot.id,
      corner_index: 3,
      body: 'Should not work',
      visibility: 'shared',
    });

    expect(error).not.toBeNull(); // RLS WITH CHECK refuse explicitement
  });

  it('Pilote VOIT les annotations partagées de ses coachs', async () => {
    const coach = await createTestUser('coach');
    const pilot = await createTestUser('pilot');
    created.push(coach, pilot);
    await assignCoachToPilot(coach.id, pilot.id, true);

    // Insert via admin pour bypasser RLS coach
    const admin = adminClient();
    await admin.from('coach_annotations').insert({
      coach_id: coach.id,
      pilot_id: pilot.id,
      corner_index: 5,
      body: 'Note partagée',
      visibility: 'shared',
    } as never);

    const pilotClient = await userClient(pilot.email, pilot.password);
    const { data, error } = await pilotClient
      .from('coach_annotations')
      .select('body, visibility')
      .eq('pilot_id', pilot.id);

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(1);
    const first = (data as { body: string; visibility: string }[])[0];
    expect(first.visibility).toBe('shared');
  });

  it('Pilote ne voit PAS les annotations en brouillon (private)', async () => {
    const coach = await createTestUser('coach');
    const pilot = await createTestUser('pilot');
    created.push(coach, pilot);
    await assignCoachToPilot(coach.id, pilot.id, true);

    const admin = adminClient();
    await admin.from('coach_annotations').insert({
      coach_id: coach.id,
      pilot_id: pilot.id,
      corner_index: 5,
      body: 'Brouillon coach',
      visibility: 'private',
    } as never);

    const pilotClient = await userClient(pilot.email, pilot.password);
    const { data } = await pilotClient
      .from('coach_annotations')
      .select('id')
      .eq('pilot_id', pilot.id);

    expect(data ?? []).toHaveLength(0);
  });

  it('Pilote ne voit PAS les annotations soft-deleted', async () => {
    const coach = await createTestUser('coach');
    const pilot = await createTestUser('pilot');
    created.push(coach, pilot);
    await assignCoachToPilot(coach.id, pilot.id, true);

    const admin = adminClient();
    await admin.from('coach_annotations').insert({
      coach_id: coach.id,
      pilot_id: pilot.id,
      corner_index: 5,
      body: 'Supprimée',
      visibility: 'shared',
      deleted_at: new Date().toISOString(),
    } as never);

    const pilotClient = await userClient(pilot.email, pilot.password);
    const { data } = await pilotClient
      .from('coach_annotations')
      .select('id')
      .eq('pilot_id', pilot.id);

    expect(data ?? []).toHaveLength(0);
  });

  it("Coach ne voit PAS les annotations d'un autre coach sur le même pilote", async () => {
    const coachA = await createTestUser('coach');
    const coachB = await createTestUser('coach');
    const pilot = await createTestUser('pilot');
    created.push(coachA, coachB, pilot);
    await assignCoachToPilot(coachA.id, pilot.id, true);
    await assignCoachToPilot(coachB.id, pilot.id, true);

    // Coach A annote
    const admin = adminClient();
    await admin.from('coach_annotations').insert({
      coach_id: coachA.id,
      pilot_id: pilot.id,
      corner_index: 2,
      body: 'Note de A',
      visibility: 'private',
    } as never);

    // Coach B essaie de lire — RLS filtre sur coach_id = auth.uid()
    const clientB = await userClient(coachB.email, coachB.password);
    const { data } = await clientB
      .from('coach_annotations')
      .select('body')
      .eq('pilot_id', pilot.id);

    expect(data ?? []).toHaveLength(0); // coach B ne voit pas les notes de A
  });
});
