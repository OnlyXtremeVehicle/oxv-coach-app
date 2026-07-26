-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 18 juillet 2026 a 15:17:33, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- OXV — sessions_public + circuit (multi-circuit réel, fondateur 2026-07-19)
-- Ajout ADDITIF de circuit_id + circuit_name (jointure circuits) : les
-- créneaux coach, la TV de stand et la télécommande affichent le circuit
-- de LA journée de coaching. Aucune donnée privée (nom de circuit public).
CREATE OR REPLACE VIEW public.sessions_public AS
SELECT s.id,
    s.date,
    s.start_time,
    s.end_time,
    s.format,
    s.season_type,
    s.status,
    s.weather_status,
    s.is_private,
    s.max_capacity,
    s.capacity_access,
    s.capacity_morning,
    s.capacity_afternoon,
    s.capacity_promotion,
    s.capacity_signature,
    s.available_offers,
    s.notes,
    s.created_at,
    s.circuit_id,
    c.name AS circuit_name
FROM public.sessions s
LEFT JOIN public.circuits c ON c.id = s.circuit_id
WHERE s.is_private IS NOT TRUE;
