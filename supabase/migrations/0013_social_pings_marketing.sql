-- 0013 — Contenu marketing des points de la carte OXV (social_pings).
--
-- Ajoute les liens « réseaux / site / média » affichés au clic d'un point
-- (lieu, partenaire, événement), conformément au cahier : « apparition des
-- réseaux, site internet, média, nom et autre contenu marketing au clic ».
--
-- Purement additif (colonnes nullables) ; aucune RLS modifiée. social_pings
-- reste en écriture admin / lecture membres validés. Le nom, le type, la date,
-- la description et l'adresse existent déjà.

alter table public.social_pings
  add column if not exists website_url text,
  add column if not exists instagram_url text,
  add column if not exists facebook_url text,
  add column if not exists youtube_url text,
  add column if not exists image_url text;
