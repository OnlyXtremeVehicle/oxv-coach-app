-- Refactor sem 16 : circuit Beltoise = 7 virages (pas 14 comme initialement)
-- Ajoute un CHECK pour empêcher l'insertion de segment_index > 7 désormais.
-- Aucune ligne en prod n'a > 7 (vérifié).

ALTER TABLE public.app_segment_analyses
  DROP CONSTRAINT IF EXISTS app_segment_analyses_segment_index_check;

ALTER TABLE public.app_segment_analyses
  ADD CONSTRAINT app_segment_analyses_segment_index_check
  CHECK (segment_index >= 1 AND segment_index <= 7);

COMMENT ON CONSTRAINT app_segment_analyses_segment_index_check
  ON public.app_segment_analyses
  IS 'Beltoise = 7 virages (refactor sem 16, OSM way 54412766)';
