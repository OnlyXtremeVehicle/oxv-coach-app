-- ============================================================================
-- BE-1 · Livrable 4bis — Vidéo du tour : métadonnées d'alignement (B1).
-- ============================================================================
-- La table ne stocke QUE l'offset de synchronisation image ↔ télémétrie et un
-- identifiant d'asset LOCAL (PHAsset/MediaLibrary) — JAMAIS le média, jamais
-- d'URL serveur (montage 100 % on-device). Strictement privée pilote.
-- BE-1 crée la table vide ; B1 en fait l'usage.
-- ============================================================================

create table if not exists public.video_overlays (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.telemetry_sessions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  local_asset_id text not null,          -- asset local (jamais d'URL serveur)
  offset_ms integer not null,            -- décalage franchissement image↔télémétrie (peut être négatif)
  duration_ms integer null check (duration_ms is null or duration_ms > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, user_id, local_asset_id)   -- idempotence au recalage
);

alter table public.video_overlays enable row level security;

-- Own-row STRICT : aucune policy coach/partner/staff (doctrine + RGPD).
drop policy if exists video_overlays_own_all on public.video_overlays;
create policy video_overlays_own_all on public.video_overlays
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists video_overlays_session on public.video_overlays(session_id);

-- updated_at automatique (fonction générique, search_path figé).
drop trigger if exists video_overlays_touch on public.video_overlays;
create trigger video_overlays_touch
  before update on public.video_overlays
  for each row execute function public.tg_touch_updated_at();

-- Purge compte : video_overlays est CASCADE sur users ET explicitement couvert
-- par purge_user_data() (migration 20260719147000_be1_purge_extend.sql).
-- local_asset_id ne référence qu'un asset local → aucune purge storage serveur.
