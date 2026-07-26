-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 4 juillet 2026 a 12:51:35 UTC, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- PR-SITE-30 (durcissement approuvé fondateur 2026-07-04) : anti-usurpation user_id.
-- Un visiteur ne peut plus attribuer un message à un compte qu'il ne possède pas.
-- Les formulaires du site envoient user_id null (visiteur) ou l'id de la session réelle.
drop policy contact_messages_insert_public on public.contact_messages;
create policy contact_messages_insert_public on public.contact_messages
  for insert
  with check (user_id is null or user_id = (select auth.uid()));

comment on column public.contact_messages.user_id is
  'PR-SITE-30 — compte connecté au moment de l''envoi (null si visiteur). Policy d''insert : user_id null ou = auth.uid() (anti-usurpation, approuvé fondateur 2026-07-04).';
