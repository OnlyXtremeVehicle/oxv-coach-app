-- =============================================================================
-- COUVERTURE DE LA PURGE — vérification COLONNE PAR COLONNE
--
-- Lecture seule. À exécuter sur la base de production quand le schéma bouge.
-- =============================================================================
--
-- POURQUOI CE FICHIER EXISTE
--
-- Le lot 10 demande de « vérifier table par table ». Une vérification faite une
-- fois et racontée dans un document cesse d'être vraie à la migration suivante.
-- Celle-ci se rejoue.
--
-- ELLE PORTE SUR LES COLONNES, PAS SUR LES TABLES. Un premier essai comparait
-- les noms de tables : `registrations` ressortait « couverte » parce que
-- `event_registrations` apparaît dans la fonction. Faux positif silencieux, sur
-- la table la plus sensible du lot. La requête ci-dessous exige que la MÊME
-- instruction cite la table ET la colonne.
--
-- Elle reste une heuristique textuelle : elle prouve qu'une colonne est
-- mentionnée dans une instruction qui vise sa table, pas que le prédicat est
-- juste. Elle sert à ne rien OUBLIER, pas à valider une logique.
--
-- La preuve complète serait un test d'exécution — créer un compte, produire de
-- la donnée partout, purger, compter ce qui reste. Il ne peut pas tourner en
-- production : il faut une branche Supabase. Noté comme tel.
-- =============================================================================

with fk as (
  select replace(c.conrelid::regclass::text, 'public.', '') as tbl,
         a.attname as col
  from pg_constraint c
  join unnest(c.conkey) k on true
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k
  where c.contype = 'f'
    and c.confrelid = 'public.users'::regclass
),
def as (
  select pg_get_functiondef(p.oid) as d
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'purge_user_data'
),
-- Le corps est découpé en instructions : la table et la colonne doivent
-- apparaître dans LA MÊME, sinon la coïncidence ne prouve rien.
instructions as (
  select trim(s) as s from def, unnest(string_to_array(def.d, ';')) as s
)
select fk.tbl,
       fk.col,
       exists (
         select 1 from instructions i
         where i.s like '%public.' || fk.tbl || '%'   -- « public. » évite que
           and i.s like '%' || fk.col || '%'          -- `registrations` matche
       ) as couverte                                  -- `event_registrations`
from fk
order by couverte, fk.tbl, fk.col;

-- -----------------------------------------------------------------------------
-- ÉTAT AU 28/07/2026, APRÈS CORRECTION : 88 couples, 60 couverts, 27 non couverts.
--
-- Sur ces 27, la matrice de purge (docs/architecture/14_PURGE_MATRIX.md) les
-- justifie TOUS :
--
--   * rétention comptable de 10 ans  → payments, registrations, invoices,
--     subscriptions (§ « conservation volontaire »)
--   * colonnes d'ACTEUR administratif conservées → validated_by, reviewed_by,
--     checked_in_by, decided_by, cancelled_by, certified_by, granted_by,
--     created_by, read_by, updated_by, generated_by, owner_admin_id,
--     kyc_validated_by, suspended_by, assigned_by
--   * décision produit assumée → crews.captain_id
--
-- Le seul vrai trou, `coach_payout_details`, est FERMÉ depuis le 28/07/2026 :
-- migration 20260728161513_l10_purge_coach_payout_details.sql. Avant elle, un
-- IBAN survivait à la suppression du compte.
-- -----------------------------------------------------------------------------

-- Copies de données personnelles hors de tout périmètre de purge.
-- La matrice en cite deux ; il y en a cinq.
select c.relname,
       c.relrowsecurity as rls_active,
       has_table_privilege('anon', c.oid, 'SELECT')          as lisible_anon,
       has_table_privilege('authenticated', c.oid, 'SELECT') as lisible_authentifie
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname like '\_backup%'
order by c.relname;

-- ÉTAT AU 28/07/2026 : cinq tables, aucune lisible par `anon` ni par
-- `authenticated` — le GRANT est absent, donc PostgREST ne les sert pas, que la
-- RLS soit active ou non. Ce n'est PAS une exposition. C'est un défaut
-- d'effacement : un compte purgé survit dans ces copies.
