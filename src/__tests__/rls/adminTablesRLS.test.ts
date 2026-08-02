/**
 * Tests RLS — tables admin-only de PR-D (migration 0016) :
 * `data_quality_reports`, `devices`, `device_assignments`.
 * Policy unique `*_admin_all` (is_admin) → invisibles à tout non-admin.
 *
 * CHAQUE ASSERTION D'INVISIBILITÉ DOIT PORTER SUR UNE LIGNE QUI EXISTE. Une
 * table vide rend toute vérification de RLS vraie par accident : le test passe,
 * et il passerait aussi bien sans aucune policy. C'était le cas de
 * `device_assignments` jusqu'au 02/08/2026.
 *
 * Skip automatique si TEST_SUPABASE_URL / TEST_SUPABASE_SERVICE_KEY absents.
 */

import {
  RLS_TEST_ENABLED,
  type TestUser,
  adminClient,
  cleanupTestUsers,
  createTestSession,
  createTestUser,
  userClient,
} from './setup';

const describeIf = RLS_TEST_ENABLED ? describe : describe.skip;

describeIf('RLS — tables admin-only (qualité data / équipements)', () => {
  const created: TestUser[] = [];
  let deviceId: string | null = null;
  let assignmentId: string | null = null;

  afterAll(async () => {
    // L'affectation d'abord : elle référence le boîtier.
    if (assignmentId)
      await adminClient().from('device_assignments').delete().eq('id', assignmentId);
    if (deviceId) await adminClient().from('devices').delete().eq('id', deviceId);
    await cleanupTestUsers(created);
  });

  it('un pilote ne voit ni les rapports qualité ni les équipements', async () => {
    const pilot = await createTestUser('pilot');
    created.push(pilot);
    const sessionId = await createTestSession(pilot.id);

    const admin = adminClient();
    await admin
      .from('data_quality_reports')
      .insert({ session_id: sessionId, type: 'no_frames', severity: 'critical' } as never);
    const { data: dev } = (await admin
      .from('devices')
      .insert({ label: 'OXV-RLS-TEST', type: 'racebox' } as never)
      .select('id')
      .single()) as unknown as { data: { id: string } | null };
    deviceId = dev?.id ?? null;

    // L'AFFECTATION MANQUAIT — LE TEST PASSAIT SUR DU VIDE.
    //
    // Les deux premières assertions insèrent bien une ligne avant de vérifier
    // qu'un pilote ne la voit pas. La troisième n'insérait RIEN : elle passait
    // parce que `device_assignments` était vide, pas parce qu'une policy
    // écartait le pilote. Elle aurait passé à l'identique sans aucune RLS —
    // exactement le motif « garde posée, non armée », dans un test de sécurité.
    //
    // Relevé par la cartographie du 02/08/2026. Le dépôt est PUBLIC : la RLS
    // est la seule barrière, et ses tests doivent mordre.
    const { data: aff } = (await admin
      .from('device_assignments')
      .insert({ device_id: deviceId, session_id: sessionId } as never)
      .select('id')
      .single()) as unknown as { data: { id: string } | null };
    assignmentId = aff?.id ?? null;
    // Si l'insertion échoue, l'assertion suivante redeviendrait vide de sens :
    // on exige donc qu'une ligne existe réellement avant de tester la lecture.
    expect(assignmentId).not.toBeNull();

    const c = await userClient(pilot.email, pilot.password);
    expect((await c.from('data_quality_reports').select('id')).data ?? []).toHaveLength(0);
    expect((await c.from('devices').select('id')).data ?? []).toHaveLength(0);
    expect((await c.from('device_assignments').select('id')).data ?? []).toHaveLength(0);
  });

  it('un admin voit les rapports qualité', async () => {
    const adminUser = await createTestUser('admin');
    const pilot = await createTestUser('pilot');
    created.push(adminUser, pilot);
    const sessionId = await createTestSession(pilot.id);
    await adminClient()
      .from('data_quality_reports')
      .insert({ session_id: sessionId, type: 'analysis_missing', severity: 'warning' } as never);

    const c = await userClient(adminUser.email, adminUser.password);
    const { data } = await c.from('data_quality_reports').select('id');
    expect((data ?? []).length).toBeGreaterThan(0);
  });
});
