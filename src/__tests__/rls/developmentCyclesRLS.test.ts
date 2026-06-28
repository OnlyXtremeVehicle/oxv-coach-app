/**
 * Tests RLS — programmes adaptatifs coach (migration 0027).
 *
 * Authoring (coach niveau 'programme' strict) :
 *   POSITIF : crée un cycle + un axe, les lit.
 *   NÉGATIF : un coach 'lecture_detaillee' (pas 'programme') ne peut PAS authorer.
 *
 * Lecture pilote :
 *   POSITIF : lit un cycle PARTAGÉ + ses axes. NÉGATIFS : ne voit pas un cycle non
 *   partagé ; ne peut pas écrire. Le partenaire ne voit rien.
 *
 * Garde-fou doctrinal (le correctif clé) :
 *   NÉGATIF : un axe prescriptif écrit en PRIVÉ bloque le PARTAGE ultérieur du cycle
 *   (re-scan des axes au flip is_shared). POSITIF : contenu descriptif se partage.
 *
 * Skip automatique si TEST_SUPABASE_URL / TEST_SUPABASE_SERVICE_KEY absents.
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
import type { SupabaseClient } from '@supabase/supabase-js';

const describeIf = RLS_TEST_ENABLED ? describe : describe.skip;

async function seedCycle(
  coachId: string,
  pilotId: string,
  shared = false,
  title = 'Apprivoiser le secteur 2'
): Promise<string> {
  const { data } = (await adminClient()
    .from('pilot_development_cycles')
    .insert({ coach_id: coachId, pilot_id: pilotId, title, is_shared: shared } as never)
    .select('id')
    .single()) as unknown as { data: { id: string } | null };
  return data!.id;
}

async function seedStep(cycleId: string, focus: string): Promise<void> {
  await adminClient()
    .from('cycle_steps')
    .insert({ cycle_id: cycleId, focus } as never);
}

describeIf('RLS — programmes adaptatifs (pilot_development_cycles + cycle_steps)', () => {
  const created: TestUser[] = [];
  afterAll(async () => {
    await cleanupTestUsers(created);
  });

  async function programCoach(): Promise<{
    coach: TestUser;
    pilot: TestUser;
    c: SupabaseClient;
  }> {
    const coach = await createTestUser('coach');
    const pilot = await createTestUser('pilot');
    created.push(coach, pilot);
    await assignCoachToPilot(coach.id, pilot.id, true, 'programme');
    return { coach, pilot, c: await userClient(coach.email, coach.password) };
  }

  it('POSITIF — coach programme crée un cycle + un axe et les lit', async () => {
    const { coach, pilot, c } = await programCoach();
    const { data: ins, error: insErr } = await c
      .from('pilot_development_cycles')
      .insert({ coach_id: coach.id, pilot_id: pilot.id, title: 'Confort en S2' } as never)
      .select('id')
      .single();
    expect(insErr).toBeNull();
    const cycleId = (ins as { id: string }).id;

    const { error: stepErr } = await c
      .from('cycle_steps')
      .insert({ cycle_id: cycleId, focus: 'Le secteur 2, à observer.' } as never);
    expect(stepErr).toBeNull();

    expect(
      (await c.from('pilot_development_cycles').select('id').eq('id', cycleId)).data ?? []
    ).toHaveLength(1);
  });

  it('NÉGATIF — un coach lecture_detaillee (pas programme) ne peut pas authorer', async () => {
    const coach = await createTestUser('coach');
    const pilot = await createTestUser('pilot');
    created.push(coach, pilot);
    await assignCoachToPilot(coach.id, pilot.id, true, 'lecture_detaillee');

    const c = await userClient(coach.email, coach.password);
    const { error } = await c
      .from('pilot_development_cycles')
      .insert({ coach_id: coach.id, pilot_id: pilot.id, title: 'Sans le bon niveau' } as never);
    expect(error).not.toBeNull(); // is_program_coach_of = false
  });

  it('POSITIF — le pilote lit un cycle PARTAGÉ et ses axes', async () => {
    const { coach, pilot } = await programCoach();
    const cycleId = await seedCycle(coach.id, pilot.id, true);
    await seedStep(cycleId, 'Le secteur 2, à observer sans le forcer.');

    const p = await userClient(pilot.email, pilot.password);
    expect(
      (await p.from('pilot_development_cycles').select('id').eq('id', cycleId)).data ?? []
    ).toHaveLength(1);
    expect(
      (await p.from('cycle_steps').select('id').eq('cycle_id', cycleId)).data ?? []
    ).toHaveLength(1);
  });

  it('NÉGATIF — le pilote ne voit pas un cycle NON partagé', async () => {
    const { coach, pilot } = await programCoach();
    const cycleId = await seedCycle(coach.id, pilot.id, false);

    const p = await userClient(pilot.email, pilot.password);
    expect(
      (await p.from('pilot_development_cycles').select('id').eq('id', cycleId)).data ?? []
    ).toHaveLength(0);
  });

  it('NÉGATIF — le pilote ne peut pas écrire un cycle', async () => {
    const { coach, pilot } = await programCoach();
    const p = await userClient(pilot.email, pilot.password);
    const { error } = await p
      .from('pilot_development_cycles')
      .insert({ coach_id: coach.id, pilot_id: pilot.id, title: 'Auto-programme' } as never);
    expect(error).not.toBeNull();
  });

  it('NÉGATIF — un partenaire ne voit aucun programme', async () => {
    const { coach, pilot } = await programCoach();
    const partner = await createTestUser('partner');
    created.push(partner);
    const cycleId = await seedCycle(coach.id, pilot.id, true);

    const pa = await userClient(partner.email, partner.password);
    expect(
      (await pa.from('pilot_development_cycles').select('id').eq('id', cycleId)).data ?? []
    ).toHaveLength(0);
  });

  it('NÉGATIF — un axe prescriptif écrit en privé bloque le partage (re-scan)', async () => {
    const { coach, pilot, c } = await programCoach();
    const { data: ins } = await c
      .from('pilot_development_cycles')
      .insert({ coach_id: coach.id, pilot_id: pilot.id, title: 'Cycle' } as never)
      .select('id')
      .single();
    const cycleId = (ins as { id: string }).id;

    // Axe prescriptif accepté tant que le cycle est PRIVÉ.
    const { error: stepErr } = await c
      .from('cycle_steps')
      .insert({ cycle_id: cycleId, focus: 'Il faut freiner plus tôt en V3.' } as never);
    expect(stepErr).toBeNull();

    // Le partage est REFUSÉ : le garde re-scanne les axes enfants.
    const { error: shareErr } = await c
      .from('pilot_development_cycles')
      .update({ is_shared: true } as never)
      .eq('id', cycleId);
    expect(shareErr).not.toBeNull();

    const { data } = await adminClient()
      .from('pilot_development_cycles')
      .select('is_shared')
      .eq('id', cycleId)
      .single();
    expect((data as { is_shared: boolean }).is_shared).toBe(false);
  });

  it('POSITIF — un cycle descriptif se partage', async () => {
    const { coach, pilot, c } = await programCoach();
    const { data: ins } = await c
      .from('pilot_development_cycles')
      .insert({ coach_id: coach.id, pilot_id: pilot.id, title: 'Confort en S2' } as never)
      .select('id')
      .single();
    const cycleId = (ins as { id: string }).id;
    await c
      .from('cycle_steps')
      .insert({ cycle_id: cycleId, focus: 'Le secteur 2, à observer.' } as never);

    const { error } = await c
      .from('pilot_development_cycles')
      .update({ is_shared: true } as never)
      .eq('id', cycleId);
    expect(error).toBeNull();
  });
});
