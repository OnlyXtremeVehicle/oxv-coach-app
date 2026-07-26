-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 18 juin 2026, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Parsing UUID sûr (null si invalide) — pour joindre le nom d'objet à l'annotation sans risque de cast.
create or replace function public.uuid_or_null(t text) returns uuid
language plpgsql immutable as $$
begin
  return t::uuid;
exception when others then
  return null;
end$$;

-- Bucket privé pour l'audio des annotations. Nom d'objet = id de l'annotation (sans extension).
insert into storage.buckets (id, name, public)
values ('coach-audio', 'coach-audio', false)
on conflict (id) do nothing;

-- Lecture : le coach pour ses annotations ; le pilote uniquement pour une annotation PARTAGÉE,
-- non supprimée, qui lui est adressée. La visibilité est appliquée au niveau du stockage.
create policy "coach_audio_select" on storage.objects for select to authenticated
using (
  bucket_id = 'coach-audio' and exists (
    select 1 from public.coach_annotations a
    where a.id = public.uuid_or_null(name)
      and a.deleted_at is null
      and (a.coach_id = auth.uid() or (a.pilot_id = auth.uid() and a.visibility = 'shared'))
  )
);

-- Écriture : le coach uniquement, et uniquement pour une de ses propres annotations.
create policy "coach_audio_insert" on storage.objects for insert to authenticated
with check (
  bucket_id = 'coach-audio' and exists (
    select 1 from public.coach_annotations a
    where a.id = public.uuid_or_null(name) and a.coach_id = auth.uid()
  )
);
create policy "coach_audio_update" on storage.objects for update to authenticated
using (
  bucket_id = 'coach-audio' and exists (
    select 1 from public.coach_annotations a
    where a.id = public.uuid_or_null(name) and a.coach_id = auth.uid()
  )
);
create policy "coach_audio_delete" on storage.objects for delete to authenticated
using (
  bucket_id = 'coach-audio' and exists (
    select 1 from public.coach_annotations a
    where a.id = public.uuid_or_null(name) and a.coach_id = auth.uid()
  )
);
