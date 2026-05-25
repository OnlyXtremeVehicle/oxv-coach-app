-- Feature Coach — étape 1/2 : ajout de la valeur 'coach' à l'enum user_role
--
-- Important : ALTER TYPE ADD VALUE doit être committed AVANT que la nouvelle
-- valeur soit utilisée. C'est pourquoi cette migration est séparée de la
-- création de coach_pilots / fonction is_coach_of (qui ne référencent pas
-- directement la valeur 'coach' mais qui suivent dans 0016).

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'coach';
