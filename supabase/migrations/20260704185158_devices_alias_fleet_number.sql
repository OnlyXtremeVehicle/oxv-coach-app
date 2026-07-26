-- Flotte RaceBox (Lot M7.2, prompt maître v2). APPLIQUÉE en prod le
-- 2026-07-04 via MCP — ne pas ré-exécuter.
-- 20 boîtiers côte à côte le jour J → alias lisible (« OXV 07 ») + numéro de
-- flotte aligné sur l'étiquette physique, gérés depuis (admin)/devices et
-- résolus côté pilote au scan BLE (serial contenu dans le nom d'usine).
-- Additif strict, RLS inchangée (admin all + lecture pilote scopée).
alter table public.devices
  add column if not exists alias text,
  add column if not exists fleet_number integer;
