-- Restaure la lecture de public.sessions pour les utilisateurs connectes (authenticated).
-- La migration 20260614120000 (vue sessions_public + DROP de sessions_select_public)
-- a supprime le seul chemin SELECT des pilotes non-admin, cassant les embeds
-- registrations->sessions cote pilote (mes sessions, facturation, heritage,
-- progression). anon reste exclu de la table de base (il lit la vue sessions_public,
-- sans PII) : la fuite anonyme reste fermee.
--
-- Residu assume : un pilote connecte peut encore lire private_client_name/contact
-- (comportement d'avant la migration). Masquer le PII aux pilotes connectes est un
-- chantier separe (REVOKE colonnes a authenticated + RPC SECURITY DEFINER pour que
-- l'ecran admin Medias garde les noms).
--
-- Appliquee en prod via apply_migration le 2026-06-15 (version 20260615175209).

DROP POLICY IF EXISTS sessions_select_authenticated ON public.sessions;
CREATE POLICY sessions_select_authenticated ON public.sessions
  FOR SELECT TO authenticated USING (true);
