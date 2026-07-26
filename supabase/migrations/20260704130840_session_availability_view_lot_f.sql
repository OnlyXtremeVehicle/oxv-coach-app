-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 4 juillet 2026 a 13:08:40 UTC, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Lot F (calendrier) : compteurs de places par session, exposables publiquement.
-- Aucune PII : uniquement des agrégats. Vue definer (même doctrine que sessions_public :
-- la donnée est publique, seule l'UI est voilée). Corrige au passage le comptage
-- calendrier/booking qui lisait registrations sous RLS (chaque pilote ne voyait que
-- ses propres inscriptions -> places restantes fausses).
create view public.session_availability as
select s.id as session_id,
  count(r.id) filter (where r.status <> 'cancelled') as taken_total,
  count(r.id) filter (where r.status <> 'cancelled' and r.offer_type = 'access')    as taken_access,
  count(r.id) filter (where r.status <> 'cancelled' and r.offer_type = 'signature') as taken_signature,
  count(r.id) filter (where r.status <> 'cancelled' and r.offer_type = 'promotion') as taken_promotion,
  count(r.id) filter (where r.status <> 'cancelled' and r.offer_type = 'heritage')  as taken_heritage
from public.sessions s
left join public.registrations r on r.session_id = s.id
where s.is_private is not true
group by s.id;

comment on view public.session_availability is
  'Lot F — compteurs anonymes de places par session (aucune PII). Sert la jauge de remplissage du calendrier et du booking.';

revoke all on public.session_availability from public;
grant select on public.session_availability to anon, authenticated;
