/**
 * Tests RLS — présence partenaire à un événement (migration 0022).
 *
 * POSITIF : le partenaire voit SA présence ; l'admin voit tout.
 * NÉGATIF : un autre partenaire ne voit pas ; un pilote ne voit rien.
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

let seq = 0;
async function seedEvent(): Promise<string> {
  seq += 1;
  const { data } = (await adminClient()
    .from('events')
    .insert({
      name: 'RLS Event',
      slug: `rls-ep-${Date.now()}-${seq}`,
      event_type: 'partenaire',
      status: 'public',
      location_name: 'Test',
      starts_at: '2026-07-05T09:00:00Z',
      ends_at: '2026-07-05T15:00:00Z',
    } as never)
    .select('id')
    .single()) as unknown as { data: { id: string } | null };
  return data!.id;
}

async function seedPartner(profileId: string): Promise<string> {
  const { data } = (await adminClient()
    .from('partner_accounts')
    .insert({ profile_id: profileId, display_name: 'RLS Partner', status: 'validated' } as never)
    .select('id')
    .single()) as unknown as { data: { id: string } | null };
  return data!.id;
}

async function attach(eventId: string, partnerId: string): Promise<void> {
  await adminClient()
    .from('event_partners')
    .insert({ event_id: eventId, partner_id: partnerId } as never);
}

describeIf('RLS — présence partenaire à un événement', () => {
  const created: TestUser[] = [];
  const eventIds: string[] = [];

  afterAll(async () => {
    if (eventIds.length) await adminClient().from('events').delete().in('id', eventIds);
    await cleanupTestUsers(created);
  });

  it('POSITIF — le partenaire voit SA présence', async () => {
    const partner = await createTestUser('partner');
    created.push(partner);
    const eventId = await seedEvent();
    eventIds.push(eventId);
    const accountId = await seedPartner(partner.id);
    await attach(eventId, accountId);

    const c = await userClient(partner.email, partner.password);
    expect(
      (await c.from('event_partners').select('id').eq('event_id', eventId)).data ?? []
    ).toHaveLength(1);
  });

  it('NÉGATIF — un autre partenaire et un pilote ne voient pas', async () => {
    const owner = await createTestUser('partner');
    const other = await createTestUser('partner');
    const pilot = await createTestUser('pilot');
    created.push(owner, other, pilot);
    const eventId = await seedEvent();
    eventIds.push(eventId);
    const accountId = await seedPartner(owner.id);
    await attach(eventId, accountId);

    const oc = await userClient(other.email, other.password);
    const pc = await userClient(pilot.email, pilot.password);
    expect(
      (await oc.from('event_partners').select('id').eq('event_id', eventId)).data ?? []
    ).toHaveLength(0);
    expect(
      (await pc.from('event_partners').select('id').eq('event_id', eventId)).data ?? []
    ).toHaveLength(0);
  });
});
