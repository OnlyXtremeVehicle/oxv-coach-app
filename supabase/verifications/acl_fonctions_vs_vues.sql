-- =============================================================================
-- VÉRIFICATION — UNE FONCTION NE DOIT JAMAIS ÊTRE PLUS OUVERTE QUE SA VUE
-- =============================================================================
--
-- À exécuter en lecture sur la production. Aucune écriture.
--
-- -----------------------------------------------------------------------------
-- LE MOTIF QU'ELLE POURSUIT
-- -----------------------------------------------------------------------------
--
-- Le dépôt emploie un patron récurrent : une vue `security_invoker = true`
-- posée sur une fonction `<nom>_rows()` en SECURITY DEFINER. La vue porte les
-- droits qu'on veut accorder ; la fonction fait le travail.
--
-- Le piège est que **la vue n'est pas un passage obligé**. Une fonction
-- SECURITY DEFINER s'appelle directement en RPC PostgREST. Si son ACL est plus
-- large que les GRANT de sa vue, la vue ne protège rien.
--
-- C'est arrivé le 12/08/2026 sur `pavillon_pilotes_jour_rows` : la vue était
-- réservée à `authenticated`, la fonction exécutable par `anon`. Elle rendait
-- l'UUID, le pseudo, le numéro de voiture et le véhicule de chaque pilote ayant
-- roulé dans la journée — à n'importe qui, la clé anon étant publique et le
-- dépôt public.
--
-- La migration d'origine faisait pourtant `revoke ... from public`. **Cela ne
-- retire pas un GRANT posé explicitement à `anon`** par les privilèges par
-- défaut de Supabase. Le REVOKE portait sur un rôle, le GRANT sur un autre.
-- Une relecture attentive ne voit pas cet écart : les deux instructions sont
-- correctes, elles ne se rencontrent simplement jamais.
--
-- -----------------------------------------------------------------------------
-- CE QU'ELLE NE PEUT PAS FAIRE
-- -----------------------------------------------------------------------------
--
-- Elle ne tourne pas en intégration continue : les tests Jest n'ont pas accès à
-- la base. Elle se lance à la main, après toute migration qui touche une vue,
-- une fonction `_rows` ou un GRANT. C'est une faiblesse assumée, et elle vaut
-- mieux qu'une relecture à l'œil.
--
-- =============================================================================

-- 1 · L'ÉCART. Toute fonction `_rows` exécutable par un rôle auquel sa vue
--     jumelle n'accorde PAS le SELECT. Zéro ligne attendue.
with fonctions as (
  select p.proname,
         left(p.proname, length(p.proname) - 5) as vue,
         unnest(coalesce(p.proacl, '{}')) ::text as entree
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef                       -- SECURITY DEFINER seulement
    and p.proname like '%\_rows' escape '\'
),
droits as (
  select proname, vue,
         split_part(entree, '=', 1) as role
  from fonctions
  where entree like '%=X%'                -- privilège EXECUTE
),
vues as (
  select table_name, grantee
  from information_schema.role_table_grants
  where table_schema = 'public' and privilege_type = 'SELECT'
)
select d.proname   as fonction,
       d.vue       as vue_jumelle,
       d.role      as role_trop_large
from droits d
where d.role not in ('postgres', 'service_role', '')
  and not exists (
    select 1 from vues v
     where v.table_name = d.vue and v.grantee = d.role
  )
  -- Une fonction sans vue jumelle n'est pas concernée par ce contrôle.
  and exists (select 1 from vues v where v.table_name = d.vue)
order by 1, 3;

-- 2 · LE CONTRÔLE INVERSE — une fonction SECURITY DEFINER sans `search_path`
--     figé est une porte d'escalade classique. Zéro ligne attendue.
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and not exists (
    select 1 from unnest(coalesce(p.proconfig, '{}')) c
     where c like 'search_path=%'
  )
order by 1;

-- 3 · LE RELEVÉ DE RÉFÉRENCE, à comparer d'une fois sur l'autre.
select p.proname, p.proacl::text as acl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef and p.proname like '%\_rows' escape '\'
order by 1;

-- -----------------------------------------------------------------------------
-- ÉTAT AU 12/08/2026, APRÈS CORRECTION
-- -----------------------------------------------------------------------------
--
--   pavillon_pilotes_jour_rows → {postgres, authenticated, service_role}
--   pavillon_meteo_rows        → {postgres, anon, authenticated, service_role}
--
-- `pavillon_meteo_rows` GARDE `anon` volontairement : sa vue jumelle
-- `pavillon_meteo` l'accorde aussi, les deux concordent, et la météo d'un
-- circuit n'est la donnée personnelle de personne. On ne ferme pas par
-- symétrie ce qui n'a pas de raison de l'être.
