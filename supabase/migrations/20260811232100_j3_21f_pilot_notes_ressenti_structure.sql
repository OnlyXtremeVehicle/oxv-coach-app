-- =============================================================================
-- JALON 3 · LOT 21f — LE RESSENTI DEVIENT CROISABLE
--
-- APPLIQUÉE EN PRODUCTION le 11/08/2026 via l'API Supabase. Ce fichier a été
-- écrit APRÈS coup, le 12/08 : je l'avais appliquée sans le déposer, ce qui
-- laissait le dépôt en retard sur la base. Le contenu est celui qui a tourné.
--
-- Le plan : « Étendre `pilot_notes` — un texte libre ne se croise pas. »
--
-- ADDITIF SEULEMENT. `body` reste NOT NULL et garde son rôle : la phrase du
-- pilote, dans ses mots. Les deux colonnes neuves sont NULLABLES — une note
-- écrite librement reste parfaitement valide.
--
-- La contrainte de vocabulaire est posée parce que la table était VIDE et que
-- le vocabulaire est arrêté par le plan : freinage, placement, rythme, voiture.
-- (Sur `incident_followups.state`, le même jour, j'y ai renoncé — ce
-- vocabulaire-là n'est arrêté nulle part et un administrateur y écrit à la main.)
-- =============================================================================

alter table public.pilot_notes
  add column if not exists theme text,
  add column if not exists ressenti text;

comment on column public.pilot_notes.theme is
  'Thème du ressenti, aligné sur le vocabulaire de la variable coach : '
  'freinage · placement · rythme · voiture. NULL pour une note libre.';

comment on column public.pilot_notes.ressenti is
  'Réponse au QCM de l''entre-runs, en clair. NULL pour une note libre.';

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'pilot_notes' and c.conname = 'pilot_notes_theme_check'
  ) then
    alter table public.pilot_notes
      add constraint pilot_notes_theme_check
      check (theme is null or theme in ('freinage', 'placement', 'rythme', 'voiture'));
  end if;
end $$;

create index if not exists pilot_notes_theme_idx
  on public.pilot_notes (user_id, theme)
  where theme is not null;
