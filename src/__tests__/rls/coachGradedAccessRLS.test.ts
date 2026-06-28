/**
 * Tests RLS — contrat de lecture coach GRADUÉ (§6/§23, migration 0014).
 *
 * Vérifie que le niveau `coach_pilots.level` différencie l'accès :
 *   - `lecture_simple`     : sessions/tours/bilan OUI ; frames + virages NON.
 *   - `lecture_detaillee`  : en plus, frames (`telemetry_frames`) + métriques de
 *                            virage (`app_segment_analyses`) OUI.
 *
 * Policies repointées : `telemetry_frames_coach_select` et
 * `app_segment_analyses_coach_select` utilisent `is_detailed_coach_of(user_id)`.
 *
 * Skip automatique si TEST_SUPABASE_URL / TEST_SUPABASE_SERVICE_KEY absents.
 */

import {
  RLS_TEST_ENABLED,
  type TestUser,
  assignCoachToPilot,
  cleanupTestUsers,
  createTestFrame,
  createTestSegmentAnalysis,
  createTestSession,
  createTestUser,
  userClient,
} from './setup';

const describeIf = RLS_TEST_ENABLED ? describe : describe.skip;

describeIf('RLS — accès coach gradué (frames vs sessions)', () => {
  const created: TestUser[] = [];

  afterAll(async () => {
    await cleanupTestUsers(created);
  });

  it('lecture_simple : voit les sessions mais PAS les frames ni les virages', async () => {
    const coach = await createTestUser('coach');
    const pilot = await createTestUser('pilot');
    created.push(coach, pilot);

    const sessionId = await createTestSession(pilot.id);
    await createTestFrame(sessionId);
    await createTestSegmentAnalysis(sessionId, pilot.id);
    await assignCoachToPilot(coach.id, pilot.id, true, 'lecture_simple');

    const c = await userClient(coach.email, coach.password);
    const sessions = await c.from('telemetry_sessions').select('id').eq('id', sessionId);
    const frames = await c.from('telemetry_frames').select('id').eq('session_id', sessionId);
    const segs = await c
      .from('app_segment_analyses')
      .select('id')
      .eq('telemetry_session_id', sessionId);

    expect(sessions.data ?? []).toHaveLength(1); // sessions : autorisées dès lecture_simple
    expect(frames.data ?? []).toHaveLength(0); // frames : bloquées
    expect(segs.data ?? []).toHaveLength(0); // virages : bloqués
  });

  it('lecture_detaillee : voit en plus les frames et les virages', async () => {
    const coach = await createTestUser('coach');
    const pilot = await createTestUser('pilot');
    created.push(coach, pilot);

    const sessionId = await createTestSession(pilot.id);
    await createTestFrame(sessionId);
    await createTestSegmentAnalysis(sessionId, pilot.id);
    await assignCoachToPilot(coach.id, pilot.id, true, 'lecture_detaillee');

    const c = await userClient(coach.email, coach.password);
    const frames = await c.from('telemetry_frames').select('id').eq('session_id', sessionId);
    const segs = await c
      .from('app_segment_analyses')
      .select('id')
      .eq('telemetry_session_id', sessionId);

    expect(frames.data ?? []).toHaveLength(1);
    expect(segs.data ?? []).toHaveLength(1);
  });
});
