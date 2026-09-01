-- LES REFERENCES PARTAGEES — M09, « Gestionnaire de references ».
--
-- Le cahier de veille specifie ce module mot pour mot, et il porte SA PROPRE
-- limite : « Partage inter-pilotes autorise, EQUITABLE, REVOCABLE et
-- ANONYMISABLE. » Les trois adjectifs ne sont pas decoratifs — chacun devient
-- une contrainte ci-dessous, parce qu'une limite ecrite dans un document et
-- nulle part ailleurs n'arrete rien.
--
-- EQUITABLE — le proprietaire de la donnee consent, et sans lui la reference
-- n'existe pas. M09 dit « le coach publie la reference » ; il publie ce qui
-- lui est confie, il ne dispose pas du tour d'un pilote. `consent_owner_at`
-- nul = reference inexistante pour toute lecture.
--
-- REVOCABLE — `revoked_at`. Le pilote coupe quand il veut, sans demander, et
-- la reference disparait des lectures a l'instant meme.
--
-- ANONYMISABLE — `anonyme`, VRAI par defaut. Le brief est plus strict que le
-- cahier sur ce point : « jamais a un autre pilote nomme, teammate compris ».
-- Le defaut suit donc le brief.
--
-- CE QUE LA REFERENCE PORTE, et c'est le critere d'acceptation de M09 :
-- « Provenance, date, vehicule, conditions et compatibilite visibles. » La
-- provenance et la date sont ici ; le vehicule et les conditions se lisent sur
-- la seance referencee ; la compatibilite se CALCULE — `comparabiliteLogic`
-- existe depuis le lot 4 et n'est pas redouble.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'reference_portee') then
    create type public.reference_portee as enum ('coach_seul', 'pilotes_du_coach', 'ecurie');
  end if;
end $$;

comment on type public.reference_portee is
  'A qui une reference est offerte. Jamais « tout le monde » : une reference publique heurterait l''interdit de classement.';

create table if not exists public.session_references (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.telemetry_sessions(id) on delete cascade,
  lap_number integer check (lap_number is null or lap_number >= 1),
  owner_id uuid not null references public.users(id) on delete cascade,
  published_by uuid not null references public.users(id) on delete cascade,
  demontre text not null check (length(btrim(demontre)) > 0),
  portee public.reference_portee not null default 'coach_seul',
  anonyme boolean not null default true,
  consent_owner_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.session_references is
  'M09 — references publiees pour comparaison. Partage inter-pilotes EQUITABLE (consentement du proprietaire), REVOCABLE (revoked_at) et ANONYMISABLE (anonyme, vrai par defaut).';
comment on column public.session_references.owner_id is
  'Le pilote DONT c''est la donnee. Distinct de published_by : le coach publie ce qui lui est confie.';
comment on column public.session_references.consent_owner_at is
  'Sans lui, la reference n''existe pour aucune lecture. C''est l''« equitable » de M09.';
comment on column public.session_references.anonyme is
  'VRAI par defaut : le brief interdit de comparer un pilote a un autre pilote NOMME.';

create index if not exists session_references_vivantes
  on public.session_references (owner_id)
  where consent_owner_at is not null and revoked_at is null;

create index if not exists session_references_par_seance
  on public.session_references (session_id);

alter table public.session_references enable row level security;

create policy session_references_owner_all on public.session_references
  for select using (owner_id = auth.uid());

create policy session_references_publisher_select on public.session_references
  for select using (published_by = auth.uid());

create policy session_references_coach_select on public.session_references
  for select using (
    consent_owner_at is not null
    and revoked_at is null
    and public.is_coach_of(owner_id)
  );

create policy session_references_coach_insert on public.session_references
  for insert with check (
    published_by = auth.uid()
    and public.is_coach_of(owner_id)
    and exists (
      select 1 from public.telemetry_sessions s
      where s.id = session_id and s.user_id = owner_id
    )
  );

create policy session_references_update on public.session_references
  for update using (published_by = auth.uid() or owner_id = auth.uid())
  with check (published_by = auth.uid() or owner_id = auth.uid());

create policy session_references_delete_admin on public.session_references
  for delete using (public.is_admin());

create or replace function public.reference_proprietaire_ne_change_que_consentement()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() = new.owner_id and auth.uid() <> new.published_by then
    if new.demontre is distinct from old.demontre
       or new.portee is distinct from old.portee
       or new.session_id is distinct from old.session_id
       or new.lap_number is distinct from old.lap_number then
      raise exception 'Le proprietaire ne change que son consentement et sa revocation.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_reference_proprietaire on public.session_references;
create trigger trg_reference_proprietaire
  before update on public.session_references
  for each row execute function public.reference_proprietaire_ne_change_que_consentement();
