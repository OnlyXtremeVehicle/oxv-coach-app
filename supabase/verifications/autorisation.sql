-- =============================================================================
-- AUTORISATION — vérification de FORME, jouable sans identifiants de test
--
-- Lecture seule. À exécuter après toute migration qui touche les rôles ou la RLS.
-- =============================================================================
--
-- POURQUOI CE FICHIER EXISTE
--
-- Le dépôt porte 18 suites de tests RLS (`src/__tests__/rls/`) qui créent de
-- vrais comptes, écrivent, et vérifient qui voit quoi. Ce sont les seuls tests
-- qui PROUVENT quelque chose sur l'autorisation.
--
-- **Elles ne tournent jamais dans le passage de portes ordinaire.** Elles se
-- sautent d'elles-mêmes quand `TEST_SUPABASE_URL` et `TEST_SUPABASE_SERVICE_KEY`
-- sont absents — ce qui est le cas. `jest` annonce alors « 18 skipped » au
-- milieu d'un rapport vert, et l'œil glisse dessus.
--
-- Le 28/07/2026, une migration a changé `public.is_admin()` et cinq policies.
-- Les tests qui auraient couvert ce changement ont été ignorés ce jour-là comme
-- les autres.
--
-- Ce fichier ne les remplace pas. Il vérifie la FORME de l'autorisation, ce
-- qu'aucun banc hors-ligne ne peut faire, et ce qui se rejoue en trente
-- secondes depuis la console SQL. La preuve d'EFFET reste la suite RLS, sur une
-- branche Supabase.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. UNE SEULE DÉFINITION D'ADMINISTRATEUR
--
-- `is_admin()` et `oxv_is_admin()` ont longtemps divergé : la première admettait
-- `role = 'admin' OR is_admin = true`, la seconde le rôle seul. Un compte
-- passait l'une et pas l'autre. Depuis le lot 8 option B, elles disent la même
-- chose — et doivent continuer.
-- -----------------------------------------------------------------------------
select p.proname,
       pg_get_functiondef(p.oid) ilike '%is_admin = true%' as consulte_la_colonne,
       pg_get_functiondef(p.oid) ilike '%role = ''admin''%' as consulte_le_role
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('is_admin', 'oxv_is_admin')
order by p.proname;

-- ATTENDU : consulte_la_colonne = false ET consulte_le_role = true, pour les deux.

-- -----------------------------------------------------------------------------
-- 2. AUCUNE POLICY NE LIT LA COLONNE EN DIRECT
--
-- Cinq le faisaient encore avant le 28/07. Tant qu'il en reste une, la colonne
-- `users.is_admin` n'est pas inerte — et son annotation ment.
-- -----------------------------------------------------------------------------
select schemaname, tablename, policyname
from pg_policies
where coalesce(qual, '') || coalesce(with_check, '') ilike '%users.is_admin%'
order by tablename, policyname;

-- ATTENDU : aucune ligne.

-- -----------------------------------------------------------------------------
-- 3. LA GARDE DES COLONNES PRIVILÉGIÉES EST ARMÉE
--
-- Le défaut SEC-3 : la fonction couvrait `is_admin`, le DÉCLENCHEUR ne
-- l'écoutait pas. `UPDATE OF <liste>` ne se déclenche que si une colonne de la
-- liste figure au SET. La clause `OF` a donc été retirée — toute colonne
-- privilégiée ajoutée demain reste couverte.
-- -----------------------------------------------------------------------------
select t.tgname,
       pg_get_triggerdef(t.oid) as declaration,
       pg_get_triggerdef(t.oid) ilike '%UPDATE OF%' as porte_une_liste
from pg_trigger t
where t.tgrelid = 'public.users'::regclass
  and t.tgname = 'trg_guard_users_privileged_columns';

-- ATTENDU : une ligne, porte_une_liste = false.

-- -----------------------------------------------------------------------------
-- 4. PERSONNE N'A PERDU L'ACCÈS
--
-- À jouer AVANT et APRÈS toute migration de rôle. Les deux résultats doivent
-- être identiques.
-- -----------------------------------------------------------------------------
select email, role::text, is_admin, (role = 'admin') as administrateur
from public.users
where role = 'admin' or is_admin = true
order by email;

-- ATTENDU AU 28/07/2026 : trois lignes, toutes en administrateur = true —
-- administration@oxvehicle.fr, bitaube.p@gmail.com, julie.huet.perso@gmail.com.

-- -----------------------------------------------------------------------------
-- 5. AUCUNE ÉLÉVATION N'A EU LIEU
--
-- Le déclencheur d'audit `trg_audit_user_is_admin_change` est armé depuis le
-- 26/07 — lui correctement, sans clause `OF`. Toute écriture sur la colonne y
-- laisse une trace.
-- -----------------------------------------------------------------------------
select count(*) as elevations_tracees,
       min(created_at) as premiere,
       max(created_at) as derniere
from public.admin_audit
where action = 'user_is_admin_change';

-- ATTENDU : 0. Une ligne non expliquée est un incident.

-- -----------------------------------------------------------------------------
-- 6. LES TABLES SENSIBLES SONT SOUS RLS ET SANS GRANT LARGE
--
-- Une table avec RLS active mais un GRANT à `anon` reste servie par PostgREST
-- selon ses policies ; une table SANS grant n'est pas servie du tout. Les deux
-- barrières se lisent séparément, et c'est ce qui a permis de conclure, pour les
-- copies `_backup_*`, à un défaut d'effacement et non d'exposition.
-- -----------------------------------------------------------------------------
select c.relname,
       c.relrowsecurity as rls_active,
       (select count(*) from pg_policies p where p.tablename = c.relname) as policies,
       has_table_privilege('anon', c.oid, 'SELECT') as lisible_anon,
       has_table_privilege('authenticated', c.oid, 'SELECT') as lisible_authentifie
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'users', 'telemetry_frames', 'telemetry_sessions', 'payments', 'invoices',
    'coach_payout_details', 'pilot_waiver_signatures', 'biometry_raw',
    'incident_reports', 'documents'
  )
order by c.relname;

-- ATTENDU : rls_active = true partout, policies > 0 partout.
-- `lisible_anon` doit être false sur tout ce qui porte de la donnée personnelle.

-- =============================================================================
-- CE QUE CE FICHIER NE PROUVE PAS
-- =============================================================================
--
-- Il lit des DÉFINITIONS. Il ne tente aucune écriture, n'ouvre aucune session
-- pilote, et ne vérifie donc aucun EFFET.
--
-- L'écart entre la définition et l'effet est exactement ce qui a produit SEC-3 :
-- une fonction juste, un déclencheur qui ne l'appelait pas. Le contrôle qui
-- l'aurait attrapé était un essai réel depuis une session `authenticated`, et
-- c'est celui qui n'avait pas été fait.
--
-- La preuve d'effet reste donc la suite `src/__tests__/rls/`, sur une branche
-- Supabase avec `TEST_SUPABASE_URL` et `TEST_SUPABASE_SERVICE_KEY`. Tant
-- qu'elle ne tourne pas, « portes vertes » ne veut rien dire sur l'autorisation.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 7. LES POLICIES OUVERTES À `public` — point de vigilance, pas défaut
--
-- Une policy déclarée `TO public` est évaluée AUSSI pour `anon`. Elle n'est
-- inoffensive que si son prédicat dépend de `auth.uid()`, nul pour un anonyme.
-- -----------------------------------------------------------------------------
select tablename, policyname, cmd, roles::text
from pg_policies
where schemaname = 'public'
  and (roles::text like '%public%' or roles::text like '%anon%')
order by tablename, policyname;

-- ÉTAT AU 28/07/2026 : sur les dix tables sensibles, une seule policy est
-- `TO public` — `telemetry_frames_coach_select`. Son prédicat passe par
-- `is_detailed_coach_of()`, qui teste `coach_id = auth.uid()` : nul pour un
-- anonyme, donc EXISTS faux. **Aucune fuite.**
--
-- Mais `anon` détient bien SELECT sur neuf de ces dix tables (seule
-- `coach_payout_details` le refuse). La barrière est donc entièrement portée
-- par les policies. Une future policy permissive `TO public` sur l'une d'elles
-- serait immédiatement atteignable sans authentification.
--
-- Durcissement possible, à votre main : déclarer les policies `TO authenticated`
-- plutôt que `TO public`, et retirer le GRANT `anon` là où rien ne le justifie.
-- Ce n'est pas un correctif urgent — c'est une seconde barrière là où il n'y en
-- a qu'une.
