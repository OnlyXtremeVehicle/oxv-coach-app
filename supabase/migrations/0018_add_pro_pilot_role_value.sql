-- PR-I : nouveau rôle « pilote professionnel » (décision Gabin 2026-06).
-- APPLIQUÉE EN PROD le 2026-06-28 via MCP. Ajout de la valeur d'enum SEULE
-- (Postgres : une nouvelle valeur d'enum ne peut être UTILISÉE qu'après commit,
-- d'où la séparation avec le helper en 0019).
alter type public.user_role add value if not exists 'pro_pilot';
