-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 19 juillet 2026 a 01:12:17 UTC, elle n avait jamais ete
-- versionnee dans ce depot sous sa version reelle. Source : colonne statements, recollee
-- dans l ordre d execution. Le formatage d origine et les commentaires hors instruction
-- sont perdus ; le SQL, lui, est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- SEC-1 lot E — pilot-media/{uid}/incidents/** : coach exclu de la lecture
-- (source repo : supabase/migrations/20260719124000_sec1_e_storage.sql)

drop policy if exists pilot_media_select on storage.objects;

create policy pilot_media_select
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'pilot-media'
    and (
      (storage.foldername(name))[1] = (auth.uid())::text
      or is_admin()
      or (
        is_coach_of(((storage.foldername(name))[1])::uuid)
        and (storage.foldername(name))[2] is distinct from 'incidents'
      )
    )
  );
