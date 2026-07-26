-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 19 juin 2026, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Colonne média (liste de pièces jointes) sur les lieux et les pings.
alter table public.circuit_services add column if not exists media jsonb not null default '[]'::jsonb;
alter table public.lodgings        add column if not exists media jsonb not null default '[]'::jsonb;
alter table public.restaurants     add column if not exists media jsonb not null default '[]'::jsonb;
alter table public.partners        add column if not exists media jsonb not null default '[]'::jsonb;
alter table public.social_pings     add column if not exists media jsonb not null default '[]'::jsonb;

-- Bucket public pour les pièces jointes partenaire (photos, vidéos, PDF).
insert into storage.buckets (id, name, public) values ('partner-media','partner-media', true)
on conflict (id) do nothing;

-- Lecture publique ; écriture restreinte au dossier du propriétaire (= son uuid) et aux partenaires.
drop policy if exists partner_media_read   on storage.objects;
create policy partner_media_read   on storage.objects for select
  using (bucket_id = 'partner-media');

drop policy if exists partner_media_insert on storage.objects;
create policy partner_media_insert on storage.objects for insert
  with check (bucket_id = 'partner-media' and public.is_partner() and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists partner_media_update on storage.objects;
create policy partner_media_update on storage.objects for update
  using (bucket_id = 'partner-media' and public.is_partner() and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'partner-media' and public.is_partner() and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists partner_media_delete on storage.objects;
create policy partner_media_delete on storage.objects for delete
  using (bucket_id = 'partner-media' and public.is_partner() and (storage.foldername(name))[1] = auth.uid()::text);
