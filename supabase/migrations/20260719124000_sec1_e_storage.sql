-- ============================================================================
-- SEC-1 — PRÉPARÉE, NON APPLIQUÉE — approbation fondateur requise
-- ============================================================================
-- Lot E — Storage : sous-dossier incidents de pilot-media
--
-- Constat prod (inspection 2026-07-19, lecture seule) :
--   - Bucket pilot-media : privé. Écritures (INSERT/UPDATE/DELETE) déjà
--     bornées au propriétaire ((storage.foldername(name))[1] = auth.uid()).
--   - MAIS la policy de lecture pilot_media_select donne aussi accès au COACH
--     du pilote (is_coach_of) sur TOUT pilot-media/{uid}/**, y compris le
--     sous-dossier incidents/ (photos de déclarations d'incident — sensibles,
--     précontentieux possible).
--
-- Règle cible pilot-media/{uid}/incidents/** :
--   - écriture : le pilote lui-même uniquement (DÉJÀ le cas — rien à changer) ;
--   - lecture  : le pilote lui-même + admin — le coach est EXCLU de incidents/.
--
-- Rollback : recréer pilot_media_select avec sa définition d'origine
-- (is_coach_of sans exclusion incidents — archivée dans
-- docs/architecture/SEC1_PROD_APPLY.md §Annexe).
-- ============================================================================

drop policy if exists pilot_media_select on storage.objects;

create policy pilot_media_select
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'pilot-media'
    and (
      -- Le pilote lit ses propres médias, incidents compris.
      (storage.foldername(name))[1] = (auth.uid())::text
      -- L'admin lit tout (traitement des incidents).
      or is_admin()
      -- Le coach lit les médias de ses pilotes, SAUF le dossier incidents.
      or (
        is_coach_of(((storage.foldername(name))[1])::uuid)
        and (storage.foldername(name))[2] is distinct from 'incidents'
      )
    )
  );

-- Note : les policies d'écriture existantes (pilot_media_insert/update/delete,
-- owner-only) couvrent déjà « write own » pour incidents/** — conservées telles
-- quelles, aucune modification.
