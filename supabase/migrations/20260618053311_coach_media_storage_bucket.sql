-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 18 juin 2026 a 05:33:11, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Bucket public pour la galerie coach (portrait + photos). Écriture limitée au dossier du coach.
insert into storage.buckets (id, name, public)
values ('coach-media', 'coach-media', true)
on conflict (id) do nothing;

create policy "Anyone can view coach media"
  on storage.objects for select to public
  using (bucket_id = 'coach-media');

create policy "Coaches can upload own media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'coach-media' and (storage.foldername(name))[1] = auth.uid()::text and public.is_coach());

create policy "Coaches can update own media"
  on storage.objects for update to authenticated
  using (bucket_id = 'coach-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'coach-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Coaches can delete own media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'coach-media' and (storage.foldername(name))[1] = auth.uid()::text);
