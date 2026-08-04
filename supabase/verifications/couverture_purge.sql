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
-- ELLE PORTE SUR LES DEUX RÉFÉRENTIELS. Deuxième correction, celle de l'audit
-- du 28/07 : la version d'origine ne regardait que les clés étrangères vers
-- `public.users`. **32 couples pointent vers `auth.users`**, dont 25 hors
-- purge — `pilot_notes`, `pilot_waiver_signatures`, `pilot_signature_snapshots`,
-- `coach_invoices`, `pilot_development_cycles`, et treize autres.
--
-- La défense évidente — « ces FK sont ON DELETE CASCADE » — ne tient pas :
-- `purge-deleted-accounts/index.ts` étape 4 ANONYMISE et bannit le compte Auth
-- au lieu de le supprimer, motif écrit dans le code (« pas de hard-delete pour
-- ne pas déclencher la cascade bloquée par payments »). La cascade ne part
-- jamais. Ces lignes survivent donc à la purge.
--
-- Toutes ces tables sont à zéro ligne au 28/07/2026, sauf deux colonnes
-- d'acteur administratif. Le préjudice est nul aujourd'hui ; la classe est
-- réelle et se remplira.
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
    -- LES DEUX référentiels. `public.users` seul laissait 25 couples hors champ.
    and c.confrelid in ('public.users'::regclass, 'auth.users'::regclass)
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
-- ÉTAT AU 28/07/2026, sur le SEUL référentiel `public.users` : 87 couples —
-- 59 couverts avant la migration 20260728161513, 60 après. (J'avais écrit
-- « 88 » puis « 60 avant » : le premier venait d'un comptage à l'œil sur une
-- longue liste JSON au lieu d'un count(*), le second était impossible par
-- construction — faire entrer une table dans la purge fait forcément CROÎTRE
-- le nombre de couverts.)
--
-- En ajoutant `auth.users` : **119 couples, 67 couverts, 52 non couverts** —
-- chiffres obtenus par count(*), pas par addition.
--
-- Sur les 27 du seul référentiel `public.users`, la matrice de purge
-- (docs/architecture/14_PURGE_MATRIX.md) les justifie TOUS :
--
--   * rétention comptable de 10 ans  → payments, registrations, invoices,
--     subscriptions (§ « conservation volontaire »)
--   * colonnes d'ACTEUR administratif conservées → validated_by, reviewed_by,
--     checked_in_by, decided_by, cancelled_by, certified_by, granted_by,
--     created_by, read_by, updated_by, generated_by, owner_admin_id,
--     kyc_validated_by, suspended_by, assigned_by
--   * décision produit assumée → crews.captain_id
--
-- Le seul vrai trou de CE référentiel, `coach_payout_details`, est FERMÉ depuis
-- le 28/07/2026 : migration 20260728161513. Avant elle, un IBAN survivait à la
-- suppression du compte.
--
-- LES 25 AUTRES, côté `auth.users`, NE SONT PAS STATUÉS. La matrice ne les
-- mentionne nulle part. Toutes leurs tables sont à zéro ligne au 28/07 sauf
-- `app_feature_flags.updated_by` (7) et `app_config.updated_by` (1), deux
-- colonnes d'acteur administratif que la matrice conserve déjà par principe.
--
-- Le préjudice est donc nul aujourd'hui. Il ne le restera pas : `pilot_notes`,
-- `pilot_waiver_signatures`, `pilot_signature_snapshots`, `coach_invoices` et
-- `pilot_development_cycles` se rempliront à la première journée réelle.
-- À statuer AVANT l'alpha, pas après.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- ÉTAT AU 04/08/2026 — ET C'EST LE CHIFFRE QUI COMPTE, PAS LA LISTE
--
-- Rejoué tel quel, sept jours après. Résultat par count(*) :
--
--                       28/07        04/08       écart
--   couples totaux        119          129         +10
--   couverts               67           66          −1
--   NON couverts           52           63         +11
--
-- ONZE COUPLES DE PLUS HORS PURGE EN UNE SEMAINE. Le schéma ajoute des colonnes
-- rattachées à une personne plus vite que la purge ne les rattrape, et rien ne
-- le signale : ce fichier ne se rejoue que si quelqu'un y pense.
--
-- C'est le motif habituel du dépôt. La garde est écrite, elle est juste, elle
-- est même bien documentée — et elle ne se déclenche pas. Elle a d'ailleurs
-- déjà tenu une fois : `coach_payout_details` a été fermée le 28/07 parce que
-- quelqu'un a lancé cette requête ce jour-là. Personne ne l'a relancée depuis.
--
-- Huit des 63 sont des tables internes de Supabase (`auth.identities`,
-- `auth.sessions`, `auth.mfa_factors`…) : elles ne nous appartiennent pas et
-- n'ont pas à figurer dans la purge. Le trou applicatif réel est donc de 55.
--
-- CE QUI MANQUE N'EST PAS UNE ANALYSE, C'EST UN DÉCLENCHEUR. Cette requête
-- devrait échouer en intégration continue quand un couple non couvert apparaît
-- sans être inscrit à la matrice de rétention. Elle ne le peut pas aujourd'hui :
-- la chaîne n'a pas d'accès base, et les 85 tests RLS attendent les mêmes
-- secrets depuis leur écriture. Même cause, même conséquence.
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
