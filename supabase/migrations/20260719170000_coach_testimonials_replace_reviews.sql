-- V2-L5-B — Remplace coach_reviews (avec note 1-5) par coach_testimonials :
-- des citations factuelles (texte + auteur), ZÉRO note, ZÉRO score, ZÉRO
-- échelle, ZÉRO compteur d'étoiles. RLS créée dans la MÊME migration (fail-closed).
-- coach_reviews est vide (0 ligne) et sans FK entrante → DROP propre en fin.
-- APPLIQUÉE en prod le 19/07/2026 (fouvuqkdxarjpjbqnsjq, décision fondateur).

create table public.coach_testimonials (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.users(id) on delete cascade,
  author_user_id uuid not null references public.users(id) on delete cascade,
  -- Le prénom dénormalisé = la moitié « auteur » de la citation (texte + auteur).
  author_first_name text,
  -- Le témoignage, longueur bornée. AUCUNE colonne de note/score/échelle/étoile.
  body text not null check (char_length(btrim(body)) between 1 and 1500),
  -- Le pilote publie volontairement (défaut true) ; il peut retirer (update own).
  published boolean not null default true,
  created_at timestamptz not null default now(),
  -- Un seul témoignage par (coach, auteur), éditable par UPSERT.
  unique (coach_id, author_user_id)
);

create index coach_testimonials_coach_id_idx on public.coach_testimonials (coach_id);

alter table public.coach_testimonials enable row level security;

-- Admin : accès total (même prédicat que l'ancien coach_reviews_admin_all).
create policy coach_testimonials_admin_all on public.coach_testimonials
  for all using (is_admin()) with check (is_admin());

-- Auteur (pilote) : écrit et lit SES propres témoignages (own-row). L'écriture
-- exige EN PLUS une séance de coaching réelle acceptée/complétée avec ce coach
-- (anti-faux-témoignage) — reprend la garde de coach_reviews_pilot_write.
create policy coach_testimonials_author_write on public.coach_testimonials
  for all
  using (author_user_id = auth.uid())
  with check (
    author_user_id = auth.uid()
    and exists (
      select 1 from public.coaching_bookings b
      where b.coach_id = coach_testimonials.coach_id
        and b.pilot_id = auth.uid()
        and b.status = any (array['accepted', 'completed'])
    )
  );

-- Coach : lit SES témoignages publiés (son espace). Aucun agrégat exposé —
-- la policy ne rend que des lignes, l'app ne calcule aucune moyenne.
create policy coach_testimonials_coach_read on public.coach_testimonials
  for select
  using (coach_id = auth.uid() and published = true);

-- Public (pilote en découverte) : lit les témoignages PUBLIÉS d'un coach dont la
-- fiche est publiée — la citation factuelle sur la fiche. Reprend la borne de
-- coach_reviews_select_published + la garde published.
create policy coach_testimonials_public_read on public.coach_testimonials
  for select
  using (
    published = true
    and exists (
      select 1 from public.coach_profiles p
      where p.coach_id = coach_testimonials.coach_id and p.is_published = true
    )
  );

-- coach_reviews (note 1-5) retirée : vide, sans FK entrante ni vue dépendante.
drop table if exists public.coach_reviews;
