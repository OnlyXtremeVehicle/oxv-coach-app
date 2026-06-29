-- PR-44 / decision Gabin 2026-06-29 : suppression des RPC de classement entre
-- pilotes (anti-doctrine E1 : progression referencee a soi, jamais aux autres).
-- Ces fonctions renvoyaient rank / is_self (classement competitif) et n'etaient
-- JAMAIS appelees par l'app. Recuperables via l'historique git si une
-- fonctionnalite communautaire CONSENTIE etait un jour decidee.
drop function if exists public.community_circuit_leaderboard(uuid, integer);
drop function if exists public.community_model_observatory(uuid);
