-- coach_ai_suggestions faisait DOUBLON avec coach_ai_drafts (déjà en prod, avec
-- les edge functions coach-ai-draft / coach-ai-validate déployées et le filtre
-- doctrinal inline). Table vide (0 ligne), jamais utilisée par le code. On la
-- retire pour ne pas laisser deux schémas IA parallèles. On garde
-- ai_safety_reviews (futur journal de sûreté) et coach_queue (file de lecture).
drop table if exists public.coach_ai_suggestions;
