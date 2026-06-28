/**
 * Tests RLS — journal de réglages véhicule (migration 0024).
 *
 * Propriété dérivée du véhicule (own-row) : le pilote gère les réglages de SES
 * véhicules, et ne voit jamais ceux d'un autre.
 *
 * POSITIF : le propriétaire insère un réglage sur son véhicule et le relit.
 * NÉGATIFS : un autre pilote ne voit pas les réglages, et ne peut pas en
 * insérer sur un véhicule qui n'est pas le sien (WITH CHECK).
 *
 * Skip automatique si TEST_SUPABASE_URL / TEST_SUPABASE_SERVICE_KEY absents.
 */

import {
  RLS_TEST_ENABLED,
  type TestUser,
  adminClient,
  cleanupTestUsers,
  createTestUser,
  userClient,
} from './setup';

const describeIf = RLS_TEST_ENABLED ? describe : describe.skip;

async function seedVehicle(userId: string): Promise<string> {
  const { data } = (await adminClient()
    .from('vehicles')
    .insert({ user_id: userId, brand: 'Test', model: 'RLS' } as never)
    .select('id')
    .single()) as unknown as { data: { id: string } | null };
  return data!.id;
}

describeIf('RLS — vehicle_setups (journal de réglages)', () => {
  const created: TestUser[] = [];
  afterAll(async () => {
    await cleanupTestUsers(created);
  });

  it('POSITIF — le propriétaire insère un réglage et le relit', async () => {
    const owner = await createTestUser('pilot');
    created.push(owner);
    const vehicleId = await seedVehicle(owner.id);

    const c = await userClient(owner.email, owner.password);
    const { error: insErr } = await c.from('vehicle_setups').insert({
      vehicle_id: vehicleId,
      tires: 'MR2',
      pressure_front_start: 2.1,
    } as never);
    expect(insErr).toBeNull();

    expect(
      (await c.from('vehicle_setups').select('id').eq('vehicle_id', vehicleId)).data ?? []
    ).toHaveLength(1);
  });

  it('NÉGATIF — un autre pilote ne voit pas les réglages', async () => {
    const owner = await createTestUser('pilot');
    const other = await createTestUser('pilot');
    created.push(owner, other);
    const vehicleId = await seedVehicle(owner.id);
    await adminClient()
      .from('vehicle_setups')
      .insert({ vehicle_id: vehicleId, tires: 'privé' } as never);

    const o = await userClient(other.email, other.password);
    expect(
      (await o.from('vehicle_setups').select('id').eq('vehicle_id', vehicleId)).data ?? []
    ).toHaveLength(0);
  });

  it('NÉGATIF — un autre pilote ne peut pas insérer sur un véhicule étranger', async () => {
    const owner = await createTestUser('pilot');
    const other = await createTestUser('pilot');
    created.push(owner, other);
    const vehicleId = await seedVehicle(owner.id);

    const o = await userClient(other.email, other.password);
    const { error } = await o
      .from('vehicle_setups')
      .insert({ vehicle_id: vehicleId, tires: 'intrus' } as never);
    expect(error).not.toBeNull(); // WITH CHECK : le véhicule doit appartenir à auth.uid()
  });
});
