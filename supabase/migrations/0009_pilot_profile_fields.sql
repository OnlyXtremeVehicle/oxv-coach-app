-- ============================================================================
-- Profil pilote (T40) — champs véhicule / réseaux / média sur `users`.
-- APPLIQUÉE en prod le 2026-06-25 via apply_migration « pilot_profile_fields ».
--
-- Additif, nullable. `experience_years` / `pilot_level` / `ffsa_license`
-- existent déjà. Le pilote édite sa propre ligne (RLS self-update existante) ;
-- aucune nouvelle policy. L'exposition au coach affilié (affichage côté coach)
-- = incrément suivant. Média photo/vidéo : upload à venir.
-- ============================================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS vehicle text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS socials jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS media jsonb;

COMMENT ON COLUMN public.users.vehicle IS 'Véhicule du pilote (texte libre : marque/modèle).';
COMMENT ON COLUMN public.users.socials IS 'Liens réseaux du pilote (jsonb : {website,instagram,youtube,...}).';
COMMENT ON COLUMN public.users.media IS 'Médias du pilote (jsonb : liste d''URLs photo/vidéo). Upload à venir.';
