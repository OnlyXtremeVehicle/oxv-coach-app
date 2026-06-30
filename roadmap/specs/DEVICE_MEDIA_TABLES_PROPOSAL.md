# Proposition de schéma — device_health_logs + media_exports

> **STATUT : PROPOSITION — STOP.** Rien n'est appliqué. Tu valides (ou ajustes)
> avant tout `apply_migration`. Débloque les partiels : panneau équipement riche
> (historique batterie/signal/dernière connexion), exports média / OXV Moments.
> Ancré sur le schéma réel : `devices` (battery_status, health_status existants),
> `device_assignments` (device↔pilote), `session_media`/`media`.

## Table 1 — `device_health_logs` (historique santé boîtier)

`devices` porte le snapshot COURANT (battery_status, health_status). Cette table
porte l'**historique** : c'est ce qui alimente « dernière connexion », la courbe
batterie et le signal dans le panneau équipement pilote.

```sql
create table public.device_health_logs (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  battery_status text,   -- même vocabulaire que devices.battery_status
  health_status text,    -- même vocabulaire que devices.health_status
  rssi integer,          -- signal (dBm) au moment du relevé
  recorded_at timestamptz not null default now(),
  source text            -- 'app' | 'admin' | 'auto'
);

create index idx_device_health_logs_device
  on public.device_health_logs (device_id, recorded_at desc);

alter table public.device_health_logs enable row level security;

-- Admin : gestion du parc (toutes opérations).
create policy device_health_logs_admin_all on public.device_health_logs
for all to authenticated
using (exists (select 1 from public.users where id = auth.uid() and is_admin = true))
with check (exists (select 1 from public.users where id = auth.uid() and is_admin = true));

-- Pilote : LECTURE des relevés d'un boîtier qui lui est (ou lui a été) affecté.
create policy device_health_logs_pilot_select on public.device_health_logs
for select to authenticated
using (
  exists (
    select 1 from public.device_assignments da
    where da.device_id = device_health_logs.device_id and da.pilot_id = auth.uid()
  )
);
```

## Table 2 — `media_exports` (journal d'exports / OXV Moments)

Trace chaque export/partage d'un média (image OXV Moment, lien, story). Alimente
le statut de publication côté Média Pro + d'éventuelles métriques sobres. Own-row.

```sql
create table public.media_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_media_id uuid references public.session_media (id) on delete set null,
  telemetry_session_id uuid references public.telemetry_sessions (id) on delete set null,
  export_type text not null check (export_type in ('image', 'link', 'story', 'pdf')),
  created_at timestamptz not null default now()
);

create index idx_media_exports_user
  on public.media_exports (user_id, created_at desc);

alter table public.media_exports enable row level security;

-- Own-row : le pilote voit/écrit SES exports. Aucun accès partenaire (§148).
create policy media_exports_owner_all on public.media_exports
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy media_exports_admin_select on public.media_exports
for select to authenticated
using (exists (select 1 from public.users where id = auth.uid() and is_admin = true));
```

## Questions avant apply

1. **`device_health_logs`** : on l'alimente comment ? (a) côté app au connect BLE
   (source 'app', un relevé par session) ; (b) côté admin manuel ; (c) auto plus
   tard. Pour le MVP du panneau, (a) au connect suffit.
2. **Pilote ↔ logs** : lecture via `device_assignments` (proposé). OK, ou tu veux
   restreindre au device de la séance courante seulement ?
3. **`media_exports`** : own-row pilote suffit pour le statut publication ; une
   métrique agrégée admin viendrait après. OK ?

## Prochain pas

Dis **« OK applique »** (avec tes réponses) → j'applique (migration + types +
advisors), puis je câble le panneau équipement (historique) et le journal
d'exports média. **Rien n'est touché tant que tu n'as pas validé.**
