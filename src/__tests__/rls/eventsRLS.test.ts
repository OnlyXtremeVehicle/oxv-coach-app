/**
 * Tests RLS — événements + inscriptions (migration 0021).
 *
 * POSITIFS : l'admin voit tout ; le pilote voit un événement public et peut
 * s'inscrire ; l'admin fait le check-in.
 * NÉGATIFS : le pilote ne voit pas un `draft` ; il ne peut pas inscrire un AUTRE
 * pilote ; il ne peut pas se check-in lui-même (statut = admin).
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
async function seedEvent(status: string): Promise<string> {
  seq += 1;
  const slug = `rls-evt-${Date.now()}-${seq}`;
  const { data } = (await adminClient()
    .from('events')
    .insert({
      name: 'RLS Event',
      slug,
      event_type: 'test_alpha',
      status,
      location_name: 'Test',
      starts_at: '2026-07-05T09:00:00Z',
      ends_at: '2026-07-05T15:00:00Z',
    } as never)
    .select('id')
    .single()) as unknown as { data: { id: string } | null };
  return data!.id;
}

describeIf('RLS — événements + inscriptions', () => {
  const created: TestUser[] = [];
  const eventIds: string[] = [];

  afterAll(async () => {
    if (eventIds.length) await adminClient().from('events').delete().in('id', eventIds);
    await cleanupTestUsers(created);
  });

  async function event(status: string): Promise<string> {
    const id = await seedEvent(status);
    eventIds.push(id);
    return id;
  }

  it('POSITIF — un pilote voit un événement public mais PAS un draft', async () => {
    const pilot = await createTestUser('pilot');
    created.push(pilot);
    const pub = await event('public');
    const draft = await event('draft');

    const c = await userClient(pilot.email, pilot.password);
    expect((await c.from('events').select('id').eq('id', pub)).data ?? []).toHaveLength(1);
    expect((await c.from('events').select('id').eq('id', draft)).data ?? []).toHaveLength(0);
  });

  it('POSITIF — le pilote s’inscrit et voit son inscription ; l’admin fait le check-in', async () => {
    const pilot = await createTestUser('pilot');
    const admin = await createTestUser('admin');
    created.push(pilot, admin);
    const evt = await event('public');

    const c = await userClient(pilot.email, pilot.password);
    const { error: insErr } = await c
      .from('event_registrations')
      .insert({ event_id: evt, pilot_id: pilot.id } as never);
    expect(insErr).toBeNull();
    expect(
      (await c.from('event_registrations').select('id').eq('event_id', evt)).data ?? []
    ).toHaveLength(1);

    // Check-in = admin uniquement.
    const a = await userClient(admin.email, admin.password);
    const { error: updErr } = await a
      .from('event_registrations')
      .update({ status: 'checked_in', checked_in_at: new Date().toISOString() } as never)
      .eq('event_id', evt)
      .eq('pilot_id', pilot.id);
    expect(updErr).toBeNull();
  });

  it('NÉGATIF — un pilote ne peut pas inscrire un AUTRE pilote', async () => {
    const a = await createTestUser('pilot');
    const b = await createTestUser('pilot');
    created.push(a, b);
    const evt = await event('public');

    const ca = await userClient(a.email, a.password);
    const { error } = await ca
      .from('event_registrations')
      .insert({ event_id: evt, pilot_id: b.id } as never);
    expect(error).not.toBeNull(); // with check (pilot_id = auth.uid())
  });

  it('NÉGATIF — un pilote ne peut pas se check-in lui-même', async () => {
    const pilot = await createTestUser('pilot');
    created.push(pilot);
    const evt = await event('public');

    const c = await userClient(pilot.email, pilot.password);
    await c.from('event_registrations').insert({ event_id: evt, pilot_id: pilot.id } as never);
    // L'update ne matche pas la policy admin → 0 ligne, statut inchangé.
    await c
      .from('event_registrations')
      .update({ status: 'checked_in' } as never)
      .eq('event_id', evt)
      .eq('pilot_id', pilot.id);

    const { data } = await adminClient()
      .from('event_registrations')
      .select('status')
      .eq('event_id', evt)
      .eq('pilot_id', pilot.id)
      .single();
    expect((data as { status: string }).status).toBe('registered');
  });
});
