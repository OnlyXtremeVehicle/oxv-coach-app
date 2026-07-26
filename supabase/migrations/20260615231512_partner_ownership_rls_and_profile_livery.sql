-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 15 juin 2026 à 23:15:12, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- ===== Profil : config livrée éditable (le reste existe déjà) =====
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS livery jsonb;
COMMENT ON COLUMN public.users.livery IS
  'Config casque + livrée éditable (couleurs, motifs, numéro). Avatar rendu = avatar_url ; indicatif = public_handle. Garde-fou : l''éditeur n''offre jamais l''or Heritage #C4A459.';

-- ===== Helper rôle partenaire (même style que is_admin / is_coach_of) =====
CREATE OR REPLACE FUNCTION public.is_partner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $fn$ SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'partner'); $fn$;

-- ===== Fiches : propriétaire + policy « gérer les siennes » =====
-- Additif. RLS déjà active ; les policies read/admin existantes restent intactes.
-- owner_id NULL = fiche curatée par OXV (admin) ; owner_id renseigné = fiche gérée par le partenaire.
DO $do$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['partners','lodgings','restaurants','circuit_services'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS owner_id uuid', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_partner_manage', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (public.is_partner() AND owner_id = auth.uid()) WITH CHECK (public.is_partner() AND owner_id = auth.uid())',
      t||'_partner_manage', t);
  END LOOP;
END $do$;
