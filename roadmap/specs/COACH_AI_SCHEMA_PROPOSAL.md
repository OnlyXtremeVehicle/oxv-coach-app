# Schéma — Coach AI Assistant (V9 §14)

> **STATUT : APPLIQUÉ en prod le 29/06** (migration
> `20260629140000_coach_ai_assistant_foundation`, advisors propres). Décisions
> Gabin : appliquer tel quel ; **`coach_queue` = TABLE** avec statut de lecture
> explicite (pas la vue) ; périmètre V1 = **fondation seule** (UI coach en slices
> ultérieures). Défauts d'infra retenus : génération + filtre en Edge Function +
> Claude ; rétention 12 mois (cron à ajouter). Calqué sur `coach_annotations`
> 0020 / `session_intentions` / `is_coach_of` / `service_role`.

## Cadrage doctrinal (non négociable)

L'IA **assiste le coach, jamais le pilote en direct**. Le flux est :

```
séance terminée
   → [serveur] génération IA d'un BROUILLON de suggestion (post-séance)
   → [serveur] FILTRE DE SÛRETÉ obligatoire (ai_safety_reviews)
   → le coach voit le brouillon (jamais le pilote)
   → le coach VALIDE et rédige lui-même une coach_annotation
   → seule l'annotation validée (humaine) atteint le pilote
```

Garanties :

- Le **pilote ne voit jamais** une sortie IA brute — uniquement l'annotation
  coach validée (table `coach_annotations` existante, inchangée). Aucune policy
  pilote sur les tables IA.
- Le **partenaire n'accède jamais** (règle cardinale §148) — aucune policy
  partenaire.
- **Filtre de sûreté obligatoire** avant présentation au coach : chaque sortie
  passe par `ai_safety_reviews` (verdict `passed`/`flagged`/`blocked`).
- **Post-séance only**, descriptif, jamais une consigne de pilotage.
- La génération et le filtre tournent **côté serveur** (Edge Function +
  `service_role`), jamais avec une clé service côté client.

---

## Table 1 — `ai_safety_reviews` (journal de sûreté)

Trace chaque sortie IA et son verdict de sûreté, AVANT toute présentation.

```sql
create table public.ai_safety_reviews (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid references auth.users(id) on delete set null,
  telemetry_session_id uuid references public.telemetry_sessions(id) on delete set null,
  verdict text not null check (verdict in ('passed','flagged','blocked')),
  reasons text[],                 -- raisons factuelles si flagged/blocked
  input_excerpt text,             -- extrait borné, pour audit
  output_excerpt text,
  model_version text,
  created_at timestamptz not null default now()
);

create index idx_ai_safety_reviews_session
  on public.ai_safety_reviews (telemetry_session_id) where telemetry_session_id is not null;

alter table public.ai_safety_reviews enable row level security;

-- Lecture ADMIN uniquement (journal de sûreté = audit). Écriture par le serveur
-- (service_role, qui contourne la RLS). Aucune policy coach/pilote/partenaire.
create policy ai_safety_reviews_admin_select on public.ai_safety_reviews
for select to authenticated
using (exists (select 1 from public.users where id = auth.uid() and is_admin = true));
```

---

## Table 2 — `coach_ai_suggestions` (brouillons pour le coach)

Le brouillon généré, attaché à un coach + pilote (+ séance / virage optionnels).
Cycle de vie strict : `draft` → `accepted` | `dismissed`. Jamais publié seul.

```sql
create table public.coach_ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  pilot_id uuid not null references auth.users(id) on delete cascade,
  telemetry_session_id uuid references public.telemetry_sessions(id) on delete cascade,
  corner_index integer check (corner_index between 1 and 7),   -- optionnel
  body text not null check (length(btrim(body)) between 1 and 2000),
  status text not null default 'draft' check (status in ('draft','accepted','dismissed')),
  -- Filtre de sûreté obligatoire AVANT présentation (verdict consultable).
  safety_review_id uuid references public.ai_safety_reviews(id) on delete set null,
  -- Si acceptée : l'annotation coach validée qui en découle (traçabilité).
  resulting_annotation_id uuid references public.coach_annotations(id) on delete set null,
  model_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_coach_ai_suggestions_coach
  on public.coach_ai_suggestions (coach_id, status, created_at desc);
create index idx_coach_ai_suggestions_pilot_session
  on public.coach_ai_suggestions (pilot_id, telemetry_session_id);

drop trigger if exists coach_ai_suggestions_updated_at on public.coach_ai_suggestions;
create trigger coach_ai_suggestions_updated_at
  before update on public.coach_ai_suggestions
  for each row execute function public.tg_touch_updated_at();

alter table public.coach_ai_suggestions enable row level security;

-- Coach : ses propres suggestions, et seulement pour un pilote qu'il suit
-- (is_coach_of). Lecture / changement de statut / suppression. L'INSERT réel
-- vient du serveur (service_role) après filtre de sûreté.
create policy coach_ai_suggestions_coach_all on public.coach_ai_suggestions
for all to authenticated
using (coach_id = auth.uid() and public.is_coach_of(pilot_id))
with check (coach_id = auth.uid() and public.is_coach_of(pilot_id));

-- Admin : lecture (audit RGPD). Aucune policy pilote ni partenaire.
create policy coach_ai_suggestions_admin_select on public.coach_ai_suggestions
for select to authenticated
using (exists (select 1 from public.users where id = auth.uid() and is_admin = true));
```

---

## Table 3 — `coach_queue` (TABLE, décision Gabin)

File de lecture coach avec **statut de lecture explicite et persistant** : un
statut `unread`/`read`/`archived` par coach et par séance, marquable manuellement
(multi-coach). Own-row coach (`is_coach_of`) + admin audit. Upsert applicatif
possible ; l'enfilement serveur (trigger à la complétion de séance, en
`service_role`) viendra avec l'UI.

```sql
create table public.coach_queue (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  pilot_id uuid not null references auth.users (id) on delete cascade,
  telemetry_session_id uuid not null references public.telemetry_sessions (id) on delete cascade,
  status text not null default 'unread' check (status in ('unread','read','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coach_id, telemetry_session_id)
);
-- + trigger updated_at, RLS coach own-row (is_coach_of) + admin select.
```

> Filtres (anomalie qualité, priorité) : colonnes/flags ajoutables en phase 2.

---

## Questions ouvertes (avant apply)

1. **Fournisseur IA + où tourne le filtre** : Edge Function Supabase + Claude
   (clé serveur) ? Cela conditionne le `service_role` et le déploiement.
2. **Rétention** des brouillons IA et du journal de sûreté (ex. purge à 6/12
   mois, cohérent RGPD). Je peux ajouter un cron comme pour `telemetry_frames`.
3. **`coach_queue`** : vue suffisante pour la V1, ou tu veux une table avec
   statut de lecture explicite (multi-coach, marquage manuel) ?
4. **Périmètre V1** : on pose juste les 2 tables + la vue (fondation), et l'UI
   (AIReviewBanner, file de lecture, validation) vient en slices séparées ?

## Prochain pas

Dis-moi **« OK applique »** (éventuellement avec tes réponses aux 4 questions)
et j'applique en prod (migration + types + advisors), puis j'enchaîne l'UI coach
en slices vérifiées. **Rien n'est touché tant que tu n'as pas validé.**
