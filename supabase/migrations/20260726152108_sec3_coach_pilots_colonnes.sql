-- ============================================================================
-- SEC-3 — Un coach ne peut plus s'accorder lui-même le consentement du pilote
--
-- APPLIQUÉE EN PRODUCTION le 26/07/2026 à 15:21:08 UTC, sur accord explicite du fondateur.
-- Les instructions exécutées sont celles de ce fichier ; seuls l'en-tête
-- explicatif et le protocole de vérification en fin de fichier n'en font pas
-- partie. Le texte exact exécuté est conservé dans
-- supabase_migrations.schema_migrations.
--
-- LE DÉFAUT, vérifié en production le 26/07/2026
-- ---------------------------------------------------------------------------
-- La policy `coach_pilots_update_by_coach` s'écrit :
--     UPDATE  USING (coach_id = auth.uid())  WITH CHECK (coach_id = auth.uid())
-- Aucune restriction de COLONNE. Le coach peut donc écrire, sur sa propre ligne
-- de binôme, les colonnes qui appartiennent au PILOTE :
--     pilot_consent_at   — le consentement de coaching
--     live_sharing_at    — le consentement au partage en direct
--     level              — lecture_simple / lecture_detaillee / programme
--
-- Or `src/services/liveRelayRunner.ts` n'émet le flux qu'aux binômes remplissant
-- QUATRE conditions : active, status = 'active', pilot_consent_at non nul,
-- live_sharing_at non nul. Trois de ces quatre sont écrivables par le coach.
-- Et `level = 'lecture_detaillee'` est précisément ce qui ouvre la FRÉQUENCE
-- CARDIAQUE, donnée de l'article 9 du RGPD.
--
-- Un coach peut donc, aujourd'hui, en une requête : se déclarer consenti par son
-- pilote, s'ouvrir le partage en direct, monter son propre niveau, et recevoir
-- la télémétrie ET le cardio d'un pilote qui n'a jamais rien accordé.
--
-- POURQUOI UN DÉCLENCHEUR ET NON DES DROITS DE COLONNE
-- ---------------------------------------------------------------------------
-- Les GRANT de colonne s'appliquent au RÔLE, or le coach et le pilote sont tous
-- deux `authenticated` : révoquer `UPDATE (pilot_consent_at)` priverait aussi le
-- pilote de son propre consentement. Seul un déclencheur voit QUI agit.
--
-- CE QUE FAIT CE CORRECTIF
-- ---------------------------------------------------------------------------
-- Il refuse qu'un côté écrive les colonnes de l'autre. Purement restrictif :
-- aucune donnée modifiée, aucune policy supprimée, administrateurs et
-- service_role inchangés. Réversible en supprimant le déclencheur.
-- ============================================================================

begin;

create or replace function public.guard_coach_pilots_colonnes()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  acteur uuid := auth.uid();
begin
  -- Les rôles techniques et les administrateurs ne sont pas concernés : ce
  -- garde-fou arbitre entre les DEUX parties du binôme, pas l'exploitation.
  if current_user in ('service_role', 'postgres', 'supabase_admin', 'supabase_auth_admin')
     or coalesce(public.is_admin(), false) then
    return new;
  end if;

  -- L'identité du binôme ne change jamais par une mise à jour.
  if new.id is distinct from old.id
     or new.coach_id is distinct from old.coach_id
     or new.pilot_id is distinct from old.pilot_id
     or new.created_by is distinct from old.created_by
     or new.initiated_by is distinct from old.initiated_by then
    raise exception 'OXV: l''identité d''un binôme ne se modifie pas'
      using errcode = '42501';
  end if;

  -- LE COACH n'écrit pas ce que le PILOTE accorde. C'est le cœur du correctif.
  if acteur = old.coach_id and acteur is distinct from old.pilot_id then
    if new.pilot_consent_at is distinct from old.pilot_consent_at
       or new.live_sharing_at is distinct from old.live_sharing_at
       or new.level is distinct from old.level then
      raise exception
        'OXV: le consentement et le niveau de lecture appartiennent au pilote'
        using errcode = '42501';
    end if;
  end if;

  -- Symétrie : le PILOTE n'écrit pas ce qui relève du coach. Moins grave, mais
  -- une relation n'est saine que si chacun ne tient que sa part.
  if acteur = old.pilot_id and acteur is distinct from old.coach_id then
    if new.coach_consent_at is distinct from old.coach_consent_at
       or new.affiliation_price_eur is distinct from old.affiliation_price_eur
       or new.notes is distinct from old.notes then
      raise exception
        'OXV: la note, le tarif et l''acceptation appartiennent au coach'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$function$;

comment on function public.guard_coach_pilots_colonnes() is
  'Chaque partie du binôme n''écrit que ses propres colonnes. Posé le 26/07/2026 : '
  'sans lui, un coach pouvait s''accorder pilot_consent_at, live_sharing_at et '
  'level, donc atteindre la télémétrie et la fréquence cardiaque d''un pilote '
  'qui n''avait rien accordé.';

drop trigger if exists trg_guard_coach_pilots_colonnes on public.coach_pilots;
create trigger trg_guard_coach_pilots_colonnes
  before update on public.coach_pilots
  for each row
  execute function public.guard_coach_pilots_colonnes();

commit;

-- ============================================================================
-- VÉRIFICATION APRÈS APPLICATION
-- ============================================================================
-- 1. Le déclencheur est en place :
--      select tgname from pg_trigger
--      where tgrelid = 'public.coach_pilots'::regclass
--        and tgname = 'trg_guard_coach_pilots_colonnes';
--
-- 2. Essai réel, depuis une session authentifiée qui est le COACH d'un binôme :
--      update public.coach_pilots set pilot_consent_at = now() where coach_id = auth.uid();
--    doit échouer avec 42501.
--
-- 3. Le pilote garde la main sur son propre consentement :
--      update public.coach_pilots set pilot_consent_at = now() where pilot_id = auth.uid();
--    doit RÉUSSIR.
--
-- 4. AVANT d'appliquer, relever l'état des binômes existants — le correctif
--    ferme la porte, il ne défait pas ce qui est déjà passé :
--      select coach_id, pilot_id, status, level,
--             pilot_consent_at, live_sharing_at, coach_consent_at
--      from public.coach_pilots;
--    Au 26/07/2026 : UNE seule ligne, restée en status = 'pending'.
--    Si une ligne porte pilot_consent_at sans que le pilote l'ait accordé,
--    elle demande une explication avant d'aller plus loin.
-- ============================================================================
