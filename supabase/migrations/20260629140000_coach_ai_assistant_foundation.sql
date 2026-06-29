-- Coach AI Assistant — fondation (V9 §14). L'IA assiste le COACH, jamais le
-- pilote en direct : brouillon serveur post-séance → filtre de sûreté → le coach
-- valide et rédige lui-même une coach_annotation (seule à atteindre le pilote).
-- Aucune policy pilote ni partenaire sur les tables IA (cardinale §148).
--
-- Décisions Gabin (29/06) : appliquer tel quel ; coach_queue = TABLE avec statut
-- de lecture explicite (pas une vue) ; périmètre V1 = fondation seule (pas d'UI).

-- 1. Journal de sûreté (créé en premier : référencé par coach_ai_suggestions).
create table public.ai_safety_reviews (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid references auth.users (id) on delete set null,
  telemetry_session_id uuid references public.telemetry_sessions (id) on delete set null,
  verdict text not null check (verdict in ('passed', 'flagged', 'blocked')),
  reasons text[],
  input_excerpt text,
  output_excerpt text,
  model_version text,
  created_at timestamptz not null default now()
);

create index idx_ai_safety_reviews_session
  on public.ai_safety_reviews (telemetry_session_id) where telemetry_session_id is not null;

alter table public.ai_safety_reviews enable row level security;

-- Lecture ADMIN seule (audit). Écriture par le serveur (service_role, hors RLS).
create policy ai_safety_reviews_admin_select on public.ai_safety_reviews
for select to authenticated
using (exists (select 1 from public.users where id = auth.uid() and is_admin = true));

-- 2. Brouillons IA pour le coach (jamais publiés seuls).
create table public.coach_ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  pilot_id uuid not null references auth.users (id) on delete cascade,
  telemetry_session_id uuid references public.telemetry_sessions (id) on delete cascade,
  corner_index integer check (corner_index between 1 and 7),
  body text not null check (length(btrim(body)) between 1 and 2000),
  status text not null default 'draft' check (status in ('draft', 'accepted', 'dismissed')),
  safety_review_id uuid references public.ai_safety_reviews (id) on delete set null,
  resulting_annotation_id uuid references public.coach_annotations (id) on delete set null,
  model_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_coach_ai_suggestions_coach
  on public.coach_ai_suggestions (coach_id, status, created_at desc);
create index idx_coach_ai_suggestions_pilot_session
  on public.coach_ai_suggestions (pilot_id, telemetry_session_id);

drop trigger if exists coach_ai_suggestions_updated_at on public.coach_ai_suggestions;
create trigger coach_ai_suggestions_updated_at
  before update on public.coach_ai_suggestions
  for each row execute function public.tg_touch_updated_at();

alter table public.coach_ai_suggestions enable row level security;

-- Coach : SES suggestions, pour un pilote qu'il suit (is_coach_of). L'INSERT
-- réel vient du serveur (service_role) après filtre de sûreté.
create policy coach_ai_suggestions_coach_all on public.coach_ai_suggestions
for all to authenticated
using (coach_id = auth.uid() and public.is_coach_of(pilot_id))
with check (coach_id = auth.uid() and public.is_coach_of(pilot_id));

create policy coach_ai_suggestions_admin_select on public.coach_ai_suggestions
for select to authenticated
using (exists (select 1 from public.users where id = auth.uid() and is_admin = true));

-- 3. File de lecture coach — TABLE avec statut de lecture explicite et
-- persistant (un statut par coach et par séance).
create table public.coach_queue (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  pilot_id uuid not null references auth.users (id) on delete cascade,
  telemetry_session_id uuid not null references public.telemetry_sessions (id) on delete cascade,
  status text not null default 'unread' check (status in ('unread', 'read', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coach_id, telemetry_session_id)
);

create index idx_coach_queue_coach
  on public.coach_queue (coach_id, status, created_at desc);

drop trigger if exists coach_queue_updated_at on public.coach_queue;
create trigger coach_queue_updated_at
  before update on public.coach_queue
  for each row execute function public.tg_touch_updated_at();

alter table public.coach_queue enable row level security;

-- Coach : SA file, pour ses pilotes suivis (is_coach_of). Marquage lu/archivé.
-- Upsert applicatif possible ; enfilement serveur (trigger) en service_role plus tard.
create policy coach_queue_coach_all on public.coach_queue
for all to authenticated
using (coach_id = auth.uid() and public.is_coach_of(pilot_id))
with check (coach_id = auth.uid() and public.is_coach_of(pilot_id));

create policy coach_queue_admin_select on public.coach_queue
for select to authenticated
using (exists (select 1 from public.users where id = auth.uid() and is_admin = true));

comment on table public.ai_safety_reviews is
  'Journal de surete IA (V9) : verdict passed/flagged/blocked de chaque sortie avant presentation au coach. Lecture admin seule, ecriture serveur. Aucun acces pilote/partenaire.';
comment on table public.coach_ai_suggestions is
  'Brouillons IA pour le coach (V9) : draft -> accepted/dismissed. L IA assiste le coach en amont de coach_annotations, jamais le pilote en direct. Own-row coach + admin audit ; jamais pilote/partenaire.';
comment on table public.coach_queue is
  'File de lecture coach (V9) : statut lu/non-lu/archive par coach et par seance. Own-row coach + admin audit.';
