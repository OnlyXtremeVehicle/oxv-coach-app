-- M6 (multi-circuit) : rattacher chaque journée (sessions) à un circuit.
-- APPLIQUÉE en prod le 2026-07-04 via MCP — ne pas ré-exécuter.
-- Additif, nullable, défaut = circuit par défaut (Haute Saintonge). FK circuits.
-- RLS inchangée (la colonne hérite des policies existantes de sessions).
-- Coordination site : le site doit renseigner circuit_id à la création d'une
-- journée ; sinon tout tombe sur Haute Saintonge par défaut.
alter table public.sessions
  add column if not exists circuit_id uuid references public.circuits(id);

-- Backfill : toutes les journées existantes → circuit par défaut.
update public.sessions
  set circuit_id = (select id from public.circuits where is_default limit 1)
  where circuit_id is null;

-- Défaut des futures lignes : Postgres n'autorise pas un sous-select en DEFAULT,
-- on fige l'UUID de Haute Saintonge (circuit d'exploitation, is_default=true).
alter table public.sessions
  alter column circuit_id set default '0670af3f-ef84-4843-8a55-0c8bc3dcdca9'::uuid;
