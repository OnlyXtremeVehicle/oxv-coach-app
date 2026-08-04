-- =============================================================================
-- PROPOSITION — LE POINTAGE DES PRÉSENCES PASSE PAR UNE RPC
--
--   *** NON APPLIQUÉE. NE PAS EXÉCUTER SANS DÉCISION FONDATEUR. ***
--
-- Fichier volontairement NON horodaté : `supabase db push` l'ignore.
--
-- Rédigée le 03/08/2026, en contrepartie du correctif proposé par l'équipe du
-- site (RPC `cancel_registration` + REVOKE UPDATE par colonne).
--
-- CES DEUX CHANGEMENTS DOIVENT ATTERRIR LE MÊME JOUR. Voir « L'ORDRE » à la fin.
-- =============================================================================
--
-- POURQUOI CETTE RPC EXISTE
--
-- Deux raisons, et la seconde vaut plus que la première.
--
-- 1. LE REVOKE DU SITE CASSERAIT LE POINTAGE
--
-- Le correctif proposé révoque `UPDATE (…, attended_at, …)` à `authenticated`.
-- Or l'application écrit cette colonne — c'est sa SEULE écriture sur
-- `registrations`, dans `src/services/attendanceService.ts:173`, appelée depuis
-- `app/(admin)/presences.tsx:121` : le pointage au circuit.
--
-- Le grant se vérifie AVANT la RLS. Révoquer à `authenticated` retire donc le
-- droit aux administrateurs aussi : `is_admin()` est une policy, pas un grant.
--
-- Et l'échec serait total. L'application écrit trois colonnes d'un coup —
-- `attended_at`, `attended_by`, `attendance_updated_at` — dont deux ne figurent
-- pas dans la liste de révocation. Postgres rejette l'instruction entière dès
-- qu'une colonne manque au droit : le pointage tomberait net, le jour d'un
-- roulage, au circuit.
--
-- 2. LA GARDE DE TRANSITION EST AUJOURD'HUI CÔTÉ CLIENT
--
-- `decisionPointage` (`src/services/presenceLogic.ts:57`) interdit de pointer
-- une inscription annulée, absente déclarée, ou déjà pointée. Elle tourne dans
-- l'application, donc **n'importe quel jeton authentifié peut l'ignorer** et
-- écrire `attended_at` directement.
--
-- C'est la même faille que celle que le site vient de trouver sur `status`, sur
-- une autre colonne. Et c'est le principe que l'équipe du site énonce
-- elle-même : « la faille doit être fermée avant d'écrire la règle, sinon la
-- règle est décorative. »
--
-- Cette RPC porte la garde en base. Elle cesse d'être contournable.
--
-- ---------------------------------------------------------------------------
-- LA RÈGLE PORTÉE, MOT POUR MOT
--
-- Elle vient du plan de montage V3 : « L'application n'écrit `attended` que
-- depuis `pending` ou `confirmed`. Jamais autrement, jamais en écrasement. »
--
--   • pointer   : autorisé depuis `pending` ou `confirmed` SEULEMENT,
--                 et seulement si la présence n'est pas déjà posée ;
--   • dépointer : TOUJOURS autorisé.
--
-- Le dépointage reste libre, et c'est délibéré. Pointer par erreur arrive — un
-- scan de trop, un homonyme. Si le retour en arrière était soumis à la même
-- condition, une erreur commise depuis un statut devenu invalide serait
-- impossible à corriger depuis l'application, et se réparerait à la main dans
-- la base. On borne l'écriture d'un fait, jamais son retrait.
--
-- ---------------------------------------------------------------------------
-- CE QUE CETTE RPC NE FAIT PAS
--
-- Elle ne touche PAS `status`. Poser une présence ne fait pas passer une
-- inscription à `attended` : cette transition appartient au site, et la
-- confondre avec le pointage mélangerait deux faits distincts — « le pilote
-- était là » et « le dossier est soldé ».
-- =============================================================================

create or replace function public.mark_attendance(
  p_registration_id uuid,
  p_attended boolean
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_statut text;
  v_deja   boolean;
begin
  -- Réservée à l'administration. `is_admin()` lit `users.role` du compte
  -- courant ; en `security definer`, il faut le contrôler explicitement, la
  -- RLS ne s'appliquant plus.
  if not public.is_admin() then
    raise exception 'Pointage réservé à l''administration.'
      using errcode = '42501';
  end if;

  select status::text, attended_at is not null
    into v_statut, v_deja
    from public.registrations
   where id = p_registration_id;

  if not found then
    raise exception 'Inscription introuvable.' using errcode = 'P0002';
  end if;

  if p_attended then
    -- « Jamais en écrasement » : une présence déjà enregistrée est un fait
    -- daté. La ré-horodater réécrirait l'heure d'arrivée sans que personne ne
    -- le voie.
    if v_deja then
      raise exception 'La présence est déjà enregistrée. Retirez-la d''abord pour la reposer.'
        using errcode = 'P0001';
    end if;

    if v_statut is null or v_statut not in ('pending', 'confirmed') then
      raise exception 'Inscription % : présence non posable.', coalesce(v_statut, 'sans statut')
        using errcode = 'P0001';
    end if;
  end if;

  update public.registrations
     set attended_at            = case when p_attended then now() else null end,
         -- L'AUTEUR ET L'INSTANT DU GESTE, distincts de l'heure de présence.
         -- Dépointer efface la présence mais garde la trace de qui l'a fait :
         -- c'est justement le geste qu'on voudra pouvoir expliquer.
         attended_by            = auth.uid(),
         attendance_updated_at  = now()
   where id = p_registration_id;
end;
$$;

revoke all on function public.mark_attendance(uuid, boolean) from public, anon;
grant execute on function public.mark_attendance(uuid, boolean) to authenticated;

comment on function public.mark_attendance(uuid, boolean) is
  'Pointage des présences, réservé à l''administration. Porte en base la règle '
  '« attended seulement depuis pending ou confirmed, jamais en écrasement ». '
  'Le dépointage reste toujours permis. Ne touche pas registrations.status.';

-- =============================================================================
-- L'ORDRE, ET IL N'EST PAS INDIFFÉRENT
--
-- 1. Cette RPC est appliquée. Le pointage direct fonctionne encore : rien ne
--    casse, rien n'est encore protégé.
-- 2. L'application bascule sur la RPC — un seul fichier,
--    `src/services/attendanceService.ts`, dont l'`update` devient un `rpc`.
--    La garde `decisionPointage` reste côté client POUR L'AFFICHAGE (dire
--    pourquoi le bouton refuse), mais elle n'est plus la seule.
-- 3. Le site applique son REVOKE. Le pointage direct devient impossible pour
--    tout le monde, et la RPC est le seul chemin.
--
-- Inverser 2 et 3 casse le pointage entre les deux. Les faire le même jour ne
-- suffit pas : c'est l'ordre qui compte.
--
-- APRÈS APPLICATION — CE QU'IL FAUT VÉRIFIER
--
--   select proname, prosecdef from pg_proc
--    where proname = 'mark_attendance';        -- attendu : t
--
-- Puis la preuve qui compte, et elle n'est pas en SQL : depuis un compte
-- PILOTE, appeler la RPC sur sa propre inscription et obtenir 42501. Une
-- fonction déclarée `security definer` ne prouve pas qu'elle refuse — c'est
-- exactement l'omission qui avait laissé SEC-2 inerte deux jours.
-- =============================================================================
