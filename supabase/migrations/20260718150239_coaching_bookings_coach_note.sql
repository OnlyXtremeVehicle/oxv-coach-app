-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 18 juillet 2026 a 15:02:39, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- OXV — Retour de visite du coach (vocal fondateur : « le retour de la visite
-- du coach, important pour lui d'avoir tous ces détails »). Colonne additive ;
-- écriture couverte par la policy coaching_bookings_coach_respond (coach_id = auth.uid()).
ALTER TABLE public.coaching_bookings
  ADD COLUMN IF NOT EXISTS coach_note text CHECK (char_length(coach_note) <= 600);
