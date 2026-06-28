/**
 * Tests RLS — assistant IA coach (migration 0026).
 *
 * coach_ai_drafts (brouillons) :
 *   POSITIF : un coach détaillé consenti insère un brouillon (status='draft') et le lit.
 *   NÉGATIFS : il ne peut PAS s'auto-valider (status='validated' bloqué) ; un coach
 *   en lecture_simple ne peut pas insérer ; le pilote ne voit aucun brouillon ; le
 *   partenaire non plus.
 *
 * Garde-fou doctrinal sur coach_annotations (trigger) :
 *   NÉGATIF : une note PARTAGÉE prescriptive est refusée.
 *   POSITIFS : une note partagée descriptive passe ; une note PRIVÉE prescriptive
 *   passe (le garde ne vise que le partagé).
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

const describeIf = RLS_TEST_ENABLED ? describe : describe.skip;

async function seedDraft(
  coachId: string,
  pilotId: string,
  status: 'draft' | 'validated' | 'discarded' = 'draft'
): Promise<string> {
  const { data } = (await adminClient()
    .from('coach_ai_drafts')
    .insert({
      coach_id: coachId,
      pilot_id: pilotId,
      corner_index: 1,
      generated_text: 'Le terrain le plus serré de la séance.',
      status,
    } as never)
    .select('id')
    .single()) as unknown as { data: { id: string } | null };
  return data!.id;
}

describeIf('RLS — coach_ai_drafts (assistant IA coach)', () => {
  const created: TestUser[] = [];
  afterAll(async () => {
    await cleanupTestUsers(created);
  });

  it('POSITIF — coach détaillé consenti insère un brouillon et le lit', async () => {
    const coach = await createTestUser('coach');
    const pilot = await createTestUser('pilot');
    created.push(coach, pilot);
    await assignCoachToPilot(coach.id, pilot.id, true, 'lecture_detaillee');

    const c = await userClient(coach.email, coach.password);
    const { data: ins, error: insErr } = await c
      .from('coach_ai_drafts')
      .insert({
        coach_id: coach.id,
        pilot_id: pilot.id,
        corner_index: 2,
        generated_text: 'Marge confortable, vitesse de sortie nette.',
        status: 'draft',
      } as never)
      .select('id')
      .single();
    expect(insErr).toBeNull();
    const id = (ins as { id: string }).id;
    expect((await c.from('coach_ai_drafts').select('id').eq('id', id)).data ?? []).toHaveLength(1);
  });

  it('NÉGATIF — le coach ne peut pas s’auto-valider (status=validated bloqué)', async () => {
    const coach = await createTestUser('coach');
    const pilot = await createTestUser('pilot');
    created.push(coach, pilot);
    await assignCoachToPilot(coach.id, pilot.id, true, 'lecture_detaillee');
    const id = await seedDraft(coach.id, pilot.id, 'draft');

    const c = await userClient(coach.email, coach.password);
    const { error } = await c
      .from('coach_ai_drafts')
      .update({ status: 'validated' } as never)
      .eq('id', id);
    expect(error).not.toBeNull(); // WITH CHECK : status in (draft, discarded) seulement

    // La base reste en 'draft'.
    const { data } = await adminClient()
      .from('coach_ai_drafts')
      .select('status')
      .eq('id', id)
      .single();
    expect((data as { status: string }).status).toBe('draft');
  });

  it('POSITIF — le coach peut rejeter (status=discarded)', async () => {
    const coach = await createTestUser('coach');
    const pilot = await createTestUser('pilot');
    created.push(coach, pilot);
    await assignCoachToPilot(coach.id, pilot.id, true, 'lecture_detaillee');
    const id = await seedDraft(coach.id, pilot.id, 'draft');

    const c = await userClient(coach.email, coach.password);
    const { error } = await c
      .from('coach_ai_drafts')
      .update({ status: 'discarded' } as never)
      .eq('id', id);
    expect(error).toBeNull();
  });

  it('NÉGATIF — un coach en lecture_simple ne peut pas insérer', async () => {
    const coach = await createTestUser('coach');
    const pilot = await createTestUser('pilot');
    created.push(coach, pilot);
    await assignCoachToPilot(coach.id, pilot.id, true, 'lecture_simple');

    const c = await userClient(coach.email, coach.password);
    const { error } = await c.from('coach_ai_drafts').insert({
      coach_id: coach.id,
      pilot_id: pilot.id,
      corner_index: 1,
      generated_text: 'Tentative sans accès détaillé.',
      status: 'draft',
    } as never);
    expect(error).not.toBeNull(); // is_detailed_coach_of = false
  });

  it('NÉGATIF — le pilote ne voit aucun brouillon', async () => {
    const coach = await createTestUser('coach');
    const pilot = await createTestUser('pilot');
    created.push(coach, pilot);
    await assignCoachToPilot(coach.id, pilot.id, true, 'lecture_detaillee');
    await seedDraft(coach.id, pilot.id, 'draft');

    const p = await userClient(pilot.email, pilot.password);
    expect(
      (await p.from('coach_ai_drafts').select('id').eq('pilot_id', pilot.id)).data ?? []
    ).toHaveLength(0);
  });

  it('NÉGATIF — un partenaire ne voit aucun brouillon', async () => {
    const coach = await createTestUser('coach');
    const pilot = await createTestUser('pilot');
    const partner = await createTestUser('partner');
    created.push(coach, pilot, partner);
    await assignCoachToPilot(coach.id, pilot.id, true, 'lecture_detaillee');
    await seedDraft(coach.id, pilot.id, 'draft');

    const pa = await userClient(partner.email, partner.password);
    expect(
      (await pa.from('coach_ai_drafts').select('id').eq('pilot_id', pilot.id)).data ?? []
    ).toHaveLength(0);
  });
});

describeIf('Trigger doctrinal — coach_annotations partagées', () => {
  const created: TestUser[] = [];
  afterAll(async () => {
    await cleanupTestUsers(created);
  });

  async function coachClientFor() {
    const coach = await createTestUser('coach');
    const pilot = await createTestUser('pilot');
    created.push(coach, pilot);
    await assignCoachToPilot(coach.id, pilot.id, true, 'lecture_detaillee');
    return { coach, pilot, c: await userClient(coach.email, coach.password) };
  }

  it('NÉGATIF — note PARTAGÉE prescriptive refusée', async () => {
    const { coach, pilot, c } = await coachClientFor();
    const { error } = await c.from('coach_annotations').insert({
      coach_id: coach.id,
      pilot_id: pilot.id,
      corner_index: 1,
      body: 'Vous devriez freiner plus tôt ici.',
      visibility: 'shared',
    } as never);
    expect(error).not.toBeNull();
  });

  it('POSITIF — note PARTAGÉE descriptive acceptée', async () => {
    const { coach, pilot, c } = await coachClientFor();
    const { error } = await c.from('coach_annotations').insert({
      coach_id: coach.id,
      pilot_id: pilot.id,
      corner_index: 1,
      body: 'Le terrain le plus serré de la séance. Était-ce volontaire ?',
      visibility: 'shared',
    } as never);
    expect(error).toBeNull();
  });

  it('POSITIF — note PRIVÉE prescriptive acceptée (le garde ne vise que le partagé)', async () => {
    const { coach, pilot, c } = await coachClientFor();
    const { error } = await c.from('coach_annotations').insert({
      coach_id: coach.id,
      pilot_id: pilot.id,
      corner_index: 1,
      body: 'Note de travail : il faut creuser le freinage.',
      visibility: 'private',
    } as never);
    expect(error).toBeNull();
  });
});
