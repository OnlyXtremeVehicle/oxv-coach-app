-- 0029_moderation_reports.sql — Modération communautaire (PR-82, M3)
--
-- Un utilisateur signale un contenu UGC visible. L'admin traite en file. Le
-- SIGNALEUR est confidentiel vis-à-vis du signalé. La table ne porte qu'une
-- RÉFÉRENCE polymorphe (target_type + target_id), jamais le contenu, JAMAIS de
-- télémétrie ni de contenu pilote privé (carnet/objectifs/empreinte).
--
-- Durcissements (revue adversariale) :
--   1. DEUX tables : `moderation_reports` (lisible par le signaleur — statut seul)
--      et `moderation_report_reviews` (admin-only : resolution/reviewed_by). La
--      note admin (qui peut nommer le signalé) ne fuit JAMAIS au signaleur.
--   2. Trigger d'intégrité+visibilité : un signalement n'est accepté que si la
--      cible EXISTE et est VISIBLE par le signaleur (exists sous sa RLS).
--   3. MVP 2 cibles réelles publiques (coach_review, partner_offer). Enum
--      extensible via ALTER TYPE ADD VALUE.
--   4. `details` requis si reason='autre' (CHECK conditionnel).
--   5. UNIQUE(reporter, cible) anti-doublon ; rate-limit léger côté service.
--
-- Pattern : support_tickets (0020) / b2b_event_reports (0023). Aucune policy
-- DELETE (conservation audit/prescription RGPD ; purge via service_role).

create type public.moderation_target_type as enum ('coach_review', 'partner_offer');
create type public.moderation_reason as enum (
  'contenu_illicite',
  'spam',
  'usurpation',
  'inapproprie',
  'autre'
);
create type public.moderation_status as enum ('nouveau', 'en_cours', 'resolu', 'rejete');

create table public.moderation_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  target_type public.moderation_target_type not null,
  target_id uuid not null,
  reason public.moderation_reason not null,
  details text check (details is null or length(btrim(details)) between 1 and 2000),
  status public.moderation_status not null default 'nouveau',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id),
  -- « autre » exige une précision (qualité de la file, ton sobre).
  check (reason <> 'autre' or (details is not null and length(btrim(details)) between 1 and 2000))
);

create index moderation_reports_target_idx on public.moderation_reports (target_type, target_id);
create index moderation_reports_status_idx on public.moderation_reports (status, created_at);
create index moderation_reports_reporter_idx on public.moderation_reports (reporter_id, created_at desc);

-- Volet admin SÉPARÉ : la résolution (texte libre pouvant nommer le signalé) et
-- l'identité du traitant ne sont JAMAIS lisibles par le signaleur (table admin-only).
create table public.moderation_report_reviews (
  report_id uuid primary key references public.moderation_reports (id) on delete cascade,
  resolution text check (resolution is null or length(btrim(resolution)) between 1 and 2000),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- updated_at (search_path durci, standard maison)
-- ----------------------------------------------------------------------------
create or replace function public.moderation_touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_moderation_reports_touch on public.moderation_reports;
create trigger trg_moderation_reports_touch
  before update on public.moderation_reports
  for each row execute function public.moderation_touch_updated_at();

drop trigger if exists trg_moderation_reviews_touch on public.moderation_report_reviews;
create trigger trg_moderation_reviews_touch
  before update on public.moderation_report_reviews
  for each row execute function public.moderation_touch_updated_at();

-- ----------------------------------------------------------------------------
-- Intégrité + visibilité : on ne signale que ce qui EXISTE et qu'on PEUT VOIR.
-- SECURITY INVOKER (défaut) : le exists() s'exécute sous la RLS du signaleur →
-- une cible non visible (avis non publié, offre non publiée) fait échouer l'insert.
-- ----------------------------------------------------------------------------
create or replace function public.moderation_validate_target()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.target_type = 'coach_review' then
    if not exists (select 1 from public.coach_reviews where id = new.target_id) then
      raise exception 'moderation: cible coach_review introuvable ou non visible'
        using errcode = 'foreign_key_violation';
    end if;
  elsif new.target_type = 'partner_offer' then
    if not exists (select 1 from public.partner_offers where id = new.target_id) then
      raise exception 'moderation: cible partner_offer introuvable ou non visible'
        using errcode = 'foreign_key_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_moderation_validate_target on public.moderation_reports;
create trigger trg_moderation_validate_target
  before insert on public.moderation_reports
  for each row execute function public.moderation_validate_target();

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.moderation_reports enable row level security;
alter table public.moderation_report_reviews enable row level security;

-- Le signaleur voit SES signalements (statut) ; l'admin voit tout.
create policy moderation_reports_select on public.moderation_reports
  for select to authenticated
  using (auth.uid() = reporter_id or public.is_admin());

-- Dépôt : par le signaleur lui-même, toujours en 'nouveau' (pas d'auto-résolution).
create policy moderation_reports_insert on public.moderation_reports
  for insert to authenticated
  with check (auth.uid() = reporter_id and status = 'nouveau');

-- Traitement (statut) : admin uniquement. Le signaleur ne modifie jamais son signalement.
create policy moderation_reports_update_admin on public.moderation_reports
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Volet review : ADMIN UNIQUEMENT (le signaleur n'y accède jamais).
create policy moderation_reviews_admin_all on public.moderation_report_reviews
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

comment on table public.moderation_reports is
  'Signalements communautaires (PR-82). Reference polymorphe (target_type+target_id) vers du contenu UGC visible. Signaleur confidentiel ; le signale n a aucune policy. Ne touche jamais la telemetrie ni le contenu pilote prive.';
comment on table public.moderation_report_reviews is
  'Volet admin d un signalement (resolution, traitant). Admin-only : la note de resolution ne fuit jamais au signaleur (anti-pilori inverse).';
