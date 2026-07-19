-- ============================================================================
-- SEC-1 — PRÉPARÉE, NON APPLIQUÉE — approbation fondateur requise
-- ============================================================================
-- Lot B — PII clients de privatisation (sessions.private_client_name/contact)
--
-- Constat prod (inspection 2026-07-19, lecture seule) :
--   - La policy sessions_select_authenticated est DÉJÀ resserrée :
--     USING (is_admin() OR is_private IS NOT TRUE) — les lignes privées (et
--     donc leurs PII) sont invisibles pour tout non-admin. Le « résidu assumé »
--     du bilan (lecture par tout authentifié, 20260615175209) n'est PLUS l'état
--     de prod.
--   - Données : 0 session privée, 0 valeur private_client_* (colonnes vides).
--   - Le canal admin existe déjà : RPC get_session_private_client(uuid)
--     (SECURITY DEFINER, search_path épinglé, garde is_admin() interne).
--   - « L'intéressé » (le client de la privatisation) n'a pas de compte
--     applicatif : l'accès est donc admin-only, par construction.
--
-- Ce lot rend la garantie STRUCTURELLE (plus seulement conjoncturelle) :
--   1. Contrainte : une session non privée ne peut PAS porter de PII client.
--      Ainsi les lignes visibles par les pilotes (is_private IS NOT TRUE) ont
--      toujours private_client_* NULL — la fuite par colonne devient impossible
--      sans toucher aux GRANTs (donc sans casser les `select *` du site).
--   2. Défense en profondeur sur la table de sauvegarde _backup_sessions_20260719
--      (44 lignes, RLS absente ; non exposée à l'API — grants postgres +
--      service_role uniquement — mais on active RLS quand même).
--
-- Rollback :
--   - Contrainte : ALTER TABLE public.sessions DROP CONSTRAINT sessions_private_client_pii_only_private;
--   - Backup : ALTER TABLE public._backup_sessions_20260719 DISABLE ROW LEVEL SECURITY;
-- ============================================================================

-- 1. PII client uniquement sur les sessions privées (invisibles aux non-admins).
--    NOT VALID puis VALIDATE : zéro verrou long ; 0 ligne violante vérifiée en prod.
alter table public.sessions
  add constraint sessions_private_client_pii_only_private
  check (
    is_private is true
    or (private_client_name is null and private_client_contact is null)
  ) not valid;

alter table public.sessions
  validate constraint sessions_private_client_pii_only_private;

comment on constraint sessions_private_client_pii_only_private on public.sessions is
  'SEC-1 : les PII de privatisation ne peuvent exister que sur des lignes '
  'is_private=true, elles-mêmes réservées aux admins par la policy '
  'sessions_select_authenticated. Lecture admin via RPC get_session_private_client.';

-- 2. Sauvegarde du 2026-07-19 : RLS activée (deny-all, aucune policy), en
--    attendant sa suppression. La table n'est accessible qu'à postgres et
--    service_role — cette ligne est de la défense en profondeur.
alter table public._backup_sessions_20260719 enable row level security;

-- Recommandation (décision fondateur, NE PAS exécuter sans accord) : supprimer
-- la sauvegarde une fois son utilité passée — elle contient les colonnes PII.
-- drop table public._backup_sessions_20260719;
