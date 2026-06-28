-- PR-B : contrat de lecture coach gradué (§6/§23). Décision Gabin 2026-06.
-- Le pilote choisit le niveau à l'acceptation ; défaut colonne = lecture_simple.
-- APPLIQUÉE EN PROD le 2026-06-28 via MCP (migration coach_access_level_graduated).

create type public.coach_access_level as enum ('lecture_simple', 'lecture_detaillee', 'programme');

alter table public.coach_pilots
  add column level public.coach_access_level not null default 'lecture_simple';

-- Préserver l'accès des affiliations DÉJÀ consenties (elles voyaient les frames).
update public.coach_pilots
  set level = 'lecture_detaillee'
  where pilot_consent_at is not null;

comment on column public.coach_pilots.level is
  'Niveau de lecture accordé par le pilote (§6/§23) : lecture_simple = sessions/tours/bilan ; lecture_detaillee = + frames + métriques de virage ; programme = + suivi. Le pilote le choisit à l''acceptation.';

-- Helper : accès aux données DÉTAILLÉES (frames + métriques de virage).
create or replace function public.is_detailed_coach_of(pilot_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1
    from public.coach_pilots
    where coach_id = auth.uid()
      and pilot_id = pilot_uuid
      and active = true
      and pilot_consent_at is not null
      and level in ('lecture_detaillee', 'programme')
  );
$$;

-- Repointer UNIQUEMENT les 2 policies de données détaillées.
-- sessions / laps / app_session_analyses restent sur is_coach_of (lecture_simple suffit).
drop policy if exists "telemetry_frames_coach_select" on public.telemetry_frames;
create policy "telemetry_frames_coach_select" on public.telemetry_frames
  for select
  using (
    session_id in (
      select id from public.telemetry_sessions where public.is_detailed_coach_of(user_id)
    )
  );

drop policy if exists "app_segment_analyses_coach_select" on public.app_segment_analyses;
create policy "app_segment_analyses_coach_select" on public.app_segment_analyses
  for select
  using (public.is_detailed_coach_of(user_id));
