-- 0010 — Affichage croisé : le coach voit le profil du pilote affilié.
--
-- Étend `coach_pilots_view` (déjà filtrée affiliation active + consentement) avec
-- les champs de profil pilote : niveau (déjà présent), expérience, licence FFSA,
-- véhicule, réseaux. Le pilote les édite lui-même (cf. pilotProfileService).
--
-- Aucune nouvelle surface de sécurité :
--   - security_invoker=on est conservé tel quel ;
--   - les colonnes ajoutées voyagent sur la MÊME ligne déjà autorisée à ce coach
--     (la RLS est au niveau ligne, pas colonne) ;
--   - le WHERE (coach courant + actif + consenti) est identique à l'existant.
--
-- Colonnes ajoutées EN FIN de liste : CREATE OR REPLACE VIEW interdit de
-- réordonner ou retyper les colonnes existantes, seules les additions en queue
-- sont permises.

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
         u.socials
    from public.coach_pilots cp
    join public.users u on u.id = cp.pilot_id
   where cp.coach_id = auth.uid()
     and cp.active = true
     and cp.pilot_consent_at is not null;
