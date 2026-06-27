# Rôles & permissions (RLS)

> Document de cadrage. Réf. : `00_PLATEFORME_OXV.md` (quatre comptes), `02_AUDIT_ROUTES.md` (espaces).
> **Source de vérité = le code réel** : `supabase/migrations/*.sql`, `docs/architecture/06_RLS_POLICIES_ACTUELLES.sql`, `docs/architecture/05_SCHEMA_SUPABASE_ACTUEL.md`, `src/types/database.types.ts`.
> Statut : cadrage avant code. **Aucune table / policy nouvelle n'est créée par ce document.** Tout schéma net-neuf est marqué « à créer — NÉCESSITE ACCORD » (Gabin).

La base Supabase (`fouvuqkdxarjpjbqnsjq`, Frankfurt) est **partagée entre le site web oxvehicle.fr et l'app**. Les policies décrites ici servent les deux. Ne jamais raisonner « app seule ».

---

## 1. Rôles et où ils vivent

### 1.1 Le rôle canonique : `users.role`

L'enum `user_role` (`src/types/database.types.ts:5379`, `:5581`) vaut **exactement** :

```
pilot · admin · coach · partner
```

`super_admin` **n'existe pas** dans l'enum, et **n'est pas au programme** : le cadrage pose **4 comptes** (pilote, coach, admin, partenaire — `00 §2`). Le cumul de rôles passe par `users.is_admin` (§1.2), pas un 5e rôle — voir §3.

`partner` est **présent dans l'enum** ET **réellement utilisé** : la table `partners` existe (`database.types.ts:2612`), le helper `is_partner()` existe (`:5155`) et des RLS s'appuient dessus (p. ex. `social_pings`). Ce qui manque = les tables d'offres/leads + l'espace `app/(partner)` — voir §3.

Le modèle est **mono-rôle** : un compte porte une seule valeur `role`. Exception assumée ci-dessous.

### 1.2 Les flags et le cumul

| Mécanisme | Colonne / fonction | Sens réel |
|---|---|---|
| `users.is_admin` | `boolean DEFAULT false` (`database.types.ts:4451`) | Cumul d'accès admin **par-dessus** un autre rôle. Sert le compte unique `administration@oxvehicle.fr` (admin + coach). |
| `is_admin()` | `STABLE SECURITY DEFINER` | **Après** migration `0041` : `role = 'admin' OR is_admin = true` (`20260617000000_0041_is_admin_honor_flag.sql`). Avant : `role = 'admin'` seul. |
| `is_coach()` | `STABLE SECURITY DEFINER` | `EXISTS (… users WHERE id = auth.uid() AND role = 'coach')` (`20260526190000_0034_coach_roulages.sql:29`). |
| `is_coach_of(pilot_uuid)` | `STABLE SECURITY DEFINER` | Vrai si auth.uid() est coach **actif ET consenti** du pilote (`20260525114148`). **C'est le vrai vecteur d'accès data coach**, pas `is_coach()`. |
| `is_my_coach(coach_uuid)` | `STABLE SECURITY DEFINER` | Réciproque côté pilote (`20260526230000_0038`). |
| `is_validated_member()` | `STABLE SECURITY DEFINER` | `kyc_status = 'validated'` (`20260526180000_0033`). Gate le volet social, **pas** un rôle. |
| `coach_has_permission(uuid, name)` | `SECURITY DEFINER`, fail-safe `false` | Permissions modulaires coach (`20260526170000_0032`). |
| `are_friends(a, b)` | — | Amitié réciproque (`database.types.ts:5087`). |

Toutes ces fonctions sont `SECURITY DEFINER` avec `search_path` épinglé (durci par `20260615190000_harden_function_search_path_and_revoke_internal.sql`) et `REVOKE … FROM PUBLIC, anon`. Ne pas les redéfinir sans accord.

### 1.3 Permissions modulaires du coach (`coach_permissions`)

Le rôle `coach` n'est **pas** monolithique (`20260526170000_0032`). Une ligne par coach, flags booléens :

| Flag | Défaut | Gate |
|---|---|---|
| `can_view_pilots` | `true` | Consulter la data des pilotes assignés+consentis (la RLS data reste sur `is_coach_of`). |
| `can_manage_own_sessions` | `false` | Gérer ses propres roulages OXV. |
| `can_view_business_dashboard` | `false` | Tableau de bord business (revenus). |

Ces flags **gatent des features**, pas la RLS data de base. Un trigger `ensure_coach_permissions` crée la ligne à la promotion en coach. Activation à la carte = **admin only**.

### 1.4 Synthèse — qui est qui

| Rôle / capacité | Comment c'est porté | Espace app |
|---|---|---|
| Pilote | `role = 'pilot'` | `app/(app)` |
| Coach | `role = 'coach'` + `coach_pilots` (affiliation) + `coach_permissions` | `app/(coach)` |
| Admin | `role = 'admin'` **ou** `is_admin = true` | `app/(admin)` |
| Admin + coach (compte unique) | `role = 'coach'` + `is_admin = true` | les deux |
| Partenaire | `role = 'partner'` (enum) — **rien d'autre n'existe** | `app/(partner)` **inexistant** |
| Super-admin | **inexistant** | — |

---

## 2. Matrice Table × Rôle (tables RÉELLES)

Légende : **R** = SELECT autorisé · **W** = INSERT/UPDATE/DELETE autorisé (préciser si partiel) · **—** = aucun accès via RLS · `auth` = `TO authenticated`.
« Coach » signifie ici **coach actif + consentement pilote** (`is_coach_of`), sauf mention contraire. Toutes ces policies sont **déjà en prod**.

| Table | Pilote (propriétaire) | Coach affilié+consenti | Admin | Partner | Source |
|---|---|---|---|---|---|
| `users` | R/W **soi** (`id = auth.uid()`) ; DELETE admin only | **—** directement → passe par `coach_pilots_view` (colonnes limitées) | R/W tout ; DELETE | — | `06_RLS_…sql:257` |
| `telemetry_sessions` | R/W **soi** (CRUD complet) | **R** (`is_coach_of(user_id)`) | — (pas de policy admin par défaut) | — | base + `20260525114148:116` |
| `app_session_analyses` | R **soi** (le bilan) | **R** (`is_coach_of(user_id)`) | — | — | `20260524190918_0009` + `…114148:144` |
| `app_segment_analyses` | R **soi** (virages) | **R** | — | — | `20260525150003_0022`, `…114148:150` |
| `laps` / `telemetry_frames` / `weather_snapshots` | R/W via session **soi** | **R** via session du pilote | — | — | `06_RLS_…sql:98/223/291` + `…114148:122/133` |
| `vehicles` | R/W **soi** ou admin | **R** (`is_coach_of(user_id)`) | R/W | — | `06_RLS_…sql:274` + `…114148:156` |
| `app_progression_shares` | R/W **soi** | **R** | (selon partage sécurisé) | — | `20260524230007_0011`, `…114148:162` |
| `coach_pilots` | **R** ses affiliations + **W** consentement seul (`pilot_consent_at`) | **R** ses affiliations | R/W tout (assignation) | — | `20260525114148:54-82` |
| `coach_pilots_view` (VUE, security_invoker) | — | **R** : ses pilotes consentis, colonnes non sensibles (`first_name, last_name, pilot_level, avatar_url`) — **jamais** email/tel/docs | — | — | `…114148:175` |
| `coach_annotations` | **R** notes `shared` non supprimées **soi** | R/W **ses** notes si `is_coach_of(pilot)` | R (audit RGPD) | — | `20260525150001_0020:80-99` |
| `coach_availability` | **R** créneaux des coachs **publiés** | R/W **ses** créneaux | R/W | — | `0007_coaching_marketplace.sql:104` |
| `coaching_bookings` | R **ses** demandes ; **INSERT** `pending` (coach publié) ; UPDATE → `cancelled` seul | R **ses** demandes ; UPDATE (accepter/décliner) | R/W tout | — | `0007:133-174` |
| `coach_reviews` | R avis des coachs **publiés** ; W **son** avis si booking `accepted`/`completed` | R (avis le concernant via fiche publiée) | R/W tout | — | `0008_coaching_reviews.sql:38-62` |
| `social_pings` | **R** si `is_published AND is_validated_member()` | idem (s'il est membre validé) | R/W tout (brouillons inclus) | — | `20260526180000_0033:106-115` |
| `session_media` | **R soi** (non supprimé) | **R** (`is_coach_of`) | R/W (upload/réordonner/soft-delete) | — | `20260526160000_0031:82-121` |
| `circuits` | R **soi** OU `is_official = true` ; W **soi** | (lecture via `is_official`) | implicite via propriété | — | `06_RLS_…sql:31-41` |

### 2.1 Lignes de force à retenir

- **Le consentement est le verrou.** Un coach assigné mais **sans** `pilot_consent_at` ne voit **rien** : `is_coach_of` renvoie `false` tant que `pilot_consent_at IS NULL` (`…114148:96-103`). L'affiliation seule n'ouvre aucune data.
- **Le coach est en lecture seule sur le pilote.** Il n'a **aucun** `W` sur `telemetry_sessions`, `app_session_analyses`, `vehicles`. Sa seule écriture côté pilote = `coach_annotations` (ses notes), strictement gated par `is_coach_of`.
- **Le coach ne voit jamais le PII commercial/RGPD** : pas d'accès à `documents`, `payments`, `registrations`, ni à `email`/`phone` du pilote. La vue `coach_pilots_view` matérialise ce cloisonnement (Postgres n'a pas de RLS par colonne).
- **L'admin n'a PAS d'accès par défaut à la télémétrie.** Les tables `telemetry_*`, `app_session_analyses`, `app_segment_analyses` n'ont **pas** de policy `is_admin()` SELECT (pattern « strictement propriétaire », `05_SCHEMA…:438`). C'est volontaire (RGPD). Tout besoin admin de lecture télémétrie = **nouvelle policy à soumettre** (NÉCESSITE ACCORD).
- **La marketplace n'ouvre aucune data.** Une `coaching_bookings.pending` ne donne accès à **rien** chez le pilote (`0007` §sécurité). Seule l'affiliation `coach_pilots` consentie le fait.
- **Identité pilote côté coach (marketplace)** = **prénom seul**, dénormalisé sur `coaching_bookings.pilot_first_name` / `coach_reviews.pilot_first_name` (`0008`). La ligne `users` du pilote n'est jamais exposée au coach.

---

## 3. Tables net-neuves — « à créer — NÉCESSITE ACCORD »

Aucune des entités ci-dessous n'existe en base. Chacune **nécessite l'accord explicite de Gabin** (schéma + RLS) avant migration. Ne jamais présenter ces lignes comme acquises.

| Domaine | Manque réel | Rôles concernés | Statut |
|---|---|---|---|
| **Partenaires (offres/leads)** | La table **`partners` EXISTE** (`database.types.ts:2612` : `owner_id`, `is_published`, `is_official_partner`, `partner_type`, `circuit_id`, lat/lon) et le helper **`is_partner()` EXISTE** (`:5155`, utilisé p. ex. par les RLS de `social_pings`). Ce qui MANQUE : `partner_offers`, `partner_leads`, `partner_bookings` et l'espace `app/(partner)` (net-neuf). | partner, admin | tables offres/leads à créer — **NÉCESSITE ACCORD** |
| **Super-admin** | Valeur absente de l'enum `user_role`. Aucun `is_super_admin()`. Le cumul admin se fait via `users.is_admin` (§1.2). **Hors périmètre** : 4 comptes au cadrage, pas de 5e rôle (`00 §2`). | — | non prévu (ne pas créer) |
| **Passeport pilote** | Pas de table. (V1.5, `03_MVP_SCOPE.md`.) | pilot (R soi), coach (R), admin | à créer — **NÉCESSITE ACCORD** |
| **Programmes / cycles coach** | Pas de table cycles/objectifs structurés côté coach (`pilot_goals` existe — `0023` — mais pas un programme coach complet). | coach (W), pilot (R) | à créer — **NÉCESSITE ACCORD** |
| **Garage pilote** | `vehicles` existe (R/W propriétaire) mais pas l'entité « garage » enrichie (carnet, diagnostic). | pilot, admin | à créer — **NÉCESSITE ACCORD** |
| **Carnet pilote** | Pas de table. (V1.5.) | pilot | à créer — **NÉCESSITE ACCORD** |
| **Pass OXV (QR événement)** | Pas de table. (V1.5.) | pilot, admin | à créer — **NÉCESSITE ACCORD** |
| **Qualité data / incidents (admin)** | Pas de table dédiée. | admin | à créer — **NÉCESSITE ACCORD** |

Règle pour Claude Code : **`is_partner()` et `partners` existent — utilise-les.** En revanche, **n'invente pas** `partner_offers`/`partner_leads`/`partner_bookings` ni un rôle `super_admin`. Si une PR a besoin des tables d'offres/leads partenaire, elle s'arrête et demande le schéma à Gabin.

---

## 4. Cas dangereux — comportement attendu

Comportements à respecter strictement. La plupart sont **déjà garantis par la RLS** ; les autres sont des règles applicatives à ne pas contredire.

### 4.1 Coach retiré d'un pilote

- **Mécanisme** : admin passe `coach_pilots.active = false` (ou supprime la ligne).
- **Effet immédiat** : `is_coach_of` renvoie `false` → le coach perd **tout** accès lecture (sessions, analyses, virages, médias, vehicles) **et** toute écriture d'annotation. Les annotations déjà écrites ne sont plus visibles pour lui (la policy `coach_annotations_coach_all` exige `is_coach_of(pilot_id)`).
- **Côté pilote** : les notes `shared` déjà reçues restent lisibles par le pilote (`coach_annotations_pilot_select` ne dépend pas de `is_coach_of`). Doctrine : **on ne fait pas disparaître** ce que le pilote a déjà vu.
- **Affichage** : disparition silencieuse côté coach (pas d'erreur prescriptive). Côté pilote, mention sobre type « Ce coach ne vous suit plus » — **pas** d'emoji, vouvoiement.

### 4.2 Pilote retire son consentement

- **Mécanisme** : le pilote remet `coach_pilots.pilot_consent_at = NULL` (policy `coach_pilots_update_own_pilot_consent`, **seule** colonne qu'il peut toucher ; il ne change ni coach, ni `active`).
- **Effet immédiat** : `is_coach_of = false` → le coach est coupé de **toute** la data du pilote, exactement comme en §4.1, sans intervention admin. C'est le **droit de retrait RGPD** matérialisé en une écriture.
- **Disparition de la vue** : le pilote sort instantanément de `coach_pilots_view` (clause `pilot_consent_at IS NOT NULL`).
- **À respecter** : aucun cache applicatif ne doit reservir de la data coach après retrait. Toujours requêter sous RLS, jamais bypasser via service role côté app.

### 4.3 Partenaire désactivé

- **État réel** : il n'existe **aucune** infrastructure partenaire (cf. §3). Un compte `role = 'partner'` n'a aujourd'hui **aucun** accès spécifique — il est traité comme un authentifié sans données propres.
- **Comportement attendu une fois l'espace créé** (à cadrer avec accord) : désactivation = ses offres/pings passent en non-publié → invisibles des membres validés (modèle déjà éprouvé sur `social_pings.is_published` et `coach_profiles.is_published`). À spécifier dans la migration partenaire **à soumettre**.

### 4.4 Admin change un rôle

- **Mécanisme** : admin met à jour `users.role` (policy `users_update_own_or_admin`, branche `is_admin()`).
- **Garde-fou DB** : `0042_guard_users_role_kyc_and_uuid_searchpath.sql` encadre les changements de `role`/`kyc` — ne pas contourner.
- **Effets en cascade** :
  - vers `coach` : trigger `ensure_coach_permissions` crée la ligne `coach_permissions` (base `view_pilots`). Le nouveau coach ne voit **toujours rien** tant qu'aucune affiliation `coach_pilots` consentie n'existe.
  - retrait de `coach` : il faut désactiver/supprimer ses lignes `coach_pilots` (à faire explicitement ; sinon `is_coach_of` continuerait de matcher tant que `role='coach'` — donc **retirer le rôle ne suffit pas seul**, l'admin doit aussi couper les affiliations). À tracer.
  - cumul admin : se fait via `users.is_admin = true`, **pas** en changeant `role` (cf. `0041`).
- **Audit** : journaliser via `admin_audit` (table dédiée, `06_RLS_…sql:18`). Tout changement de rôle est une action sensible.

### 4.5 Session supprimée

- **Mécanisme** : le pilote DELETE sa `telemetry_sessions` (`telemetry_sessions_delete`, propriétaire). L'admin n'a **pas** ce droit par défaut.
- **Cascade** : `laps`, `telemetry_frames`, `weather_snapshots`, `app_session_analyses`, `app_segment_analyses`, `session_media` (`ON DELETE CASCADE`) partent avec. `coach_annotations.telemetry_session_id` est `ON DELETE SET NULL` → la note coach **survit** mais se rattache au virage en général (comportement voulu, `0020`).
- **Storage** : l'objet `.ubx` (`raw_data_url`) et les médias dans le bucket `session-media` doivent être purgés par un job séparé (soft-delete d'abord côté `session_media.deleted_at`).
- **À respecter** : suppression = définitive côté pilote, **sans confirmation prescriptive culpabilisante**. Ton sobre.

### 4.6 Demande RGPD (accès / suppression de compte)

- **Colonnes existantes** : `users.deletion_requested_at`, `deletion_scheduled_at`, `suspended_at` (`05_SCHEMA…:99-104`). L'infrastructure de suppression différée existe.
- **Suppression compte** : `users_delete_admin_only` → **admin only**. Le pilote demande, l'admin exécute (ou un job lit `deletion_scheduled_at`). Le `ON DELETE CASCADE` sur `coach_pilots`, `coaching_bookings`, `coach_reviews`, `session_media`, `vehicles`, télémétrie nettoie le périmètre.
- **Accès / portabilité** : un export doit couvrir au minimum `users` (soi), `telemetry_sessions` + dérivés, `coach_annotations` reçues, `coaching_bookings`, `coach_reviews`. À cadrer dans `07_DATA_POLICY.md`.
- **Audit coach** : les policies admin SELECT sur `coach_annotations` existent **pour** répondre aux demandes RGPD (qui a écrit quoi sur le pilote). Ne pas les retirer.
- **À respecter** : toute opération RGPD est tracée dans `admin_audit`. Le consentement coaching (§4.2) est révocable à tout instant, indépendamment de la suppression de compte.

---

## 5. Garde-fous pour Claude Code

1. **Mono-rôle + flag** : un compte = un `role` ; le seul cumul légitime est `is_admin = true` (admin par-dessus coach). Pas d'autre cumul.
2. **`is_coach_of`, jamais `is_coach`** pour gater de la data pilote. `is_coach()` ne dit que « ce user est coach », pas « ce coach a le droit de voir CE pilote ».
3. **Le consentement prime sur l'affiliation** : `active = true` ET `pilot_consent_at IS NOT NULL`. Les deux.
4. **L'admin ne lit pas la télémétrie par défaut.** Ne pas supposer le contraire.
5. **`partner` est réel** (table `partners` + `is_partner()`) — seules ses tables d'offres/leads sont à créer ; **`super_admin` n'est pas prévu.** Toute table d'offres/leads partenaire déclenche une demande d'accord (§3), pas un schéma improvisé.
6. **Base partagée site↔app** : une policy modifiée impacte oxvehicle.fr. Aucune migration / policy nouvelle sans accord explicite de Gabin (`00_PLATEFORME_OXV.md §6`).
7. **Doctrine dans les messages d'erreur de permission** : sobre, vouvoiement, sans verbe prescriptif, sans emoji. Un refus RLS côté app se traduit par un état vide calme, pas par « accès interdit ».
