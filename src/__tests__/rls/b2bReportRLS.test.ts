/**
 * Tests RLS — B2B Event Report (migration 0023).
 *
 * POSITIF : le partenaire voit son rapport PARTAGÉ ; jamais un brouillon.
 * NÉGATIF : un autre partenaire ne voit rien.
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
      slug: `rls-b2b-${Date.now()}-${seq}`,
      event_type: 'partenaire',
      status: 'finished',
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

async function seedReport(eventId: string, partnerId: string, status: string): Promise<void> {
  await adminClient()
    .from('b2b_event_reports')
    .insert({ event_id: eventId, partner_id: partnerId, status } as never);
}

describeIf('RLS — B2B Event Report', () => {
  const created: TestUser[] = [];
  const eventIds: string[] = [];

  afterAll(async () => {
    if (eventIds.length) await adminClient().from('events').delete().in('id', eventIds);
    await cleanupTestUsers(created);
  });

  it('POSITIF — le partenaire voit son rapport PARTAGÉ mais pas un brouillon', async () => {
    const partner = await createTestUser('partner');
    created.push(partner);
    const accountId = await seedPartner(partner.id);

    const sharedEvent = await seedEvent();
    const draftEvent = await seedEvent();
    eventIds.push(sharedEvent, draftEvent);
    await seedReport(sharedEvent, accountId, 'shared');
    await seedReport(draftEvent, accountId, 'draft');

    const c = await userClient(partner.email, partner.password);
    expect(
      (await c.from('b2b_event_reports').select('id').eq('event_id', sharedEvent)).data ?? []
    ).toHaveLength(1);
    expect(
      (await c.from('b2b_event_reports').select('id').eq('event_id', draftEvent)).data ?? []
    ).toHaveLength(0);
  });

  it('NÉGATIF — un autre partenaire ne voit pas le rapport', async () => {
    const owner = await createTestUser('partner');
    const other = await createTestUser('partner');
    created.push(owner, other);
    const accountId = await seedPartner(owner.id);
    const eventId = await seedEvent();
    eventIds.push(eventId);
    await seedReport(eventId, accountId, 'shared');

    const oc = await userClient(other.email, other.password);
    expect(
      (await oc.from('b2b_event_reports').select('id').eq('event_id', eventId)).data ?? []
    ).toHaveLength(0);
  });
});
