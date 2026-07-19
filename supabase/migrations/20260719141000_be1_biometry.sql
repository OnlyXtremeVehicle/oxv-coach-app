-- ============================================================================
-- BE-1 · Livrable 2 — Biométrie : consentement + biometry_raw + rétention.
-- ============================================================================
-- Donnée de SANTÉ (RGPD art. 9) : fail-closed de bout en bout.
--
-- MODÈLE DE CONSENTEMENT adapté à l'existant : consentService stocke les choix
-- en colonnes sur `users` (ai_debrief_enabled, coach_ai_enabled — booléens). Le
-- prompt BE-1 demande « le même patron, défaut NULL=OFF ». Pour de la donnée de
-- santé on retient des colonnes TIMESTAMPTZ (granted_at) plutôt que booléennes :
-- NULL = pas de consentement (OFF), une date = consentement horodaté (piste
-- d'audit exigée pour l'art. 9). Révocation = retour à NULL. DEUX consentements
-- distincts (cf. Sheet L2 « 2 cases ») :
--   - biometry_capture_consent_at    : autorise la CAPTURE FC.
--   - biometry_coach_share_consent_at : autorise le PARTAGE au coach détaillé.
--
-- Adaptation de signature vérifiée en prod : is_detailed_coach_of(pilot_uuid)
-- prend LE PILOTE (le coach = auth.uid() en interne) — pas 2 arguments.
-- ============================================================================

alter table public.users
  add column if not exists biometry_capture_consent_at    timestamptz null,
  add column if not exists biometry_coach_share_consent_at timestamptz null;

comment on column public.users.biometry_capture_consent_at is
  'BE-1 : horodatage du consentement à la capture FC (santé, art. 9). NULL = OFF (fail-closed).';
comment on column public.users.biometry_coach_share_consent_at is
  'BE-1 : horodatage du consentement au partage FC au coach détaillé. NULL = OFF (fail-closed).';

-- ----------------------------------------------------------------------------
-- Table brute des échantillons FC.
-- ----------------------------------------------------------------------------
create table if not exists public.biometry_raw (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.telemetry_sessions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  ts timestamptz not null,
  hr smallint not null check (hr between 25 and 250),
  rr_ms smallint[] null,                 -- intervalles R-R (Polar uniquement)
  source text not null check (source in ('polar_h10','apple_watch')),
  quality smallint null check (quality between 0 and 100),
  created_at timestamptz not null default now(),
  unique (session_id, ts, source)        -- idempotence au rejeu
);

alter table public.biometry_raw enable row level security;

-- Pilote : accès complet à SES échantillons.
drop policy if exists biometry_own_all on public.biometry_raw;
create policy biometry_own_all on public.biometry_raw
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Coach : LECTURE SEULE si binôme détaillé ET consentement de partage actif.
drop policy if exists biometry_coach_read on public.biometry_raw;
create policy biometry_coach_read on public.biometry_raw
  for select to authenticated
  using (
    public.is_detailed_coach_of(biometry_raw.user_id)
    and exists (
      select 1 from public.users u
      where u.id = biometry_raw.user_id
        and u.biometry_coach_share_consent_at is not null
    )
  );

-- JAMAIS de policy partner/staff/anon (interdit définitif santé).

create index if not exists biometry_raw_session_ts on public.biometry_raw(session_id, ts);

-- ----------------------------------------------------------------------------
-- Rétention 30 jours (minimisation santé). SECURITY DEFINER, search_path figé,
-- exécution réservée au service_role (cron). Le cron est planifié séparément
-- (documenté ci-dessous) — patron des autres jobs OXV via Vault.
-- ----------------------------------------------------------------------------
create or replace function public.purge_old_biometry()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.biometry_raw where ts < now() - interval '30 days';
$$;

comment on function public.purge_old_biometry() is
  'BE-1 : minimisation santé — supprime les échantillons FC de plus de 30 j. '
  'Planifié en cron quotidien (job biometry-retention-daily).';

revoke all on function public.purge_old_biometry() from public, anon, authenticated;
grant execute on function public.purge_old_biometry() to service_role;

-- CRON (à poser une fois, patron des jobs 7/8 — voir 13_BE1_ETAT.md) :
--   select cron.schedule('biometry-retention-daily','15 3 * * *',
--     $$ select public.purge_old_biometry(); $$);
--
-- PURGE COMPTE : biometry_raw est CASCADE sur users (delete users → delete
-- échantillons) et déjà couvert par purge_user_data() (garde to_regclass posée
-- en SEC-1, activée dès la création de cette table).
