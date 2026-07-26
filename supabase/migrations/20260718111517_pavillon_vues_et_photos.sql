-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 18 juillet 2026 a 11:15:17, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- ============================================================
-- OXV — Pavillon : vues écrans + photos (lot ECRANS_PAVILLON)
-- GO fondateur explicite du 2026-07-18 (« applique et continue »).
-- Source : docs/site/pavillon/migrations/ (20260717 + 20260718).
-- Adaptation validée : policy d'écriture photos = is_admin()
-- (résolution TODO_ARBITRAGE rôle staff — même mécanisme que les
-- gardes /pavillon/admin et /pavillon/regie côté site).
-- ============================================================

-- 1. Vue pseudonymisée des pilotes du jour (écran ACCUEIL, A7)
--    Pseudonymisation CÔTÉ SERVEUR : jamais de nom complet sans opt-in,
--    prénom + initiale uniquement même en opt-in.
CREATE OR REPLACE VIEW public.pavillon_pilotes_jour
WITH (security_invoker = false) AS
SELECT
  u.id                                   AS user_id,
  u.car_number,
  u.public_handle,
  CASE
    WHEN u.pavilion_name_optin
    THEN u.first_name || ' ' || left(u.last_name, 1) || '.'
    ELSE NULL
  END                                    AS display_name,
  v.brand || ' ' || v.model              AS vehicle_label,
  ts.id                                  AS telemetry_session_id,
  ts.status                              AS session_status,
  ts.started_at
FROM public.telemetry_sessions ts
JOIN public.users u    ON u.id = ts.user_id
LEFT JOIN public.vehicles v ON v.id = ts.vehicle_id
WHERE ts.started_at::date = CURRENT_DATE;

REVOKE ALL ON public.pavillon_pilotes_jour FROM anon, authenticated;
GRANT SELECT ON public.pavillon_pilotes_jour TO authenticated;

-- 2. Vue météo du jour (écran ACCUEIL) — dernière snapshot
CREATE OR REPLACE VIEW public.pavillon_meteo AS
SELECT DISTINCT ON (ws.session_id)
  ws.session_id,
  ws.captured_at,
  ws.temperature_c,
  ws.wind_speed_kmh,
  ws.wind_direction_deg,
  ws.precipitation_mm,
  ws.weather_label
FROM public.weather_snapshots ws
WHERE ws.captured_at::date = CURRENT_DATE
ORDER BY ws.session_id, ws.captured_at DESC;

GRANT SELECT ON public.pavillon_meteo TO authenticated;

-- 3. Photos prédéfinies du Pavillon (A13) — jamais session_media
CREATE TABLE IF NOT EXISTS public.pavillon_photos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path text NOT NULL,
  legende      text CHECK (char_length(legende) <= 120),
  sort_order   integer NOT NULL DEFAULT 0,
  is_active    boolean NOT NULL DEFAULT true,
  created_by   uuid REFERENCES public.users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pavillon_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pavillon_photos_select ON public.pavillon_photos;
CREATE POLICY pavillon_photos_select ON public.pavillon_photos
  FOR SELECT TO authenticated
  USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS pavillon_photos_write ON public.pavillon_photos;
CREATE POLICY pavillon_photos_write ON public.pavillon_photos
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4. Bucket privé 'pavillon-photos' (URLs signées 24 h côté écran)
INSERT INTO storage.buckets (id, name, public)
VALUES ('pavillon-photos', 'pavillon-photos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS pavillon_photos_storage_admin ON storage.objects;
CREATE POLICY pavillon_photos_storage_admin ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'pavillon-photos' AND public.is_admin())
  WITH CHECK (bucket_id = 'pavillon-photos' AND public.is_admin());

DROP POLICY IF EXISTS pavillon_photos_storage_read ON storage.objects;
CREATE POLICY pavillon_photos_storage_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'pavillon-photos');
