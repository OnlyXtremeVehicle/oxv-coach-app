/**
 * Tests RLS — carnet pilote (migration 0025).
 *
 * Espace intime own-row avec partage opt-in PAR NOTE vers le coach consenti.
 *
 * POSITIFS : le pilote crée/voit/édite SA note ; le coach consenti voit UNIQUEMENT
 * les notes que le pilote a partagées (shared_with_coach).
 * NÉGATIFS : un autre pilote ne voit rien ; le coach ne voit pas les notes NON
 * partagées ; un coach NON consenti ne voit rien même si partagé ; le coach ne
 * peut pas écrire ; le partenaire ne voit jamais rien.
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

async function seedNote(userId: string, shared: boolean, body = 'note RLS'): Promise<string> {
  const { data } = (await adminClient()
    .from('pilot_notes')
    .insert({ user_id: userId, body, shared_with_coach: shared } as never)
    .select('id')
    .single()) as unknown as { data: { id: string } | null };
  return data!.id;
}

describeIf('RLS — pilot_notes (carnet pilote)', () => {
  const created: TestUser[] = [];
  afterAll(async () => {
    await cleanupTestUsers(created);
  });

  it('POSITIF — le pilote crée, voit et édite sa note', async () => {
    const pilot = await createTestUser('pilot');
    created.push(pilot);
    const c = await userClient(pilot.email, pilot.password);

    const { data: ins, error: insErr } = await c
      .from('pilot_notes')
      .insert({ user_id: pilot.id, body: 'Première séance.' } as never)
      .select('id')
      .single();
    expect(insErr).toBeNull();
    const id = (ins as { id: string }).id;

    expect((await c.from('pilot_notes').select('id').eq('id', id)).data ?? []).toHaveLength(1);

    const { error: updErr } = await c
      .from('pilot_notes')
      .update({ body: 'Corrigée.' } as never)
      .eq('id', id);
    expect(updErr).toBeNull();
  });

  it('POSITIF — le coach consenti voit la note PARTAGÉE, pas la non partagée', async () => {
    const pilot = await createTestUser('pilot');
    const coach = await createTestUser('coach');
    created.push(pilot, coach);
    await assignCoachToPilot(coach.id, pilot.id, true);

    const sharedId = await seedNote(pilot.id, true, 'partagée');
    const privateId = await seedNote(pilot.id, false, 'privée');

    const cc = await userClient(coach.email, coach.password);
    const visible = (await cc.from('pilot_notes').select('id').eq('user_id', pilot.id)).data ?? [];
    const ids = visible.map((r) => (r as { id: string }).id);
    expect(ids).toContain(sharedId);
    expect(ids).not.toContain(privateId);
    expect(ids).toHaveLength(1);
  });

  it('NÉGATIF — un coach NON consenti ne voit rien, même partagé', async () => {
    const pilot = await createTestUser('pilot');
    const coach = await createTestUser('coach');
    created.push(pilot, coach);
    await assignCoachToPilot(coach.id, pilot.id, false); // pas de pilot_consent_at
    await seedNote(pilot.id, true, 'partagée mais pas consenti');

    const cc = await userClient(coach.email, coach.password);
    expect(
      (await cc.from('pilot_notes').select('id').eq('user_id', pilot.id)).data ?? []
    ).toHaveLength(0);
  });

  it('NÉGATIF — le coach ne peut pas écrire dans le carnet du pilote', async () => {
    const pilot = await createTestUser('pilot');
    const coach = await createTestUser('coach');
    created.push(pilot, coach);
    await assignCoachToPilot(coach.id, pilot.id, true);

    const cc = await userClient(coach.email, coach.password);
    const { error } = await cc
      .from('pilot_notes')
      .insert({ user_id: pilot.id, body: 'intrusion coach' } as never);
    expect(error).not.toBeNull(); // pas de policy INSERT coach
  });

  it('NÉGATIF — un autre pilote ne voit aucune note', async () => {
    const owner = await createTestUser('pilot');
    const other = await createTestUser('pilot');
    created.push(owner, other);
    await seedNote(owner.id, true, 'partagée mais à un coach, pas à un pilote');

    const o = await userClient(other.email, other.password);
    expect(
      (await o.from('pilot_notes').select('id').eq('user_id', owner.id)).data ?? []
    ).toHaveLength(0);
  });

  it('NÉGATIF — un partenaire ne voit jamais le carnet (règle cardinale)', async () => {
    const pilot = await createTestUser('pilot');
    const partner = await createTestUser('partner');
    created.push(pilot, partner);
    await seedNote(pilot.id, true, 'partagée');

    const p = await userClient(partner.email, partner.password);
    expect(
      (await p.from('pilot_notes').select('id').eq('user_id', pilot.id)).data ?? []
    ).toHaveLength(0);
  });
});
