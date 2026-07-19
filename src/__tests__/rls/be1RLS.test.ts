/**
 * Tests RLS — tables du lot BE-1 :
 *   `biometry_raw`, `video_overlays`, `incident_reports`,
 *   `founder_applications`, `convoys`, `convoy_participants`.
 *
 * Chaque assertion vérifie un FAIT observable des policies réellement en
 * production (inspectées via MCP le 2026-07-19 sur le projet
 * `fouvuqkdxarjpjbqnsjq`). Les conditions couvertes :
 *
 *  - biometry_raw
 *      · `biometry_own_all`   (ALL)    : auth.uid() = user_id
 *      · `biometry_coach_read`(SELECT) : is_detailed_coach_of(user_id)
 *                                        AND users.biometry_coach_share_consent_at IS NOT NULL
 *      → pas de policy anon/partner/staff : anonyme = deny.
 *  - video_overlays
 *      · `video_overlays_own_all` (ALL) : auth.uid() = user_id (strictement privé pilote).
 *  - incident_reports
 *      · `incident_insert_own`          : auth.uid() = user_id
 *      · `incident_select_own_or_admin` : auth.uid() = user_id OR is_admin()
 *      → AUCUNE policy UPDATE/DELETE = immuable (valeur probatoire assurantielle).
 *  - founder_applications
 *      · `founder_apps_insert_own` / `founder_apps_select_own` / `founder_apps_admin_all`
 *      → trigger `founder_app_guard` : force status='pending' à l'insert non-admin,
 *        lève sur tentative de changement de statut par un non-admin ; combiné à
 *        l'absence de policy UPDATE propriétaire, un pilote ne peut pas s'auto-approuver.
 *  - convoys / convoy_participants
 *      · lecture/création/jointure réservées aux inscrits de la journée
 *        (`is_registered_for_session(session_id)`), gérées par le créateur.
 *
 * Le harnais `./setup` ne fournit pas de helper pour les sessions SITE
 * (journées) ni les inscriptions : ils sont créés ici via `adminClient()`
 * (service_role, bypass RLS), comme le prévoit la mission.
 *
 * Skip automatique si TEST_SUPABASE_URL / TEST_SUPABASE_SERVICE_KEY absents.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  RLS_TEST_ENABLED,
  type TestUser,
  adminClient,
  assignCoachToPilot,
  cleanupTestUsers,
  createTestSession,
  createTestUser,
  userClient,
} from './setup';

const describeIf = RLS_TEST_ENABLED ? describe : describe.skip;

/**
 * Client NON authentifié (clé anon, aucun JWT). Les policies BE-1 ciblent
 * toutes le rôle `authenticated` : un anonyme ne doit rien voir.
 */
function anonClient(): SupabaseClient {
  return createClient(
    process.env.TEST_SUPABASE_URL ?? '',
    process.env.TEST_SUPABASE_ANON_KEY ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/**
 * Crée une session SITE (journée) minimale et renvoie son id.
 * `convoys.session_id` référence `public.sessions` (pas `telemetry_sessions`).
 */
async function createSiteSession(): Promise<string> {
  const admin = adminClient();
  const { data, error } = await admin
    .from('sessions')
    .insert({ date: new Date().toISOString().slice(0, 10), season_type: 'high' } as never)
    .select('id')
    .single();
  if (error || !data) throw new Error(`createSiteSession failed: ${error?.message ?? 'no data'}`);
  return (data as { id: string }).id;
}

/** Inscrit un user à une journée (registrations) — active `is_registered_for_session`. */
async function registerForSiteSession(userId: string, sessionId: string): Promise<void> {
  const admin = adminClient();
  const { error } = await admin.from('registrations').insert({
    user_id: userId,
    session_id: sessionId,
    offer_type: 'access',
    status: 'confirmed',
    price_total: 0,
    price_deposit: 0,
  } as never);
  if (error) throw new Error(`registerForSiteSession failed: ${error.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// biometry_raw
// ─────────────────────────────────────────────────────────────────────────────
describeIf('RLS — biometry_raw (biométrie cardiaque)', () => {
  const created: TestUser[] = [];

  afterAll(async () => {
    await cleanupTestUsers(created);
  });

  it('le pilote lit et écrit sa propre biométrie', async () => {
    const pilot = await createTestUser('pilot');
    created.push(pilot);
    const sessionId = await createTestSession(pilot.id);

    const c = await userClient(pilot.email, pilot.password);
    const ins = await c
      .from('biometry_raw')
      .insert({
        session_id: sessionId,
        user_id: pilot.id,
        ts: new Date().toISOString(),
        hr: 128,
        source: 'polar_h10',
      } as never)
      .select('id');
    expect(ins.error).toBeNull();
    expect(ins.data ?? []).toHaveLength(1);

    const read = await c.from('biometry_raw').select('id').eq('session_id', sessionId);
    expect(read.data ?? []).toHaveLength(1);
  });

  it('un autre pilote (non coach) ne voit rien et ne peut pas écrire pour autrui', async () => {
    const owner = await createTestUser('pilot');
    const other = await createTestUser('pilot');
    created.push(owner, other);
    const sessionId = await createTestSession(owner.id);
    await adminClient()
      .from('biometry_raw')
      .insert({
        session_id: sessionId,
        user_id: owner.id,
        ts: new Date().toISOString(),
        hr: 120,
        source: 'polar_h10',
      } as never);

    const c = await userClient(other.email, other.password);
    expect(
      (await c.from('biometry_raw').select('id').eq('session_id', sessionId)).data ?? []
    ).toHaveLength(0);

    // WITH CHECK auth.uid() = user_id : impossible d'insérer sous l'identité d'un autre.
    const ins = await c
      .from('biometry_raw')
      .insert({
        session_id: sessionId,
        user_id: owner.id,
        ts: new Date().toISOString(),
        hr: 130,
        source: 'polar_h10',
      } as never)
      .select('id');
    expect(ins.error).not.toBeNull();
  });

  it('coach détaillé : rien SANS consentement de partage, tout AVEC', async () => {
    const coach = await createTestUser('coach');
    const pilot = await createTestUser('pilot');
    created.push(coach, pilot);
    const sessionId = await createTestSession(pilot.id);
    await adminClient()
      .from('biometry_raw')
      .insert({
        session_id: sessionId,
        user_id: pilot.id,
        ts: new Date().toISOString(),
        hr: 115,
        source: 'polar_h10',
      } as never);
    // Binôme coach détaillé (level 'lecture_detaillee' + consentement lecture pilote).
    await assignCoachToPilot(coach.id, pilot.id, true, 'lecture_detaillee');

    const c = await userClient(coach.email, coach.password);

    // Partage biométrie OFF (users.biometry_coach_share_consent_at NULL par défaut).
    expect(
      (await c.from('biometry_raw').select('id').eq('session_id', sessionId)).data ?? []
    ).toHaveLength(0);

    // Le pilote consent au partage biométrie : la date rend la policy vraie.
    await adminClient()
      .from('users')
      .update({ biometry_coach_share_consent_at: new Date().toISOString() } as never)
      .eq('id', pilot.id);

    expect(
      (await c.from('biometry_raw').select('id').eq('session_id', sessionId)).data ?? []
    ).toHaveLength(1);
  });

  it('un client anonyme ne voit rien', async () => {
    const pilot = await createTestUser('pilot');
    created.push(pilot);
    const sessionId = await createTestSession(pilot.id);
    await adminClient()
      .from('biometry_raw')
      .insert({
        session_id: sessionId,
        user_id: pilot.id,
        ts: new Date().toISOString(),
        hr: 118,
        source: 'polar_h10',
      } as never);

    const { data } = await anonClient()
      .from('biometry_raw')
      .select('id')
      .eq('session_id', sessionId);
    expect(data ?? []).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// video_overlays
// ─────────────────────────────────────────────────────────────────────────────
describeIf('RLS — video_overlays (alignement vidéo, privé pilote)', () => {
  const created: TestUser[] = [];

  afterAll(async () => {
    await cleanupTestUsers(created);
  });

  it('own-only : un autre pilote ne lit pas et ne peut pas insérer pour autrui', async () => {
    const owner = await createTestUser('pilot');
    const other = await createTestUser('pilot');
    created.push(owner, other);
    const sessionId = await createTestSession(owner.id);

    const oc = await userClient(owner.email, owner.password);
    const ins = await oc
      .from('video_overlays')
      .insert({
        session_id: sessionId,
        user_id: owner.id,
        local_asset_id: 'PHAsset-TEST-1',
        offset_ms: 250,
      } as never)
      .select('id');
    expect(ins.error).toBeNull();
    expect(ins.data ?? []).toHaveLength(1);

    const otherC = await userClient(other.email, other.password);
    // Ne voit pas la ligne du owner.
    expect(
      (await otherC.from('video_overlays').select('id').eq('session_id', sessionId)).data ?? []
    ).toHaveLength(0);

    // WITH CHECK auth.uid() = user_id : impossible d'insérer pour le compte du owner.
    const badIns = await otherC
      .from('video_overlays')
      .insert({
        session_id: sessionId,
        user_id: owner.id,
        local_asset_id: 'PHAsset-TEST-2',
        offset_ms: 10,
      } as never)
      .select('id');
    expect(badIns.error).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// incident_reports (immuables)
// ─────────────────────────────────────────────────────────────────────────────
describeIf('RLS — incident_reports (déclarations immuables)', () => {
  const created: TestUser[] = [];
  const description = 'Sortie de piste sans dommage au virage 3.'; // >= 10 caractères

  afterAll(async () => {
    // incident_reports.user_id = ON DELETE NO ACTION : purge explicite avant les users.
    if (created.length) {
      await adminClient()
        .from('incident_reports')
        .delete()
        .in(
          'user_id',
          created.map((u) => u.id)
        );
    }
    await cleanupTestUsers(created);
  });

  it('le pilote déclare et relit ses incidents', async () => {
    const pilot = await createTestUser('pilot');
    created.push(pilot);

    const c = await userClient(pilot.email, pilot.password);
    const ins = await c
      .from('incident_reports')
      .insert({ user_id: pilot.id, occurred_at: new Date().toISOString(), description } as never)
      .select('id')
      .single();
    expect(ins.error).toBeNull();
    expect((ins.data as { id: string } | null)?.id ?? '').not.toBe('');

    const read = await c.from('incident_reports').select('id').eq('user_id', pilot.id);
    expect(read.data ?? []).toHaveLength(1);
  });

  it('un incident est IMMUABLE : ni UPDATE ni DELETE par le pilote', async () => {
    const pilot = await createTestUser('pilot');
    created.push(pilot);

    const c = await userClient(pilot.email, pilot.password);
    const ins = await c
      .from('incident_reports')
      .insert({ user_id: pilot.id, occurred_at: new Date().toISOString(), description } as never)
      .select('id')
      .single();
    const id = (ins.data as { id: string }).id;

    // Aucune policy UPDATE : la ligne est filtrée -> 0 ligne affectée.
    const upd = await c
      .from('incident_reports')
      .update({ description: 'Version modifiee interdite.' } as never)
      .eq('id', id)
      .select('id');
    expect(upd.data ?? []).toHaveLength(0);

    // Aucune policy DELETE : 0 ligne affectée.
    const del = await c.from('incident_reports').delete().eq('id', id).select('id');
    expect(del.data ?? []).toHaveLength(0);

    // Vérité DB (admin) : la ligne existe toujours, inchangée.
    const { data: still } = await adminClient()
      .from('incident_reports')
      .select('description')
      .eq('id', id)
      .single();
    expect((still as { description: string }).description).toBe(description);
  });

  it('un autre pilote ne voit pas ; un admin voit', async () => {
    const owner = await createTestUser('pilot');
    const other = await createTestUser('pilot');
    const admin = await createTestUser('admin');
    created.push(owner, other, admin);

    const oc = await userClient(owner.email, owner.password);
    const ins = await oc
      .from('incident_reports')
      .insert({ user_id: owner.id, occurred_at: new Date().toISOString(), description } as never)
      .select('id')
      .single();
    const id = (ins.data as { id: string }).id;

    const otherC = await userClient(other.email, other.password);
    expect(
      (await otherC.from('incident_reports').select('id').eq('id', id)).data ?? []
    ).toHaveLength(0);

    const adminC = await userClient(admin.email, admin.password);
    expect(
      (await adminC.from('incident_reports').select('id').eq('id', id)).data ?? []
    ).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// founder_applications
// ─────────────────────────────────────────────────────────────────────────────
describeIf('RLS — founder_applications (candidatures fondateur)', () => {
  const created: TestUser[] = [];
  const motivation = 'Je souhaite rejoindre le cercle des fondateurs OXV.'; // >= 20 caractères

  afterAll(async () => {
    await cleanupTestUsers(created);
  });

  it('le pilote crée et lit sa candidature ; le trigger force status=pending', async () => {
    const pilot = await createTestUser('pilot');
    created.push(pilot);

    const c = await userClient(pilot.email, pilot.password);
    // Tentative de tricher en envoyant status='approved' dès l'insert.
    const ins = await c
      .from('founder_applications')
      .insert({ user_id: pilot.id, motivation, status: 'approved' } as never)
      .select('id, status')
      .single();
    expect(ins.error).toBeNull();
    expect((ins.data as { status: string } | null)?.status).toBe('pending'); // forcé par le trigger

    const read = await c.from('founder_applications').select('id').eq('user_id', pilot.id);
    expect(read.data ?? []).toHaveLength(1);
  });

  it("un pilote ne peut PAS élever son statut à 'approved'", async () => {
    const pilot = await createTestUser('pilot');
    created.push(pilot);

    const c = await userClient(pilot.email, pilot.password);
    await c.from('founder_applications').insert({ user_id: pilot.id, motivation } as never);

    // Aucune policy UPDATE propriétaire -> 0 ligne (backstop : trigger anti self-approve).
    const upd = await c
      .from('founder_applications')
      .update({ status: 'approved' } as never)
      .eq('user_id', pilot.id)
      .select('id');
    expect(upd.data ?? []).toHaveLength(0);

    // Vérité DB (admin) : statut resté 'pending'.
    const { data: adminRead } = await adminClient()
      .from('founder_applications')
      .select('status')
      .eq('user_id', pilot.id)
      .single();
    expect((adminRead as { status: string } | null)?.status).toBe('pending');
  });

  it('un admin voit les candidatures', async () => {
    const admin = await createTestUser('admin');
    const pilot = await createTestUser('pilot');
    created.push(admin, pilot);
    await adminClient()
      .from('founder_applications')
      .insert({ user_id: pilot.id, motivation } as never);

    const c = await userClient(admin.email, admin.password);
    const { data } = await c.from('founder_applications').select('id').eq('user_id', pilot.id);
    expect((data ?? []).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// convoys / convoy_participants
// ─────────────────────────────────────────────────────────────────────────────
describeIf('RLS — convoys / convoy_participants (inscrits de la journée)', () => {
  const created: TestUser[] = [];
  const siteSessions: string[] = [];

  afterAll(async () => {
    // Supprimer la session SITE cascade convois + participants + inscriptions.
    if (siteSessions.length) {
      await adminClient().from('sessions').delete().in('id', siteSessions);
    }
    await cleanupTestUsers(created);
  });

  it('un inscrit crée un convoi, le voit et le rejoint', async () => {
    const pilot = await createTestUser('pilot');
    created.push(pilot);
    const sessionId = await createSiteSession();
    siteSessions.push(sessionId);
    await registerForSiteSession(pilot.id, sessionId);

    const c = await userClient(pilot.email, pilot.password);
    const ins = await c
      .from('convoys')
      .insert({ session_id: sessionId, created_by: pilot.id, meeting_point: 'Paddock A' } as never)
      .select('id')
      .single();
    expect(ins.error).toBeNull();
    const convoyId = (ins.data as { id: string }).id;

    // Voit son convoi (is_registered_for_session).
    expect(
      (await c.from('convoys').select('id').eq('session_id', sessionId)).data ?? []
    ).toHaveLength(1);

    // Rejoint le convoi.
    const join = await c
      .from('convoy_participants')
      .insert({ convoy_id: convoyId, user_id: pilot.id } as never)
      .select('convoy_id');
    expect(join.error).toBeNull();
    expect(
      (await c.from('convoy_participants').select('user_id').eq('convoy_id', convoyId)).data ?? []
    ).toHaveLength(1);
  });

  it('un pilote NON inscrit ne voit pas le convoi et ne peut ni le rejoindre ni en créer', async () => {
    const registered = await createTestUser('pilot');
    const outsider = await createTestUser('pilot');
    created.push(registered, outsider);
    const sessionId = await createSiteSession();
    siteSessions.push(sessionId);
    await registerForSiteSession(registered.id, sessionId);

    const rc = await userClient(registered.email, registered.password);
    const ins = await rc
      .from('convoys')
      .insert({ session_id: sessionId, created_by: registered.id } as never)
      .select('id')
      .single();
    const convoyId = (ins.data as { id: string }).id;

    const oc = await userClient(outsider.email, outsider.password);
    // Ne voit pas le convoi de la journée.
    expect(
      (await oc.from('convoys').select('id').eq('session_id', sessionId)).data ?? []
    ).toHaveLength(0);

    // WITH CHECK is_registered_for_session : ne peut pas rejoindre.
    const join = await oc
      .from('convoy_participants')
      .insert({ convoy_id: convoyId, user_id: outsider.id } as never)
      .select('convoy_id');
    expect(join.error).not.toBeNull();

    // Ne peut pas non plus créer un convoi pour cette journée.
    const badCreate = await oc
      .from('convoys')
      .insert({ session_id: sessionId, created_by: outsider.id } as never)
      .select('id');
    expect(badCreate.error).not.toBeNull();
  });
});
