-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 4 juillet 2026 a 00:58:40 UTC, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- PR-SITE-30 (partie additive) : colonne de lien compte → messages entrants (CRM)
-- Aucune policy modifiée. Le durcissement anti-usurpation de la policy d'insert
-- (with check user_id null ou = auth.uid()) sera appliqué après accord fondateur.
alter table public.contact_messages
  add column user_id uuid references public.users(id) on delete set null;

comment on column public.contact_messages.user_id is
  'PR-SITE-30 — compte connecté au moment de l''envoi (null si visiteur). NB: tant que la policy d''insert n''est pas durcie, valeur indicative (non authentifiée par RLS).';

create index contact_messages_user_id_idx
  on public.contact_messages (user_id) where user_id is not null;
