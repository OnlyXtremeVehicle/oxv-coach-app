-- 0026_coach_ai_drafts.sql — Assistant IA coach : brouillons descriptifs (M3, C-1)
--
-- L'IA PRÉ-RÉDIGE un brouillon d'observation par virage. Le coach HUMAIN le
-- relit/édite/VALIDE ; le brouillon validé devient une annotation coach_annotations
-- (canal existant lu par le pilote). Le pilote ne voit JAMAIS le brouillon brut.
--
-- Version DURCIE (revue adversariale) :
--   1. Consentement pilote DÉDIÉ, opt-in, fail-closed : users.coach_ai_enabled
--      (défaut false). Distinct de ai_debrief_enabled (finalité différente :
--      ici un TIERS — le coach — déclenche un traitement IA hors-UE).
--   2. Niveau requis : is_detailed_coach_of (lecture_detaillee/programme), car le
--      brouillon s'appuie sur les segments détaillés. On ne génère jamais sur une
--      donnée à laquelle le coach n'a pas droit en lecture.
--   3. Anti-auto-validation : la RLS coach interdit de poser status='validated'
--      soi-même. La transition draft→validated passe par l'edge coach-ai-validate
--      (service_role) qui RE-FILTRE le texte édité côté serveur.
--   4. Garde-fou EXÉCUTABLE sur coach_annotations : trigger doctrinal qui refuse
--      toute note PARTAGÉE contenant un verbe prescriptif — quelle que soit son
--      origine (IA ou saisie manuelle). Colmate aussi le trou préexistant.
--   5. Provenance : coach_annotations.ai_assisted, marquée au pilote (transparence).

-- ============================================================================
-- 1. Consentement pilote dédié (opt-in, défaut OFF)
-- ============================================================================
alter table public.users
  add column if not exists coach_ai_enabled boolean not null default false;

comment on column public.users.coach_ai_enabled is
  'Opt-in du pilote : autorise SON coach à déclencher l''assistant IA (transfert hors-UE) sur ses données. Défaut false (fail-closed). Distinct de ai_debrief_enabled.';

-- Helper fail-closed : le coach courant (auth.uid()) peut-il faire générer un
-- brouillon IA sur ce pilote ? Exige le niveau détaillé consenti ET l'opt-in IA.
-- coalesce(..., false) : pilote absent / lecture impossible => refus.
create or replace function public.coach_ai_consent(pilot_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_detailed_coach_of(pilot_uuid)
    and coalesce((select coach_ai_enabled from public.users where id = pilot_uuid), false);
$$;

comment on function public.coach_ai_consent(uuid) is
  'Fail-closed : true ssi auth.uid() est coach détaillé consenti de pilot_uuid ET pilot_uuid a activé coach_ai_enabled. Gate de l''edge coach-ai-draft.';

revoke execute on function public.coach_ai_consent(uuid) from public, anon;
grant execute on function public.coach_ai_consent(uuid) to authenticated;

-- ============================================================================
-- 2. Provenance IA sur le canal de sortie (transparence, marquée au pilote)
-- ============================================================================
alter table public.coach_annotations
  add column if not exists ai_assisted boolean not null default false;

comment on column public.coach_annotations.ai_assisted is
  'true = l''observation a été pré-rédigée par l''assistant IA puis validée/éditée par le coach. Marquée au pilote (transparence, charte T1).';

-- ============================================================================
-- 3. Table des brouillons IA
-- ============================================================================
create table if not exists public.coach_ai_drafts (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  pilot_id uuid not null references auth.users (id) on delete cascade,
  telemetry_session_id uuid references public.telemetry_sessions (id) on delete set null,
  corner_index integer not null check (corner_index between 1 and 7),
  -- Texte déjà passé par le filtre doctrinal côté serveur AVANT insertion.
  generated_text text not null check (length(generated_text) between 1 and 1000),
  status text not null default 'draft' check (status in ('draft', 'validated', 'discarded')),
  provenance text not null default 'openai_gpt-4o-mini',
  model_version text,
  -- Annotation produite à la validation (seul canal vers le pilote).
  resulting_annotation_id uuid references public.coach_annotations (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  validated_at timestamptz,
  check (coach_id <> pilot_id),
  check (resulting_annotation_id is null or status = 'validated'),
  check (validated_at is null or status = 'validated')
);

create index if not exists coach_ai_drafts_coach_status_idx
  on public.coach_ai_drafts (coach_id, status, created_at desc);
create index if not exists coach_ai_drafts_pilot_corner_idx
  on public.coach_ai_drafts (pilot_id, corner_index);

create or replace function public.coach_ai_drafts_set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists coach_ai_drafts_updated_at on public.coach_ai_drafts;
create trigger coach_ai_drafts_updated_at
  before update on public.coach_ai_drafts
  for each row execute function public.coach_ai_drafts_set_updated_at();

comment on table public.coach_ai_drafts is
  'Brouillons IA de l''assistant coach (C-1). Filtrés serveur AVANT insertion, relus/édités/validés par le coach humain. Le pilote ne voit JAMAIS un brouillon : seul coach_annotations (status=validated) l''atteint.';

-- ============================================================================
-- 4. RLS — scindée pour interdire l'auto-validation
-- ============================================================================
alter table public.coach_ai_drafts enable row level security;

-- Le coach détaillé consenti lit SES brouillons.
drop policy if exists coach_ai_drafts_coach_select on public.coach_ai_drafts;
create policy coach_ai_drafts_coach_select on public.coach_ai_drafts
  for select to authenticated
  using (coach_id = auth.uid() and public.is_detailed_coach_of(pilot_id));

-- Insertion : uniquement en 'draft' (jamais directement validé).
drop policy if exists coach_ai_drafts_coach_insert on public.coach_ai_drafts;
create policy coach_ai_drafts_coach_insert on public.coach_ai_drafts
  for insert to authenticated
  with check (
    coach_id = auth.uid()
    and public.is_detailed_coach_of(pilot_id)
    and status = 'draft'
  );

-- Édition / rejet : le coach peut corriger le texte ou rejeter, mais NE PEUT PAS
-- poser status='validated' lui-même (WITH CHECK status in draft/discarded). La
-- validation passe par l'edge coach-ai-validate (service_role) qui re-filtre.
drop policy if exists coach_ai_drafts_coach_update on public.coach_ai_drafts;
create policy coach_ai_drafts_coach_update on public.coach_ai_drafts
  for update to authenticated
  using (coach_id = auth.uid() and public.is_detailed_coach_of(pilot_id))
  with check (
    coach_id = auth.uid()
    and public.is_detailed_coach_of(pilot_id)
    and status in ('draft', 'discarded')
  );

drop policy if exists coach_ai_drafts_coach_delete on public.coach_ai_drafts;
create policy coach_ai_drafts_coach_delete on public.coach_ai_drafts
  for delete to authenticated
  using (coach_id = auth.uid() and public.is_detailed_coach_of(pilot_id));

-- Admin : SELECT seul (audit RGPD/doctrine). Aucune écriture, aucune validation.
drop policy if exists coach_ai_drafts_admin_select on public.coach_ai_drafts;
create policy coach_ai_drafts_admin_select on public.coach_ai_drafts
  for select to authenticated
  using (public.is_admin());

-- Pilote : aucune policy => jamais d'accès à un brouillon. Partenaire : jamais.

-- ============================================================================
-- 5. Garde-fou doctrinal EXÉCUTABLE sur le canal de sortie (coach_annotations)
-- ============================================================================
-- Toute note PARTAGÉE (visibility='shared', non supprimée) est scannée : si elle
-- contient un verbe prescriptif, l'écriture est REFUSÉE — quelle que soit son
-- origine (brouillon IA édité, ou saisie manuelle du coach). C'est le rempart
-- de DERNIER recours côté base, complémentaire des filtres app/edge.
--
-- Lexique = miroir de FORBIDDEN_PATTERNS (edge) / PROSCRIBED (aiSafetyFilter).
-- Duplication TRACÉE : le test app coachAnnotationDoctrineGuard couvre ces termes.
create or replace function public.coach_annotation_doctrine_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.visibility = 'shared' and new.deleted_at is null then
    if new.body ~* '\y(freinez|accélérez|ouvrez les gaz|tracez|évitez|poussez|corrigez|améliorez|optimisez|gagnez|il faut|vous devez|vous devriez|vous pouvez|tu dois|tu peux|je vous conseille|je vous recommande)\y' then
      raise exception 'doctrine_violation: note partagée contient un terme prescriptif (verbe directif interdit)'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists coach_annotations_doctrine_guard on public.coach_annotations;
create trigger coach_annotations_doctrine_guard
  before insert or update on public.coach_annotations
  for each row execute function public.coach_annotation_doctrine_guard();

comment on function public.coach_annotation_doctrine_guard() is
  'Refuse toute note coach PARTAGÉE contenant un verbe prescriptif (miroir SQL du lexique aiSafetyFilter/edge). Rempart base, complémentaire des filtres app/edge.';
