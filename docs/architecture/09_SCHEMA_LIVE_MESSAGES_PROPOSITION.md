# Proposition de schéma — Consentement LIVE + Messagerie coach

> **STOP — À VALIDER PAR GABIN avant toute DDL.** Aucune migration n'est
> appliquée. Décisions fondateur 2026-07-11 : **1-B** (consentement live
> explicite) + **2-A** (messagerie durable). Ce document propose le schéma minimal,
> cohérent avec l'existant (`coach_pilots`, RLS owner), pour ces deux briques.

## Contexte existant (production, inspecté)

`public.coach_pilots` (le lien coach↔pilote) porte déjà :
`id, coach_id, pilot_id, active, created_at, created_by, notes,`
`pilot_consent_at (ts null), coach_consent_at (ts null), initiated_by (enum),`
`status (enum), affiliation_price_eur (int null), level (enum : lecture_simple |`
`lecture_detaillee | programme)`.

Le consentement post-séance = `pilot_consent_at IS NOT NULL`. Le live est un flux
**plus sensible** (télémétrie + position **temps réel**) → il mérite un
consentement **distinct et explicite** (décision 1-B, RGPD premium).

---

## 1-B — Consentement live (colonne additive)

Une seule colonne sur `coach_pilots`, sur le modèle exact de `pilot_consent_at` :

```sql
-- STOP : ne pas appliquer sans accord Gabin.
ALTER TABLE public.coach_pilots
  ADD COLUMN IF NOT EXISTS live_sharing_at timestamptz NULL;

COMMENT ON COLUMN public.coach_pilots.live_sharing_at IS
  'Consentement du pilote au partage LIVE (télémétrie temps réel) avec ce coach.
   NULL = non consenti. Distinct de pilot_consent_at (après-séance). Révocable.';
```

- **NULL** = pas de partage live (défaut). **Non-null** = le pilote a activé le
  partage live pour CE coach, à CET instant (horodaté, révocable en repassant NULL).
- **RLS** : réutilise la policy UPDATE existante de `coach_pilots`
  (`pilot_id = auth.uid()`) — le pilote (et lui seul) bascule `live_sharing_at`,
  exactement comme `pilot_consent_at`. **Aucune nouvelle policy** si l'UPDATE
  pilote couvre déjà toutes ses colonnes ; sinon restreindre la colonne au pilote.
- **Garde-fou relais** : `usePilotLiveRelay` ne s'active QUE si, pour la séance
  courante, il existe un `coach_pilots` `active` avec `live_sharing_at IS NOT NULL`.
  Sans ça, aucune trame n'est émise (silence réseau, pas juste UI masquée).

### App-side (après validation)
- **Mon coach** (`app/(app)/mon-coach.tsx`) : un 3ᵉ toggle « Partage en direct »
  (en plus de Télémétrie / Analyses), OFF par défaut, texte RGPD explicite
  (« Votre position et votre télémétrie en temps réel, uniquement pendant que
  vous roulez, uniquement à ce coach. Coupez quand vous voulez. »).
- **Service** : `setLiveSharing(assignmentId, on)` → update `live_sharing_at`.
- **Relais** : gate `active = isCapturing && hasLiveConsentForActiveCoach`.

---

## 2-A — Messagerie coach↔pilote (table durable)

Fil **attribué**, **sans coordonnées** (RGPD : aucun email/téléphone dans la table).

```sql
-- STOP : ne pas appliquer sans accord Gabin.
CREATE TABLE IF NOT EXISTS public.coach_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_pilot_id uuid NOT NULL REFERENCES public.coach_pilots(id) ON DELETE CASCADE,
  coach_id      uuid NOT NULL REFERENCES public.users(id),
  pilot_id      uuid NOT NULL REFERENCES public.users(id),
  sender_id     uuid NOT NULL REFERENCES public.users(id),  -- = coach_id OU pilot_id
  body          text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 2000),
  session_id    uuid NULL REFERENCES public.telemetry_sessions(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  read_at       timestamptz NULL
);

CREATE INDEX IF NOT EXISTS coach_messages_pair_idx
  ON public.coach_messages (coach_pilot_id, created_at DESC);

ALTER TABLE public.coach_messages ENABLE ROW LEVEL SECURITY;

-- Lecture : les DEUX membres du binôme (coach ou pilote) voient le fil.
CREATE POLICY coach_messages_select ON public.coach_messages
  FOR SELECT USING (auth.uid() = coach_id OR auth.uid() = pilot_id);

-- Écriture : l'expéditeur est soit le coach soit le pilote du binôme, et
-- sender_id = auth.uid() (pas d'usurpation). Le binôme doit être actif +
-- consenti (le pilote a accepté ce coach).
CREATE POLICY coach_messages_insert ON public.coach_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND (auth.uid() = coach_id OR auth.uid() = pilot_id)
    AND EXISTS (
      SELECT 1 FROM public.coach_pilots cp
      WHERE cp.id = coach_pilot_id
        AND cp.coach_id = coach_messages.coach_id
        AND cp.pilot_id = coach_messages.pilot_id
        AND cp.active
        AND cp.pilot_consent_at IS NOT NULL
    )
  );

-- Accusé de lecture : le DESTINATAIRE peut poser read_at (jamais éditer le body).
CREATE POLICY coach_messages_mark_read ON public.coach_messages
  FOR UPDATE USING (
    (auth.uid() = coach_id OR auth.uid() = pilot_id) AND sender_id <> auth.uid()
  ) WITH CHECK (
    (auth.uid() = coach_id OR auth.uid() = pilot_id) AND sender_id <> auth.uid()
  );
```

**Invariants doctrine :** aucune coordonnée dans la table (`body` seul) ;
attribution native (`sender_id`) → « c'est le coach qui parle », jamais « l'app » ;
le fil n'existe que si le pilote a consenti (binôme actif + `pilot_consent_at`) ;
temps réel d'affichage via **Supabase Realtime** (postgres_changes sur
`coach_messages` filtré par `coach_pilot_id`) — la persistance vit dans la table,
le « live » du fil est un abonnement, pas une seconde source de vérité.

### App-side (après validation)
- **`coachMessagesService`** : `listThread(coachPilotId)`, `sendMessage(...)`,
  `markRead(id)` + un hook `useCoachThread` (Realtime postgres_changes).
- **Écran** : remplacer le placeholder `app/(coach)/messages.tsx` (liste des
  binômes → fil) + entrée côté pilote (dans « Mon coach »).
- **Génération types** : régénérer `database.types.ts` après la migration.

---

## Ce que je fais MAINTENANT (sans DDL)

Rien en base. Sur ton **« go migration »**, j'applique via `apply_migration`
(une migration nommée), régénère les types, puis je construis l'app-side (toggle
live + gate relais ; service + écran messagerie). Jusque-là : **STOP**.
