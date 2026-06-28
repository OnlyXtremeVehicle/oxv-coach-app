/**
 * Tests RLS — modération communautaire (migration 0029).
 *
 * La cible doit EXISTER et être VISIBLE (trigger d'intégrité) : on signale une
 * offre partenaire publiée.
 *
 * POSITIFS : le signaleur dépose et voit SON signalement ; l'admin voit tout.
 * NÉGATIFS : un autre utilisateur ne voit pas le signalement ; le signaleur
 * n'accède jamais au volet review (admin-only) ; doublon refusé (UNIQUE) ; cible
 * inexistante refusée (trigger).
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

/** Crée un partenaire + une offre PUBLIÉE et renvoie l'id de l'offre. */
async function seedPublishedOffer(partnerUserId: string): Promise<string> {
  const admin = adminClient();
  const { data: acc } = (await admin
    .from('partner_accounts')
    .insert({
      profile_id: partnerUserId,
      display_name: 'Partenaire test',
      status: 'validated',
    } as never)
    .select('id')
    .single()) as unknown as { data: { id: string } | null };
  const { data: offer } = (await admin
    .from('partner_offers')
    .insert({ partner_id: acc!.id, title: 'Offre test', status: 'published' } as never)
    .select('id')
    .single()) as unknown as { data: { id: string } | null };
  return offer!.id;
}

async function seedReport(reporterId: string, offerId: string): Promise<string> {
  const { data } = (await adminClient()
    .from('moderation_reports')
    .insert({
      reporter_id: reporterId,
      target_type: 'partner_offer',
      target_id: offerId,
      reason: 'spam',
    } as never)
    .select('id')
    .single()) as unknown as { data: { id: string } | null };
  return data!.id;
}

describeIf('RLS — modération (moderation_reports + reviews)', () => {
  const created: TestUser[] = [];
  afterAll(async () => {
    await cleanupTestUsers(created);
  });

  it('POSITIF — le signaleur dépose et voit son signalement', async () => {
    const partner = await createTestUser('partner');
    const reporter = await createTestUser('pilot');
    created.push(partner, reporter);
    const offerId = await seedPublishedOffer(partner.id);

    const c = await userClient(reporter.email, reporter.password);
    const { error: insErr } = await c.from('moderation_reports').insert({
      reporter_id: reporter.id,
      target_type: 'partner_offer',
      target_id: offerId,
      reason: 'inapproprie',
    } as never);
    expect(insErr).toBeNull();

    expect(
      (await c.from('moderation_reports').select('id').eq('target_id', offerId)).data ?? []
    ).toHaveLength(1);
  });

  it('NÉGATIF — un autre utilisateur ne voit pas le signalement', async () => {
    const partner = await createTestUser('partner');
    const reporter = await createTestUser('pilot');
    const other = await createTestUser('pilot');
    created.push(partner, reporter, other);
    const offerId = await seedPublishedOffer(partner.id);
    const reportId = await seedReport(reporter.id, offerId);

    const o = await userClient(other.email, other.password);
    expect(
      (await o.from('moderation_reports').select('id').eq('id', reportId)).data ?? []
    ).toHaveLength(0);
  });

  it('POSITIF — l admin voit tous les signalements', async () => {
    const partner = await createTestUser('partner');
    const reporter = await createTestUser('pilot');
    const admin = await createTestUser('admin');
    created.push(partner, reporter, admin);
    const offerId = await seedPublishedOffer(partner.id);
    const reportId = await seedReport(reporter.id, offerId);

    const a = await userClient(admin.email, admin.password);
    expect(
      (await a.from('moderation_reports').select('id').eq('id', reportId)).data ?? []
    ).toHaveLength(1);
  });

  it('NÉGATIF — le signaleur n accède pas au volet review (admin-only)', async () => {
    const partner = await createTestUser('partner');
    const reporter = await createTestUser('pilot');
    created.push(partner, reporter);
    const offerId = await seedPublishedOffer(partner.id);
    const reportId = await seedReport(reporter.id, offerId);
    await adminClient()
      .from('moderation_report_reviews')
      .insert({ report_id: reportId, resolution: 'offre retirée' } as never);

    const c = await userClient(reporter.email, reporter.password);
    expect(
      (await c.from('moderation_report_reviews').select('report_id').eq('report_id', reportId))
        .data ?? []
    ).toHaveLength(0);
  });

  it('NÉGATIF — doublon refusé (UNIQUE reporter/cible)', async () => {
    const partner = await createTestUser('partner');
    const reporter = await createTestUser('pilot');
    created.push(partner, reporter);
    const offerId = await seedPublishedOffer(partner.id);
    await seedReport(reporter.id, offerId);

    const c = await userClient(reporter.email, reporter.password);
    const { error } = await c.from('moderation_reports').insert({
      reporter_id: reporter.id,
      target_type: 'partner_offer',
      target_id: offerId,
      reason: 'spam',
    } as never);
    expect(error).not.toBeNull();
  });

  it('NÉGATIF — cible inexistante refusée (trigger d intégrité)', async () => {
    const reporter = await createTestUser('pilot');
    created.push(reporter);

    const c = await userClient(reporter.email, reporter.password);
    const { error } = await c.from('moderation_reports').insert({
      reporter_id: reporter.id,
      target_type: 'partner_offer',
      target_id: '00000000-0000-0000-0000-000000000000',
      reason: 'spam',
    } as never);
    expect(error).not.toBeNull();
  });
});
