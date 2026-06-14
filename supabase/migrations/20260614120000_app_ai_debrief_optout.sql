-- ============================================================================
-- S5 (charte 12 — souveraineté des données) : réglage opt-out du débrief IA.
--
-- Le débrief J+1 est rédigé par OpenAI (États-Unis). Décision fondateur :
-- traitement ACTIF par défaut (opt-out), désactivable par le pilote depuis ses
-- réglages. Quand la colonne vaut false, l'edge function generate-debrief-ai
-- n'appelle PAS OpenAI et l'app retombe sur le générateur local descriptif.
--
-- Colonne booléenne NOT NULL DEFAULT true : tous les comptes existants restent
-- dans le comportement actuel (débrief IA actif) ; chacun peut le couper.
-- Modèle aligné sur les colonnes de préférence existantes de `users`.
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS ai_debrief_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.users.ai_debrief_enabled IS
  'Opt-out du débrief assisté par IA (OpenAI, US). true = actif (défaut), false = le pilote a désactivé ; l''edge function generate-debrief-ai ne transmet alors rien à OpenAI.';
