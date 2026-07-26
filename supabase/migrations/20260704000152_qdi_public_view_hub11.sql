-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 4 juillet 2026 a 00:01:52 UTC, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- PR-HUB-11 : QDI assumé — exposition publique OPT-IN (décision fondateur Q3).
-- Vue definer (pattern sessions_public) : n'expose JAMAIS user_id ; respecte le choix
-- du pilote (private=absent, anonymous_only=anonymisé, nominative=nom public).
-- Doctrine : aucune colonne de rang ; le site affiche par récence, jamais trié par score.
create or replace view public.qdi_public as
select
  case when u.community_visibility = 'nominative'
       then coalesce(nullif(u.public_handle, ''), u.first_name, 'Pilote OXV')
       else 'Pilote OXV' end as display_name,
  (u.community_visibility = 'nominative') as nominative,
  a.margin_global,
  a.margin_zone,
  a.computed_at,
  a.sessions_count
from public.users u
join lateral (
  select s.margin_global, s.margin_zone, s.computed_at,
         (select count(*) from public.app_session_analyses c
          where c.user_id = u.id and c.margin_global is not null) as sessions_count
  from public.app_session_analyses s
  where s.user_id = u.id and s.margin_global is not null
  order by s.computed_at desc
  limit 1
) a on true
where u.community_visibility <> 'private'
  and u.suspended_at is null;

comment on view public.qdi_public is 'PR-HUB-11 — QDI visible publiquement selon le choix du pilote (community_visibility). Sans user_id. Ne jamais trier par score côté client (pas de classement public).';
grant select on public.qdi_public to anon, authenticated;
