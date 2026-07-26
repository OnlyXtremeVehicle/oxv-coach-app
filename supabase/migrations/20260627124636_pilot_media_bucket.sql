-- 0011 — Médias de profil pilote (vitrine vue par le coach affilié).
--
-- Contrairement à `coach-media` (vitrine commerciale PUBLIQUE), les médias du
-- pilote sont PRIVÉS : seuls le pilote lui-même, son coach affilié et les admins
-- y accèdent. L'affichage se fait par URL signée (jamais d'URL publique).
--
-- Bucket privé `pilot-media`, convention `{pilotId}/{uuid}.{ext}`.
-- Métadonnées : `users.media` (jsonb), déjà présent (migration 0009).
--
-- Lecture calquée sur `session_media_storage_select` (déjà en prod) : self OR
-- is_coach_of(pilot) OR is_admin(). Aucune exposition publique, aucune nouvelle
-- fonction : on réutilise is_coach_of() / is_admin() existantes.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pilot-media',
  'pilot-media',
  false,
  52428800, -- 50 Mo
  array['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'video/mp4', 'video/quicktime']
)
on conflict (id) do nothing;

-- Le pilote n'écrit que dans SON dossier {pilotId}/…
create policy "pilot_media_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'pilot-media' and (storage.foldername(name))[1] = (auth.uid())::text
  );

create policy "pilot_media_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'pilot-media' and (storage.foldername(name))[1] = (auth.uid())::text
  )
  with check (
    bucket_id = 'pilot-media' and (storage.foldername(name))[1] = (auth.uid())::text
  );

create policy "pilot_media_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'pilot-media' and (storage.foldername(name))[1] = (auth.uid())::text
  );

-- Lecture : le pilote, son coach affilié, ou un admin.
create policy "pilot_media_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'pilot-media'
    and (
      (storage.foldername(name))[1] = (auth.uid())::text
      or is_coach_of((((storage.foldername(name))[1]))::uuid)
      or is_admin()
    )
  );
