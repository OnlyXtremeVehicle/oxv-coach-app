# PROMPT CLAUDE CODE — LOT V2-BE1 · BACKEND FONDATIONS
### Repo oxv-app · migrations + services nouveaux · un lot = un commit — 18/07/2026

---

## CONTEXTE
Socle backend de la v2 : flags, biométrie, fondateurs, incidents, vidéo (métadonnées d'alignement), groupes/convois, extensions de services. **C'est le SEUL lot autorisé à toucher `supabase/migrations/` et à créer/étendre des services.** Aucun écran. Référence : `OXV_APP_V2_DOSSIER_MAITRE.md` §9.

## CONTRAINTES
1. Toute migration : idempotente (`IF NOT EXISTS`), RLS activée dans LA MÊME migration que le CREATE TABLE, policies nommées explicitement.
2. **Inspection MCP AVANT création** pour toute table potentiellement existante côté site : `crews`, `crew_members`, `payments`, `pricing`. Si elles existent : documenter leur structure dans `docs/architecture/` et NE PAS les recréer — adapter les services. Si absentes : créer selon spec ci-dessous.
3. Fail-closed partout : flag absent = OFF ; consentement absent = pas d'écriture ni lecture.
4. `tsc` 0 · jest vert · tests unitaires pour chaque service nouveau (logique pure) + tests RLS ajoutés dans `src/__tests__/rls/` (skippés sans credentials, comme l'existant).
5. Commit : `feat(v2): BE1 socle backend — flags, biometrie, fondateurs, incidents`.

## LIVRABLE 1 — Feature flags
Insérer via migration dans `app_feature_flags` (table existante) : `app_payments`, `biometry`, `founders`, `video_overlay`, `convoys` — tous `enabled=false`. Vérifier que `isFlagEnabled` (existant, fail-closed) les lit sans modification.

## LIVRABLE 2 — Biométrie · migration `2026xxxx_biometry_foundation.sql`
```sql
CREATE TABLE IF NOT EXISTS public.biometry_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.telemetry_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ts timestamptz NOT NULL,
  hr smallint NOT NULL CHECK (hr BETWEEN 25 AND 250),
  rr_ms smallint[] NULL,                -- Polar uniquement
  source text NOT NULL CHECK (source IN ('polar_h10','apple_watch')),
  quality smallint NULL CHECK (quality BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, ts, source)       -- idempotence rejeu
);
ALTER TABLE public.biometry_raw ENABLE ROW LEVEL SECURITY;
-- Pilote : own-row complet
CREATE POLICY biometry_own_all ON public.biometry_raw
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Coach : lecture seule si binôme détaillé + consentement biométrie actif
CREATE POLICY biometry_coach_read ON public.biometry_raw
  FOR SELECT USING (
    public.is_detailed_coach_of(auth.uid(), user_id)
    AND EXISTS (SELECT 1 FROM public.user_consents c
      WHERE c.user_id = biometry_raw.user_id AND c.kind = 'biometry'
      AND c.granted_at IS NOT NULL AND c.revoked_at IS NULL)
  );
-- JAMAIS de policy partner/staff. Index (session_id, ts).
CREATE INDEX IF NOT EXISTS biometry_raw_session_ts ON public.biometry_raw(session_id, ts);
```
Adapter le nom exact de la table/colonnes de consentement à l'existant (`consentService` — inspecter d'abord ; si le modèle actuel est colonne par kind, ajouter le kind `biometry` selon le même patron, défaut NULL=OFF). Ajouter `biometry_raw` à la purge : étendre `purge-deleted-accounts` (DELETE where user_id) + rétention 30 j via fonction `purge_old_biometry()` (SECURITY DEFINER, search_path figé, REVOKE EXECUTE public) — cron à poser manuellement (documenter dans le header comme l'existant).

## LIVRABLE 3 — Fondateurs · migration `2026xxxx_founder_applications.sql`
```sql
CREATE TABLE IF NOT EXISTS public.founder_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  motivation text NOT NULL CHECK (char_length(motivation) BETWEEN 20 AND 2000),
  referrer_code text NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
  decided_by uuid NULL, decided_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- RLS : own insert/select ; admin all ; UPDATE de status admin-only (trigger anti self-approve
-- sur le modèle du guard users.role migration 0042).
```
Compteur public « x/30 » : fonction `founders_count()` SECURITY DEFINER retournant uniquement `approved count` (pas de listing).

## LIVRABLE 4 — Incidents · migration `2026xxxx_incident_reports.sql`
```sql
CREATE TABLE IF NOT EXISTS public.incident_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NULL REFERENCES public.telemetry_sessions(id),
  user_id uuid NOT NULL REFERENCES public.users(id),
  occurred_at timestamptz NOT NULL,
  description text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 4000),
  photo_path text NULL,                 -- bucket pilot-media, dossier {uid}/incidents/
  created_at timestamptz NOT NULL DEFAULT now()
);
-- RLS : pilote INSERT + SELECT own ; admin SELECT ; AUCUN UPDATE/DELETE pilote (immuable après envoi
-- — valeur probatoire assurantielle) ; admin peut annoter via table séparée si besoin ultérieur.
```

## LIVRABLE 4bis — Vidéo du tour · migration `2026xxxx_video_overlays.sql`
Table réclamée par L1 (cellule « ◉ VIDÉO DU TOUR » derrière flag `video_overlay`) et écrite par B1 (offset tap-align). BE-1 crée la table vide ; B1 en fait l'usage. Vidéo 100 % on-device : la table ne stocke QUE des métadonnées d'alignement, jamais le média.
```sql
CREATE TABLE IF NOT EXISTS public.video_overlays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.telemetry_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  local_asset_id text NOT NULL,          -- identifiant PHAsset/MediaLibrary local, jamais d'URL serveur
  offset_ms integer NOT NULL,            -- décalage franchissement image ↔ télémétrie (peut être négatif)
  duration_ms integer NULL CHECK (duration_ms IS NULL OR duration_ms > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id, local_asset_id)   -- idempotence re-calage
);
ALTER TABLE public.video_overlays ENABLE ROW LEVEL SECURITY;
CREATE POLICY video_overlays_own_all ON public.video_overlays
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- AUCUNE policy coach/partner/staff : la vidéo est strictement privée pilote (doctrine + RGPD).
CREATE INDEX IF NOT EXISTS video_overlays_session ON public.video_overlays(session_id);
```
Ajouter à la purge compte (`purge-deleted-accounts` : DELETE where user_id). `local_asset_id` ne référençant qu'un asset local, aucune purge storage serveur nécessaire.

## LIVRABLE 5 — Groupes (A3) & convois (C2) — APRÈS inspection MCP
1. `list_tables` + lecture de la définition de `crews_public` en prod. Documenter dans `docs/architecture/12_CREWS_PROD.md`.
2. Si structure exploitable → `referralService` s'y adosse. Sinon créer `crews`(id, name, owner_id) + `crew_members`(crew_id, user_id, joined_at, UNIQUE) — RLS : membre lit son groupe, owner gère, insertion via parrainage uniquement.
3. `users.referral_code` : colonne text UNIQUE générée (8 car., fonction serveur), migration + backfill.
4. `convoys`(id, session_id ref sessions SITE, route_id ref scenic_routes, rdv_at, meeting_point text) + `convoy_participants` — RLS : inscrits de la journée (EXISTS registrations) lisent/rejoignent.

## LIVRABLE 6 — Services nouveaux · `src/services/v2/`
Chacun : logique pure séparée (testable sans réseau) + I/O Supabase, patron des services existants, erreurs remontées (pas de catch muet).
| Service | API minimale |
|---|---|
| `biometryService` | `saveSamples(sessionId, samples[], source)` (chunks 500, upsert onConflict) · `getSessionBiometry(sessionId)` · `getRunBiometry(sessionId, fromTs, toTs)` · `computeQuality(samples, expectedHz)` (pur, testé : densité + trous >10 s) |
| `healthKitService` | wrapper natif (expo-health ou module léger) : `requestAuthorization()` · `readHeartRate(from, to)` — **iOS only, no-op Android**, jamais appelé sans consentement `biometry` (gate dans le service, fail-closed) |
| `founderService` | `apply(motivation, referrerCode?)` · `getMyApplication()` · `getFoundersCount()` |
| `incidentService` | `report({sessionId?, occurredAt, description, photoUri?})` (upload photo → path → insert) · `listMine()` |
| `referralService` | `getMyCode()` · `redeem(code)` (crée amitié + rattache crew, idempotent) · `getMyCrew()` |
| `convoysService` | `getForSession(sessionId)` · `join/leave` |
| `videoOverlayService` | `saveOffset({sessionId, localAssetId, offsetMs, durationMs?})` (upsert onConflict) · `getForSession(sessionId)` — own-row uniquement |
| `consentService` (extension) | kind `biometry` : `grant/revoke/status` — même patron que les kinds existants |
Types Supabase régénérés en fin de lot (`supabase gen types`) — supprime les casts `as never` recensés au bilan.

## LIVRABLE 7 — Preuves
tsc 0 · jest vert (+ nouveaux tests logique pure : quality, referral idempotence, founder gating) · tests RLS ajoutés (biometry coach/partner/anonyme = deny) · advisors Supabase : 0 nouveau ERROR · doc `12_CREWS_PROD.md` et `13_BE1_ETAT.md` (ce qui a été créé vs adossé à l'existant).

## HORS PÉRIMÈTRE
Écrans · BLE Polar (BIO-2) · edges paiement (A1-ON) · canal live:board (LIVE-B) · mini-app Watch (BIO-3).
