/**
 * Tests RLS — support pilote ⇄ admin (migration 0020).
 *
 * POSITIFS : le pilote crée/voit SON ticket et y répond ; l'admin voit le
 * ticket, change statut/priorité et répond.
 * NÉGATIFS : un autre pilote ne voit rien ; le pilote ne peut pas changer le
 * statut/priorité ni usurper `is_admin=true` ; un coach ne voit aucun ticket.
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

async function seedTicket(userId: string): Promise<string> {
  const { data } = (await adminClient()
    .from('support_tickets')
    .insert({ user_id: userId, category: 'data', subject: 'RLS ticket' } as never)
    .select('id')
    .single()) as unknown as { data: { id: string } | null };
  return data!.id;
}

describeIf('RLS — support (tickets + messages)', () => {
  const created: TestUser[] = [];
  afterAll(async () => {
    await cleanupTestUsers(created);
  });

  it('POSITIF — le pilote crée son ticket, le voit et y répond', async () => {
    const pilot = await createTestUser('pilot');
    created.push(pilot);
    const c = await userClient(pilot.email, pilot.password);

    const { data: ins, error: insErr } = await c
      .from('support_tickets')
      .insert({ user_id: pilot.id, category: 'equipement', subject: 'Mon boîtier' } as never)
      .select('id')
      .single();
    expect(insErr).toBeNull();
    const ticketId = (ins as { id: string }).id;

    expect(
      (await c.from('support_tickets').select('id').eq('id', ticketId)).data ?? []
    ).toHaveLength(1);

    const { error: msgErr } = await c.from('support_messages').insert({
      ticket_id: ticketId,
      author_id: pilot.id,
      body: 'Détails',
      is_admin: false,
    } as never);
    expect(msgErr).toBeNull();
  });

  it('POSITIF — l admin voit le ticket, change statut/priorité et répond', async () => {
    const pilot = await createTestUser('pilot');
    const admin = await createTestUser('admin');
    created.push(pilot, admin);
    const ticketId = await seedTicket(pilot.id);

    const a = await userClient(admin.email, admin.password);
    expect(
      (await a.from('support_tickets').select('id').eq('id', ticketId)).data ?? []
    ).toHaveLength(1);

    const { error: updErr } = await a
      .from('support_tickets')
      .update({ status: 'en_cours', priority: 'p1' } as never)
      .eq('id', ticketId);
    expect(updErr).toBeNull();

    const { error: msgErr } = await a.from('support_messages').insert({
      ticket_id: ticketId,
      author_id: admin.id,
      body: 'On regarde',
      is_admin: true,
    } as never);
    expect(msgErr).toBeNull();
  });

  it('NÉGATIF — un autre pilote ne voit pas le ticket ni ses messages', async () => {
    const owner = await createTestUser('pilot');
    const other = await createTestUser('pilot');
    created.push(owner, other);
    const ticketId = await seedTicket(owner.id);
    await adminClient()
      .from('support_messages')
      .insert({ ticket_id: ticketId, author_id: owner.id, body: 'privé' } as never);

    const o = await userClient(other.email, other.password);
    expect(
      (await o.from('support_tickets').select('id').eq('id', ticketId)).data ?? []
    ).toHaveLength(0);
    expect(
      (await o.from('support_messages').select('id').eq('ticket_id', ticketId)).data ?? []
    ).toHaveLength(0);
  });

  it('NÉGATIF — le pilote ne peut pas changer le statut/priorité de son ticket', async () => {
    const pilot = await createTestUser('pilot');
    created.push(pilot);
    const ticketId = await seedTicket(pilot.id);

    const c = await userClient(pilot.email, pilot.password);
    // L'UPDATE ne matche pas la policy admin → 0 ligne affectée (sans erreur).
    await c
      .from('support_tickets')
      .update({ status: 'resolu' } as never)
      .eq('id', ticketId);

    const { data } = await adminClient()
      .from('support_tickets')
      .select('status')
      .eq('id', ticketId)
      .single();
    expect((data as { status: string }).status).toBe('nouveau');
  });

  it('NÉGATIF — le pilote ne peut pas usurper is_admin=true sur un message', async () => {
    const pilot = await createTestUser('pilot');
    created.push(pilot);
    const ticketId = await seedTicket(pilot.id);

    const c = await userClient(pilot.email, pilot.password);
    const { error } = await c.from('support_messages').insert({
      ticket_id: ticketId,
      author_id: pilot.id,
      body: 'faux admin',
      is_admin: true,
    } as never);
    expect(error).not.toBeNull(); // WITH CHECK : is_admin=true exige public.is_admin()
  });

  it('NÉGATIF — un coach ne voit aucun ticket pilote', async () => {
    const pilot = await createTestUser('pilot');
    const coach = await createTestUser('coach');
    created.push(pilot, coach);
    const ticketId = await seedTicket(pilot.id);

    const cc = await userClient(coach.email, coach.password);
    expect(
      (await cc.from('support_tickets').select('id').eq('id', ticketId)).data ?? []
    ).toHaveLength(0);
  });
});
