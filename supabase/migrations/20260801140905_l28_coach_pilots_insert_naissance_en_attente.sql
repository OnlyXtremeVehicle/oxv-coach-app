-- =============================================================================
-- L28 — un coach ne se consent pas lui-même une affiliation
--
-- APPLIQUÉE EN PRODUCTION le 01/08/2026 (version 20260801140905), sur accord
-- explicite du fondateur, AVEC le durcissement du trigger SEC-3 qu'il a demandé.
-- =============================================================================
--
-- LE DÉFAUT, VÉRIFIÉ EN PRODUCTION AVANT CORRECTION
--
-- `coach_pilots_insert_by_coach` n'imposait que trois choses :
--
--     coach_id = auth.uid() AND is_coach() AND initiated_by = 'coach'
--
-- **Aucune restriction de colonne.** Un compte portant `role = 'coach'` pouvait
-- donc insérer, pour un pilote qu'il n'avait jamais rencontré, une ligne où il
-- posait lui-même `pilot_consent_at`, `live_sharing_at` et
-- `level = 'lecture_detaillee'`.
--
-- Le garde-fou SEC-3 (`guard_coach_pilots_colonnes`), qui interdit précisément à
-- un coach d'écrire ces colonnes, était un trigger **BEFORE UPDATE seulement**.
-- Il ne voyait jamais une insertion. La garde existait, elle ne se déclenchait
-- pas — le motif récurrent de ce dépôt.
--
-- `UNIQUE (coach_id, pilot_id)` ne protégeait pas : il n'empêche que la SECONDE
-- ligne, et l'attaque visait justement un pilote sans ligne existante.
--
-- Relevé par la revue adversariale du lot 27a-bis, le 01/08/2026.
--
-- ---------------------------------------------------------------------------
-- CE QUE CELA OUVRAIT
--
-- Toutes les lectures qui dérivent de `coach_pilots`, pas seulement la
-- biométrie : `is_coach_of` et `is_detailed_coach_of` commandent l'accès aux
-- séances, aux trames de télémétrie, aux analyses de segments et au carnet. Le
-- canal biométrie n'était que l'endroit où la revue l'a trouvé.
--
-- **Dégât réel : nul.** 0 compte coach en production au 01/08/2026, et l'unique
-- ligne de `coach_pilots` vient du chemin ADMIN. Fermé avant le premier coach.
--
-- ---------------------------------------------------------------------------
-- LA RÈGLE POSÉE
--
-- Une affiliation demandée par un coach naît EN ATTENTE. Le consentement et le
-- niveau appartiennent au pilote — ce que le produit fait déjà
-- (`assignPilotToCoach` laisse `pilot_consent_at` nul), désormais écrit dans le
-- schéma.
--
-- `active` n'est PAS contraint : son défaut est `true`, et `status = 'pending'`
-- suffit à écarter la ligne de `consentedCoaches`, qui exige les quatre
-- conditions. Le contraindre aurait cassé le chemin d'insertion existant — la
-- rédaction initiale le faisait, erreur corrigée AVANT application.
--
-- ---------------------------------------------------------------------------
-- LE TRIGGER — POURQUOI UN BRAS SÉPARÉ
--
-- Le corps d'origine déréférence `old` de bout en bout. En insertion, `old`
-- n'est pas assigné et plpgsql lèverait une erreur. Le bras INSERT est donc
-- écrit AVANT, et sort par son propre `return` sans jamais toucher `old`.
--
-- Le corps UPDATE est reproduit **à l'identique**, sans une virgule de
-- changement.
-- =============================================================================

-- --- 1. La policy ----------------------------------------------------------

drop policy if exists coach_pilots_insert_by_coach on public.coach_pilots;

create policy coach_pilots_insert_by_coach
  on public.coach_pilots
  for insert
  to authenticated
  with check (
    coach_id = (select auth.uid())
    and public.is_coach()
    and initiated_by = 'coach'
    and pilot_consent_at is null
    and live_sharing_at is null
    and status = 'pending'
    and level = 'lecture_simple'
  );

-- --- 2. Le garde-fou SEC-3, rendu symétrique --------------------------------

create or replace function public.guard_coach_pilots_colonnes()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  acteur uuid := auth.uid();
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin', 'supabase_auth_admin')
     or coalesce(public.is_admin(), false) then
    return new;
  end if;

  -- INSERTION — une demande naît en attente, quel que soit celui qui la pose.
  if tg_op = 'INSERT' then
    if acteur = new.coach_id and acteur is distinct from new.pilot_id then
      if new.pilot_consent_at is not null
         or new.live_sharing_at is not null
         or new.status is distinct from 'pending'::affiliation_status
         or new.level is distinct from 'lecture_simple'::coach_access_level then
        raise exception
          'OXV: le consentement et le niveau de lecture appartiennent au pilote'
          using errcode = '42501';
      end if;
    end if;

    if acteur = new.pilot_id and acteur is distinct from new.coach_id then
      if new.coach_consent_at is not null
         or new.affiliation_price_eur is not null
         or new.notes is not null then
        raise exception
          'OXV: la note, le tarif et l''acceptation appartiennent au coach'
          using errcode = '42501';
      end if;
    end if;

    return new;
  end if;

  -- MODIFICATION — corps d'origine, inchangé.
  if new.id is distinct from old.id
     or new.coach_id is distinct from old.coach_id
     or new.pilot_id is distinct from old.pilot_id
     or new.created_by is distinct from old.created_by
     or new.initiated_by is distinct from old.initiated_by then
    raise exception 'OXV: l''identité d''un binôme ne se modifie pas'
      using errcode = '42501';
  end if;

  if acteur = old.coach_id and acteur is distinct from old.pilot_id then
    if new.pilot_consent_at is distinct from old.pilot_consent_at
       or new.live_sharing_at is distinct from old.live_sharing_at
       or new.level is distinct from old.level then
      raise exception
        'OXV: le consentement et le niveau de lecture appartiennent au pilote'
        using errcode = '42501';
    end if;
  end if;

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

drop trigger if exists trg_guard_coach_pilots_colonnes on public.coach_pilots;

create trigger trg_guard_coach_pilots_colonnes
  before insert or update on public.coach_pilots
  for each row execute function public.guard_coach_pilots_colonnes();
