-- 0027_coach_development_cycles.sql — Programmes adaptatifs coach (C-2, V1.5)
--
-- Un « programme adaptatif » = un cycle qualitatif authoré PAR LE COACH HUMAIN
-- pour un pilote, qu'il fait ÉVOLUER dans le temps. L'APP NE GÉNÈRE NI N'ADAPTE
-- JAMAIS : elle stocke et affiche. L'« adaptatif » est l'ajustement humain.
--
-- Doctrine (CLAUDE.md P2 ; 17_JURIDIQUE_COACH_DATA §1.3 ; V5 C-2) :
--   - lecture a posteriori (stands/après), JAMAIS d'instruction en piste (silence) ;
--   - objectifs formulés en OBSERVATIONS, pas en ordres ; AUCUN score chiffré ;
--   - consentement pilote préalable + révocable (souveraineté) ;
--   - distinct de pilot_goals (0023, intime) : ici c'est l'avis d'un tiers (coach).
--
-- Durcissements (revue adversariale) :
--   1. Lexique prescriptif consolidé dans public.is_prescriptive() — source SQL
--      UNIQUE, réutilisée par CE garde-fou ET coach_annotation_doctrine_guard (0026).
--   2. Re-scan des axes au partage : basculer is_shared=true sur l'en-tête
--      re-valide TOUS les cycle_steps enfants (sinon un axe prescriptif écrit en
--      privé atteindrait le pilote sans repasser le garde).
--   3. Niveau strict 'programme' via is_program_coach_of() : un cran de consentement
--      AU-DESSUS de lecture_detaillee (le pilote le choisit à l'acceptation, 0014).
--   4. corner_indexes bornés (pas de virage hors-piste / lien Bilan mort).
--
-- FK : auth.users(id) — par cohérence avec le pattern own-row coach le plus récent
-- (coach_annotations 0020, coach_ai_drafts 0026). La base mêle auth.users et
-- public.users sur les tables coach ; on retient auth.users ici.

-- ============================================================================
-- 1. Lexique prescriptif — SOURCE SQL UNIQUE (miroir de aiSafetyFilter / edges)
-- ============================================================================
-- DUPLICATION TRACÉE : ces 18 termes reflètent src/services/aiSafetyFilter.ts et
-- les edges (FORBIDDEN_PATTERNS). Le test app anti-divergence couvre chaque terme.
create or replace function public.is_prescriptive(txt text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(txt, '') ~* '\y(freinez|accélérez|ouvrez les gaz|tracez|évitez|poussez|corrigez|améliorez|optimisez|gagnez|il faut|vous devez|vous devriez|vous pouvez|tu dois|tu peux|je vous conseille|je vous recommande)\y';
$$;

comment on function public.is_prescriptive(text) is
  'true ssi le texte contient un verbe prescriptif (lexique miroir aiSafetyFilter/edges). Source SQL unique des garde-fous doctrinaux (coach_annotations, programmes).';

-- Consolidation : le garde-fou de coach_annotations (0026) réutilise désormais
-- is_prescriptive() — un seul lexique SQL à faire évoluer.
create or replace function public.coach_annotation_doctrine_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.visibility = 'shared' and new.deleted_at is null and public.is_prescriptive(new.body) then
    raise exception 'doctrine_violation: note partagée contient un terme prescriptif (verbe directif interdit)'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- ============================================================================
-- 2. Helpers
-- ============================================================================
-- Coach ACTIF, CONSENTI et de niveau STRICT 'programme' de ce pilote.
create or replace function public.is_program_coach_of(pilot_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.coach_pilots
    where coach_id = auth.uid()
      and pilot_id = pilot_uuid
      and active = true
      and pilot_consent_at is not null
      and level = 'programme'
  );
$$;

comment on function public.is_program_coach_of(uuid) is
  'true ssi auth.uid() est coach ACTIF, CONSENTI et de niveau STRICT ''programme'' de pilot_uuid. Gate d''authoring des programmes (C-2). Un cran de consentement au-dessus de is_detailed_coach_of ; ne pas réutiliser ce dernier pour l''authoring (contournerait le consentement gradué).';

revoke execute on function public.is_program_coach_of(uuid) from public, anon;
grant execute on function public.is_program_coach_of(uuid) to authenticated;

-- Bornes des virages associés à un axe (1..30, couvre tout circuit ; {} autorisé).
create or replace function public.corner_indexes_valid(idx int[])
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select idx <@ array(select generate_series(1, 30))::int[];
$$;

-- ============================================================================
-- 3. En-tête de programme (un cycle = une intention)
-- ============================================================================
create table public.pilot_development_cycles (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  pilot_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  -- Intention formulée en OBSERVATION (jamais un ordre). Aucun score de réussite.
  intention text check (intention is null or length(btrim(intention)) between 1 and 1000),
  status text not null default 'active' check (status in ('active', 'closed')),
  -- is_shared : le pilote ne voit RIEN tant que le coach n'a pas partagé (opt-in coach).
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  check (coach_id <> pilot_id),
  check (closed_at is null or status = 'closed')
);
create index idx_dev_cycles_coach on public.pilot_development_cycles (coach_id, status, created_at desc);
create index idx_dev_cycles_pilot on public.pilot_development_cycles (pilot_id, created_at desc);

-- ============================================================================
-- 4. Axes / étapes du cycle (le grain qualitatif)
-- ============================================================================
create table public.cycle_steps (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.pilot_development_cycles (id) on delete cascade,
  -- Focus qualitatif, descriptif (ex. « Le secteur 2, à observer sans le forcer »).
  focus text not null check (length(btrim(focus)) between 1 and 500),
  note text check (note is null or length(btrim(note)) between 1 and 1000),
  -- Virages associés (optionnel) : ordre de lecture, pas un classement.
  corner_indexes int[] not null default '{}' check (public.corner_indexes_valid(corner_indexes)),
  -- Statut = ÉTAT OBSERVÉ par le coach (jamais auto-calculé). Pas de % de réussite.
  status text not null default 'en_cours' check (status in ('en_cours', 'atteint')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_cycle_steps_cycle on public.cycle_steps (cycle_id, position);

-- ============================================================================
-- 5. Triggers updated_at (search_path durci)
-- ============================================================================
create or replace function public.dev_cycles_set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pilot_development_cycles_updated_at on public.pilot_development_cycles;
create trigger pilot_development_cycles_updated_at
  before update on public.pilot_development_cycles
  for each row execute function public.dev_cycles_set_updated_at();

drop trigger if exists cycle_steps_updated_at on public.cycle_steps;
create trigger cycle_steps_updated_at
  before update on public.cycle_steps
  for each row execute function public.dev_cycles_set_updated_at();

-- ============================================================================
-- 6. Garde-fou doctrinal EXÉCUTABLE (re-scan des axes au partage inclus)
-- ============================================================================
-- En-tête : si le cycle est PARTAGÉ, ni le titre/intention NI AUCUN axe enfant
-- ne peut contenir un verbe prescriptif. Le scan des enfants au moment du flip
-- is_shared=true ferme le trou « axe prescriptif écrit en privé puis partagé ».
create or replace function public.dev_cycle_header_doctrine_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.is_shared then
    if public.is_prescriptive(coalesce(new.title, '') || ' ' || coalesce(new.intention, '')) then
      raise exception 'doctrine_violation: programme partagé (intention) contient un terme prescriptif'
        using errcode = 'check_violation';
    end if;
    if exists (
      select 1 from public.cycle_steps s
      where s.cycle_id = new.id
        and public.is_prescriptive(coalesce(s.focus, '') || ' ' || coalesce(s.note, ''))
    ) then
      raise exception 'doctrine_violation: un axe du programme partagé contient un terme prescriptif'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists dev_cycles_doctrine_guard on public.pilot_development_cycles;
create trigger dev_cycles_doctrine_guard
  before insert or update on public.pilot_development_cycles
  for each row execute function public.dev_cycle_header_doctrine_guard();

-- Axe : si le cycle parent est PARTAGÉ, le focus/note ne peut être prescriptif.
create or replace function public.cycle_step_doctrine_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  shared boolean;
begin
  select c.is_shared into shared
    from public.pilot_development_cycles c where c.id = new.cycle_id;
  if coalesce(shared, false)
     and public.is_prescriptive(coalesce(new.focus, '') || ' ' || coalesce(new.note, '')) then
    raise exception 'doctrine_violation: axe d''un programme partagé contient un terme prescriptif'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists cycle_steps_doctrine_guard on public.cycle_steps;
create trigger cycle_steps_doctrine_guard
  before insert or update on public.cycle_steps
  for each row execute function public.cycle_step_doctrine_guard();

-- ============================================================================
-- 7. RLS
-- ============================================================================
alter table public.pilot_development_cycles enable row level security;
alter table public.cycle_steps enable row level security;

-- En-tête : coach AUTEUR de niveau programme (CRUD complet).
create policy dev_cycles_coach_all on public.pilot_development_cycles
  for all to authenticated
  using (coach_id = auth.uid() and public.is_program_coach_of(pilot_id))
  with check (coach_id = auth.uid() and public.is_program_coach_of(pilot_id));

-- En-tête : pilote en LECTURE SEULE si le programme le concernant est partagé.
create policy dev_cycles_pilot_select on public.pilot_development_cycles
  for select to authenticated
  using (pilot_id = auth.uid() and is_shared = true);

-- En-tête : admin SELECT audit.
create policy dev_cycles_admin_select on public.pilot_development_cycles
  for select to authenticated
  using (public.is_admin());

-- Axes : coach auteur du cycle parent (CRUD), via jointure sur l'en-tête.
create policy cycle_steps_coach_all on public.cycle_steps
  for all to authenticated
  using (exists (
    select 1 from public.pilot_development_cycles c
    where c.id = cycle_steps.cycle_id
      and c.coach_id = auth.uid()
      and public.is_program_coach_of(c.pilot_id)
  ))
  with check (exists (
    select 1 from public.pilot_development_cycles c
    where c.id = cycle_steps.cycle_id
      and c.coach_id = auth.uid()
      and public.is_program_coach_of(c.pilot_id)
  ));

-- Axes : pilote en LECTURE SEULE si le cycle parent est partagé et le concerne.
create policy cycle_steps_pilot_select on public.cycle_steps
  for select to authenticated
  using (exists (
    select 1 from public.pilot_development_cycles c
    where c.id = cycle_steps.cycle_id
      and c.pilot_id = auth.uid()
      and c.is_shared = true
  ));

-- Axes : admin SELECT audit. Partenaire : aucune policy (règle cardinale §148).
create policy cycle_steps_admin_select on public.cycle_steps
  for select to authenticated
  using (public.is_admin());

comment on table public.pilot_development_cycles is
  'Programme adaptatif coach (C-2, V1.5) : en-tete authore PAR LE COACH HUMAIN pour un pilote, qu il fait evoluer. L app ne genere ni n adapte jamais. Niveau programme requis. Pilote lecture seule si partage ; partenaire jamais ; admin audit.';
comment on table public.cycle_steps is
  'Axes qualitatifs d un programme coach. Focus descriptif (jamais un ordre), statut en_cours/atteint observe par le coach, aucun score chiffre. Lecture seule pilote si le cycle est partage.';
