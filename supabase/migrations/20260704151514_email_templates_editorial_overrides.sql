-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 4 juillet 2026 a 15:15:14 UTC, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Surcharge éditoriale des emails (module admin-emails du fondateur : la table
-- n'avait jamais été créée — ses sauvegardes échouaient). Lecture par les Edge
-- Functions en service role ; écriture admin uniquement.
create table public.email_templates (
  template_key text primary key,
  label        text,
  subject      text,
  html_body    text,
  variables    jsonb not null default '[]'::jsonb,
  enabled      boolean not null default false,
  updated_by   uuid references public.users(id) on delete set null,
  updated_at   timestamptz not null default now()
);

comment on table public.email_templates is
  'Surcharges éditoriales des emails transactionnels (module admin-emails). enabled=true + clé branchée dans une Edge Function = le texte admin remplace le template codé. Clés branchées : contact_recu (send-contact-ack, toutes sources), corporate_recu (send-contact-ack si source corporate), candidature_recue (send-application-ack).';

alter table public.email_templates enable row level security;

create policy email_templates_admin_all on public.email_templates
  for all to authenticated
  using (is_admin()) with check (is_admin());

create or replace function public.email_templates_touch()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
revoke execute on function public.email_templates_touch() from public, anon, authenticated;

create trigger trg_email_templates_touch
  before update on public.email_templates
  for each row execute function public.email_templates_touch();
