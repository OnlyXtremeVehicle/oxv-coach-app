/**
 * Tests RLS — empreinte consolidée (migration 0028, pilot_signature_snapshots).
 *
 * Espace own-row avec partage opt-in autonome PAR SNAPSHOT vers le coach consenti.
 *
 * POSITIFS : le pilote crée/voit son empreinte ; le coach consenti voit UNIQUEMENT
 * les empreintes partagées.
 * NÉGATIFS : un autre pilote ne voit rien ; le coach ne voit pas les non partagées ;
 * un coach non consenti ne voit rien même si partagé ; le coach ne peut pas écrire ;
 * le partenaire ne voit jamais rien.
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

async function seedSnapshot(userId: string, shared: boolean): Promise<string> {
  const { data } = (await adminClient()
    .from('pilot_signature_snapshots')
    .insert({
      user_id: userId,
      regularity_band: 'réguliers',
      turn_sample_count: 5,
      shared_with_coach: shared,
    } as never)
    .select('id')
    .single()) as unknown as { data: { id: string } | null };
  return data!.id;
}

describeIf('RLS — pilot_signature_snapshots (empreinte consolidée)', () => {
  const created: TestUser[] = [];
  afterAll(async () => {
    await cleanupTestUsers(created);
  });

  it('POSITIF — le pilote crée et voit son empreinte', async () => {
    const pilot = await createTestUser('pilot');
    created.push(pilot);
    const c = await userClient(pilot.email, pilot.password);

    const { data: ins, error: insErr } = await c
      .from('pilot_signature_snapshots')
      .insert({
        user_id: pilot.id,
        regularity_band: 'très réguliers',
        turn_sample_count: 6,
      } as never)
      .select('id')
      .single();
    expect(insErr).toBeNull();
    const id = (ins as { id: string }).id;
    expect(
      (await c.from('pilot_signature_snapshots').select('id').eq('id', id)).data ?? []
    ).toHaveLength(1);
  });

  it('POSITIF — le coach consenti voit la PARTAGÉE, pas la non partagée', async () => {
    const pilot = await createTestUser('pilot');
    const coach = await createTestUser('coach');
    created.push(pilot, coach);
    await assignCoachToPilot(coach.id, pilot.id, true);
    const sharedId = await seedSnapshot(pilot.id, true);
    const privateId = await seedSnapshot(pilot.id, false);

    const cc = await userClient(coach.email, coach.password);
    const ids = (
      (await cc.from('pilot_signature_snapshots').select('id').eq('user_id', pilot.id)).data ?? []
    ).map((r) => (r as { id: string }).id);
    expect(ids).toContain(sharedId);
    expect(ids).not.toContain(privateId);
    expect(ids).toHaveLength(1);
  });

  it('NÉGATIF — un coach NON consenti ne voit rien, même partagé', async () => {
    const pilot = await createTestUser('pilot');
    const coach = await createTestUser('coach');
    created.push(pilot, coach);
    await assignCoachToPilot(coach.id, pilot.id, false);
    await seedSnapshot(pilot.id, true);

    const cc = await userClient(coach.email, coach.password);
    expect(
      (await cc.from('pilot_signature_snapshots').select('id').eq('user_id', pilot.id)).data ?? []
    ).toHaveLength(0);
  });

  it('NÉGATIF — le coach ne peut pas écrire une empreinte', async () => {
    const pilot = await createTestUser('pilot');
    const coach = await createTestUser('coach');
    created.push(pilot, coach);
    await assignCoachToPilot(coach.id, pilot.id, true);

    const cc = await userClient(coach.email, coach.password);
    const { error } = await cc
      .from('pilot_signature_snapshots')
      .insert({ user_id: pilot.id, regularity_band: 'réguliers' } as never);
    expect(error).not.toBeNull(); // pas de policy INSERT coach
  });

  it('NÉGATIF — un autre pilote ne voit aucune empreinte', async () => {
    const owner = await createTestUser('pilot');
    const other = await createTestUser('pilot');
    created.push(owner, other);
    await seedSnapshot(owner.id, true);

    const o = await userClient(other.email, other.password);
    expect(
      (await o.from('pilot_signature_snapshots').select('id').eq('user_id', owner.id)).data ?? []
    ).toHaveLength(0);
  });

  it('NÉGATIF — un partenaire ne voit jamais l empreinte (règle cardinale)', async () => {
    const pilot = await createTestUser('pilot');
    const partner = await createTestUser('partner');
    created.push(pilot, partner);
    await seedSnapshot(pilot.id, true);

    const p = await userClient(partner.email, partner.password);
    expect(
      (await p.from('pilot_signature_snapshots').select('id').eq('user_id', pilot.id)).data ?? []
    ).toHaveLength(0);
  });
});
