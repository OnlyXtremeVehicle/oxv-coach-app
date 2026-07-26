-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 23 juin 2026, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Lecture des frames d'un ami accepté, pour la superposition côte-à-côte.
-- Symétrique de telemetry_sessions_select_friend (niveau session) : ici au
-- niveau frame, SELECT uniquement, bornée par are_friends(auth.uid(), user_id).
-- N'expose QUE les frames de sessions appartenant à un ami accepté.
drop policy if exists telemetry_frames_select_friend on public.telemetry_frames;

create policy telemetry_frames_select_friend
on public.telemetry_frames
for select
to authenticated
using (
  session_id in (
    select id
    from public.telemetry_sessions
    where are_friends(auth.uid(), user_id)
  )
);
