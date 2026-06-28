/**
 * Tests RLS — marketplace partenaire (migration 0017).
 * Séparation stricte pilote / partenaire / admin + lead consenti uniquement.
 *
 * POSITIFS : le partenaire voit son compte/ses offres/ses leads ; le pilote voit
 * les offres publiées et peut créer un lead CONSENTI.
 * NÉGATIFS : un pilote ne voit pas les leads d'un autre ; un coach ne voit AUCUN
 * lead ; un lead sans consentement est refusé.
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

async function seedPartner(profileId: string): Promise<string> {
  const { data } = (await adminClient()
    .from('partner_accounts')
    .insert({ profile_id: profileId, display_name: 'RLS Partner', status: 'validated' } as never)
    .select('id')
    .single()) as unknown as { data: { id: string } | null };
  return data!.id;
}

async function seedOffer(partnerId: string): Promise<string> {
  const { data } = (await adminClient()
    .from('partner_offers')
    .insert({ partner_id: partnerId, title: 'RLS Offer', status: 'published' } as never)
    .select('id')
    .single()) as unknown as { data: { id: string } | null };
  return data!.id;
}

describeIf('RLS — marketplace partenaire', () => {
  const created: TestUser[] = [];
  afterAll(async () => {
    await cleanupTestUsers(created);
  });

  it('POSITIF — le partenaire voit son compte, ses offres et ses leads', async () => {
    const partner = await createTestUser('partner');
    const pilot = await createTestUser('pilot');
    created.push(partner, pilot);
    const accountId = await seedPartner(partner.id);
    const offerId = await seedOffer(accountId);
    await adminClient()
      .from('partner_leads')
      .insert({ partner_id: accountId, pilot_id: pilot.id, offer_id: offerId } as never);

    const c = await userClient(partner.email, partner.password);
    expect(
      (await c.from('partner_accounts').select('id').eq('id', accountId)).data ?? []
    ).toHaveLength(1);
    expect(
      (await c.from('partner_offers').select('id').eq('partner_id', accountId)).data ?? []
    ).toHaveLength(1);
    expect(
      (await c.from('partner_leads').select('id').eq('partner_id', accountId)).data ?? []
    ).toHaveLength(1);
  });

  it('POSITIF — le pilote voit l offre publiée et peut créer un lead CONSENTI', async () => {
    const partner = await createTestUser('partner');
    const pilot = await createTestUser('pilot');
    created.push(partner, pilot);
    const accountId = await seedPartner(partner.id);
    const offerId = await seedOffer(accountId);

    const c = await userClient(pilot.email, pilot.password);
    expect(
      (await c.from('partner_offers').select('id').eq('status', 'published')).data?.length ?? 0
    ).toBeGreaterThan(0);

    const { error } = await c.from('partner_leads').insert({
      partner_id: accountId,
      pilot_id: pilot.id,
      offer_id: offerId,
      consent_contact: true,
    } as never);
    expect(error).toBeNull();
  });

  it('NÉGATIF — un lead sans consentement est refusé', async () => {
    const partner = await createTestUser('partner');
    const pilot = await createTestUser('pilot');
    created.push(partner, pilot);
    const accountId = await seedPartner(partner.id);

    const c = await userClient(pilot.email, pilot.password);
    const { error } = await c
      .from('partner_leads')
      .insert({ partner_id: accountId, pilot_id: pilot.id, consent_contact: false } as never);
    expect(error).not.toBeNull(); // RLS with check (consent_contact = true) bloque
  });

  it('NÉGATIF — un coach ne voit AUCUN lead ; un autre pilote non plus', async () => {
    const partner = await createTestUser('partner');
    const pilotA = await createTestUser('pilot');
    const pilotB = await createTestUser('pilot');
    const coach = await createTestUser('coach');
    created.push(partner, pilotA, pilotB, coach);
    const accountId = await seedPartner(partner.id);
    await adminClient()
      .from('partner_leads')
      .insert({ partner_id: accountId, pilot_id: pilotA.id } as never);

    const coachC = await userClient(coach.email, coach.password);
    const pilotBC = await userClient(pilotB.email, pilotB.password);
    expect((await coachC.from('partner_leads').select('id')).data ?? []).toHaveLength(0);
    expect((await pilotBC.from('partner_leads').select('id')).data ?? []).toHaveLength(0);
  });
});
