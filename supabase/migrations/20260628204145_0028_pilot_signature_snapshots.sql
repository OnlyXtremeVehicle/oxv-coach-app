-- 0028_pilot_signature_snapshots.sql — Empreinte consolidée (reframe du « jumeau numérique »)
--
-- Mémoire du miroir : un INSTANTANÉ horodaté de la SIGNATURE de pilotage déjà
-- conforme (computeSignature, src/services/pilotSignatureService.ts), figé séance
-- après séance pour rendre lisible une TENDANCE strictement DESCRIPTIVE.
--
-- Reframe doctrinal décidé avec Gabin : on RENONCE au mot « jumeau numérique » et
-- au cadrage « performance avancée » (un double à égaler/dépasser = prescriptif
-- implicite, interdit Principe 1/2). On ne fige QUE des sorties déjà neutres.
--
-- INTERDITS (gravés ici) :
--   - AUCUN score de performance, AUCUNE note globale, AUCUNE cible/idéal.
--   - AUCUNE comparaison entre pilotes, AUCUN rang (Principe 2).
--   - On ne stocke QUE ce que le service émet réellement : la bande de régularité
--     ('très réguliers'/'réguliers'/'variables'), les traits et axes textuels/0–1,
--     le nombre de virages exploités. PAS de marge agrégée (calcul nouveau écarté).
--   - « marge », jamais « limite ». On consolide l'identité, pas la performance.
--
-- Confidentialité : own-row strict, calqué sur pilot_notes (0025). Partage OPT-IN
-- PAR SNAPSHOT (shared_with_coach) en LECTURE SEULE vers le coach actif/consenti
-- (is_coach_of). Le partage de l'empreinte est AUTONOME : le pilote consent à
-- partager CE snapshot (constats neutres consolidés), pas les séances sources.
-- Partenaire : JAMAIS (règle cardinale §148). Admin : pas de SELECT. Accès coach
-- À journaliser applicativement (log_coach_view) côté service de lecture.

create table public.pilot_signature_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Session source : le snapshot survit à sa suppression (on garde la mémoire).
  session_id uuid references public.telemetry_sessions (id) on delete set null,
  computed_at timestamptz not null default now(),
  -- Bande de régularité telle qu'émise par regularityTrait (pas de CHECK : on ne
  -- duplique pas un vocabulaire, on stocke la valeur produite). Nullable.
  regularity_band text,
  -- Traits de signature figés tels que produits (SignatureTrait[]). Constats neutres.
  traits jsonb not null default '[]'::jsonb,
  -- Axes silhouette 0–1 figés tels que produits (SignatureAxis[]). Positions, pas scores.
  axes jsonb not null default '[]'::jsonb,
  -- Nombre de virages exploités (lisibilité de la confiance, pas une perf).
  turn_sample_count integer not null default 0 check (turn_sample_count >= 0),
  shared_with_coach boolean not null default false,
  created_at timestamptz not null default now()
);

-- Un seul snapshot par séance source (recalcul = mise à jour en place), tout en
-- autorisant les snapshots détachés (session_id null) après purge de la séance.
create unique index idx_pilot_sig_snap_session
  on public.pilot_signature_snapshots (user_id, session_id)
  where session_id is not null;
create index idx_pilot_sig_snap_user
  on public.pilot_signature_snapshots (user_id, computed_at desc);

alter table public.pilot_signature_snapshots enable row level security;

-- Own-row strict : le pilote gère SES empreintes, et lui seul. Le lien session est
-- borné à SES propres sessions (intégrité, pas de rattachement cross-pilote).
create policy pilot_sig_snap_owner_all on public.pilot_signature_snapshots
for all
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and (
    session_id is null
    or session_id in (select id from public.telemetry_sessions where user_id = auth.uid())
  )
);

-- Coach EN LECTURE SEULE, uniquement sur les snapshots explicitement partagés ET
-- dont il est le coach actif/consenti. Aucune écriture coach. Révocation immédiate
-- en repassant shared_with_coach à false.
create policy pilot_sig_snap_coach_select on public.pilot_signature_snapshots
for select
to authenticated
using (shared_with_coach = true and public.is_coach_of(user_id));

comment on table public.pilot_signature_snapshots is
  'Empreinte consolidee : instantanes horodates de la signature de pilotage (constats neutres figes seance apres seance) pour lire une tendance DESCRIPTIVE. Reframe du jumeau numerique : aucun score, aucune cible, aucune comparaison entre pilotes. Own-row strict ; partage opt-in autonome par snapshot en lecture seule vers le coach consente ; jamais visible des partenaires ni admins.';
