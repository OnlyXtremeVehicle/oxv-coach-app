-- 0012 — Média pilote visible par le coach : ajoute `users.media` à coach_pilots_view.
--
-- Complète l'affichage croisé (0010). Le coach lit les CHEMINS média du pilote
-- affilié (via la vue déjà filtrée consentement + actif), puis signe les URLs
-- via la RLS du bucket privé `pilot-media` (is_coach_of, migration 0011).
--
-- Même nature que 0010 : security_invoker=on conservé, WHERE inchangé, colonne
-- ajoutée EN FIN de liste (contrainte CREATE OR REPLACE VIEW). Le média voyage
-- sur la même ligne déjà autorisée — aucune nouvelle surface de sécurité.

create or replace view public.coach_pilots_view
with (security_invoker = on) as
  select u.id as pilot_id,
         u.first_name,
         u.last_name,
         u.pilot_level,
         u.avatar_url,
         cp.id as assignment_id,
         cp.created_at as assigned_at,
         cp.pilot_consent_at,
         cp.notes,
         u.experience_years,
         u.ffsa_license,
         u.vehicle,
         u.socials,
         u.media
    from public.coach_pilots cp
    join public.users u on u.id = cp.pilot_id
   where cp.coach_id = auth.uid()
     and cp.active = true
     and cp.pilot_consent_at is not null;
