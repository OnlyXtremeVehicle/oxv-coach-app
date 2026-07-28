# 14 — Matrice de purge RGPD (SEC-1 · Chantier 2 · Action 5)

> Audit du 19/07/2026 — projet Supabase prod `fouvuqkdxarjpjbqnsjq` (eu-west-1).
> Source auditée : edge `purge-deleted-accounts` **version 4 prod** (identique au
> fichier local `supabase/functions/purge-deleted-accounts/index.ts` avant SEC-1).
> Inventaire des tables/colonnes : `information_schema` en lecture seule.
>
> Corrections préparées (NON appliquées, approbation fondateur requise) :
>
> - Migration `supabase/migrations/20260719_sec1_purge_sante.sql` (fonction SQL
>   transactionnelle `public.purge_user_data(uuid)`).
> - Edge v5 `supabase/functions/purge-deleted-accounts/index.ts` (storage étendu
>   - récursif, appel RPC).

---

## Constats majeurs

| #   | Constat                                                                                                                                                                                                                                                                                                                                                | Gravité  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 1   | **Aucun cron planifié** pour `purge-deleted-accounts` (`cron.job` prod vérifié : 6 jobs, aucun purge). L'edge v4 est ACTIVE mais n'est **jamais invoquée automatiquement** → les comptes dont le délai de grâce est écoulé ne sont pas purgés. Infraction art. 17 en pratique.                                                                         | CRITIQUE |
| 2   | **~20 tables portant des données personnelles hors périmètre v4** (détail section B) — dont `coach_profiles` (SIRET, adresse de facturation, `payment_link` avec IBAN potentiel), `session_intentions` (texte libre potentiellement intime), `coach_annotations` (texte libre + audio sur le pilote), `demandes_inscription` (copie complète du PII).  | HAUTE    |
| 3   | **Storage : 4 buckets couverts sur 12**, et la suppression par préfixe n'est **pas récursive** — les chemins imbriqués (`session-media/{uid}/{sessionId}/{fichier}`) sont silencieusement ignorés par `list(userId)` + `remove()`. `coach-audio` (objets nommés par `annotationId`, sans préfixe utilisateur) n'est pas purgeable par préfixe du tout. | HAUTE    |
| 4   | **Colonnes `users` ajoutées après la v4 et non scrubées** : `bio`, `socials`, `media`, `livery`, `vehicle`, `car_number`, `affiliation_code`, `suspension_reason`, `pavilion_name_optin`.                                                                                                                                                              | MOYENNE  |
| 5   | `incident_reports` **n'existe pas encore en prod** (vérifié). `biometry_*` non plus. Politiques posées par avance (section E) et déjà codées de façon conditionnelle dans la fonction SQL (`to_regclass`).                                                                                                                                             | INFO     |
| 6   | Tables `_backup_sessions_20260719` et `_backup_registrations_20260719` : **copies de PII hors de toute purge** (dont `private_client_name/contact`). À DROP après vérification (décision fondateur, hors migration SEC-1).                                                                                                                             | MOYENNE  |
| 7   | La purge v4 est **non transactionnelle** (~23 DELETE séquentiels) : un échec au milieu laisse un compte à moitié purgé mais l'idempotence (placeholder email posé en fin) fait retenter au run suivant. Corrigé : tout le DML passe dans une fonction SQL unique (tout ou rien).                                                                       | MOYENNE  |

---

## A — Couvert par la v4 (conforme, repris tel quel dans la fonction SQL)

| Table                                                                 | Colonnes sensibles                             | Aujourd'hui (v4)                                            | Devrait                                            | Écart                                                                     |
| --------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------- |
| `telemetry_sessions`                                                  | télémétrie complète (géoloc piste)             | PURGE (`user_id`) → cascade `telemetry_frames`/`laps`/météo | idem                                               | aucun                                                                     |
| `vehicles`                                                            | plaques, photos, notes                         | PURGE                                                       | idem                                               | aucun                                                                     |
| `documents`                                                           | permis, licences, certificats médicaux (scans) | PURGE (lignes)                                              | idem + objets storage `documents/` (couvert)       | aucun                                                                     |
| `app_session_analyses` / `app_segment_analyses`                       | lecture qualitative de conduite                | PURGE                                                       | idem                                               | aucun                                                                     |
| `app_progression_shares`                                              | partages sociaux                               | PURGE                                                       | idem                                               | aucun                                                                     |
| `circuits` (perso)                                                    | tracés créés par l'utilisateur                 | PURGE                                                       | idem                                               | aucun                                                                     |
| `heritage_packs`                                                      | contenus personnels                            | PURGE                                                       | idem                                               | aucun                                                                     |
| `ritual_dispatches`                                                   | envois personnalisés                           | PURGE                                                       | idem                                               | aucun                                                                     |
| `pilot_goals`                                                         | `body`, `detail` (texte libre)                 | PURGE                                                       | idem                                               | aucun                                                                     |
| `session_media`                                                       | `storage_path`, `caption`                      | PURGE (lignes seulement)                                    | PURGE lignes **+ objets** `session-media/{uid}/**` | **objets storage jamais supprimés (chemins imbriqués)** → corrigé edge v5 |
| `coach_permissions`                                                   | droits accordés                                | PURGE                                                       | idem                                               | aucun                                                                     |
| `coach_pilots` (2 sens)                                               | lien coach↔pilote                              | PURGE                                                       | idem                                               | aucun                                                                     |
| `coach_session_context` (2 sens)                                      | contexte de séance                             | PURGE                                                       | idem                                               | aucun                                                                     |
| `coach_corner_reference` / `coach_reading_weights` / `coach_roulages` | données coach                                  | PURGE (`coach_id`)                                          | idem                                               | aucun                                                                     |
| `roulage_invitations`                                                 | invitations                                    | PURGE (`pilot_id`)                                          | idem                                               | aucun                                                                     |
| `pilot_friendships` (3 colonnes)                                      | graphe social                                  | PURGE                                                       | idem                                               | aucun                                                                     |

## B — Écarts : tables portant du PII **ignorées** par la v4

Politique : PURGE = DELETE ; ANONYMISER = la ligne reste, le lien/texte identifiant part.

| Table                                  | Colonnes sensibles                                                                                                                         | Aujourd'hui (v4)                            | Devrait                                                                                                                                | Correction préparée                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `coach_profiles`                       | `billing_name`, `billing_address`, `billing_siret`, `payment_link` (IBAN potentiel — cf. ACTION 3), `bio`, `photo_url`, `socials`, `media` | **IGNORE**                                  | PURGE (`coach_id`)                                                                                                                     | migration (fonction SQL)                                       |
| `coach_annotations`                    | `body` (texte libre sur le pilote), `audio_url`                                                                                            | **IGNORE**                                  | PURGE (`coach_id` OU `pilot_id`) + objets `coach-audio/{annotationId}`                                                                 | migration + edge v5 (collecte des ids audio AVANT la purge DB) |
| `coach_annotation_template`            | `label`, `body`                                                                                                                            | **IGNORE**                                  | PURGE (`coach_id`)                                                                                                                     | migration                                                      |
| `coach_availability`                   | agenda du coach                                                                                                                            | **IGNORE**                                  | PURGE (`coach_id`)                                                                                                                     | migration                                                      |
| `coach_objectives`                     | objectifs nominatifs                                                                                                                       | **IGNORE**                                  | PURGE (`coach_id` OU `pilot_id`)                                                                                                       | migration                                                      |
| `coach_pilot_highlight`                | mises en avant nominatives                                                                                                                 | **IGNORE**                                  | PURGE (`coach_id` OU `pilot_id`)                                                                                                       | migration                                                      |
| `coach_messages`                       | `body` (messagerie privée)                                                                                                                 | **IGNORE**                                  | PURGE (`coach_id` OU `pilot_id` — la relation n'existe plus)                                                                           | migration                                                      |
| `coach_testimonials`                   | `author_first_name` (dénormalisé), `body` (témoignage) — remplace `coach_reviews` (V2-L5-B, plus de note)                                  | **IGNORE**                                  | PURGE (`author_user_id` OU `coach_id`) — cf. hotfix 20260719180000 (le CASCADE ne suffit pas : la purge anonymise la ligne users)      | migration                                                      |
| `coaching_bookings`                    | `pilot_first_name` (dénormalisé)                                                                                                           | **IGNORE**                                  | **ANONYMISER** (`pilot_first_name` → NULL ; la ligne reste = historique commercial du coach, `pilot_id` pointe vers une ligne scrubée) | migration                                                      |
| `pilot_sheets`                         | `focus`, `vehicles_note` (fiche coach sur le pilote)                                                                                       | **IGNORE**                                  | PURGE (`pilot_id`)                                                                                                                     | migration                                                      |
| `session_intentions`                   | `body` (texte libre, potentiellement intime/état mental)                                                                                   | **IGNORE**                                  | PURGE (`user_id`)                                                                                                                      | migration                                                      |
| `session_feedback`                     | `comment` (texte libre, témoignage publiable)                                                                                              | **IGNORE**                                  | PURGE (`user_id`) — le droit à l'effacement prime sur le témoignage publié                                                             | migration                                                      |
| `demandes_inscription`                 | `first_name`, `last_name`, `email`, `phone`, `birth_date` (copie complète du PII d'inscription)                                            | **IGNORE**                                  | PURGE (`created_user_id`) — les demandes sans compte créé restent (hors périmètre compte, rétention à borner par ailleurs)             | migration                                                      |
| `contact_messages`                     | `first_name`, `last_name`, `email`, `phone`, `ip_address`, message                                                                         | **IGNORE**                                  | PURGE (`user_id`) — les messages anonymes (sans `user_id`) restent, rétention à borner par ailleurs                                    | migration                                                      |
| `support_tickets` + `support_messages` | `subject`, `body` (texte libre)                                                                                                            | **IGNORE**                                  | PURGE (tickets du user + messages du user et de ses tickets)                                                                           | migration                                                      |
| `app_pairing_codes`                    | `used_user_agent` (empreinte technique)                                                                                                    | **IGNORE**                                  | PURGE (`user_id`)                                                                                                                      | migration                                                      |
| `media`                                | `file_url` (photos du pilote prises par le staff), `title`, `description`                                                                  | **IGNORE**                                  | PURGE lignes (`user_id`) + retrait best-effort des objets (URL parsée)                                                                 | migration + edge v5 (collecte `file_url` AVANT la purge DB)    |
| `media_exports`                        | exports liés au pilote                                                                                                                     | **IGNORE**                                  | PURGE (`user_id`)                                                                                                                      | migration                                                      |
| `event_registrations`                  | présence à événements                                                                                                                      | **IGNORE**                                  | PURGE (`pilot_id`)                                                                                                                     | migration                                                      |
| `partner_accounts`                     | profil partenaire lié (`profile_id`)                                                                                                       | **IGNORE**                                  | PURGE (`profile_id`)                                                                                                                   | migration                                                      |
| `partner_leads`                        | leads transmis aux partenaires                                                                                                             | **IGNORE**                                  | PURGE (`pilot_id`)                                                                                                                     | migration                                                      |
| `ping_rsvps`                           | réponses à invitations sociales                                                                                                            | **IGNORE**                                  | PURGE (`user_id`)                                                                                                                      | migration                                                      |
| `scenic_routes`                        | tracés géo personnels                                                                                                                      | **IGNORE**                                  | PURGE (`user_id`) ; `certified_by` (admin) conservé                                                                                    | migration                                                      |
| `social_pings`                         | `address`, `contact_email` (coordonnées de l'organisateur)                                                                                 | **IGNORE**                                  | PURGE (`created_by`)                                                                                                                   | migration                                                      |
| `duels`                                | défi social nominatif                                                                                                                      | **IGNORE**                                  | PURGE (`challenger_id`) + ANONYMISER (`opponent_id` → NULL)                                                                            | migration                                                      |
| `crew_members`                         | appartenance, parrainage                                                                                                                   | **IGNORE**                                  | PURGE (`user_id`) + ANONYMISER (`referred_by` → NULL sur les autres lignes)                                                            | migration                                                      |
| `device_assignments`                   | lien pilote↔boîtier                                                                                                                        | **IGNORE**                                  | ANONYMISER (`pilot_id` → NULL — historique matériel conservé)                                                                          | migration                                                      |
| `email_log`                            | `subject` (peut contenir le prénom), `metadata`, `user_id`                                                                                 | **IGNORE** (noté « à arbitrer » dans la v4) | **ANONYMISER** (`user_id`, `subject`, `metadata` → NULL ; `email_type`/`status`/dates conservés pour l'audit de délivrabilité)         | migration                                                      |
| `admin_audit`                          | `user_id`, `ip_address`                                                                                                                    | **IGNORE**                                  | **ANONYMISER** (`user_id` → NULL, aligné sur son `ON DELETE SET NULL`) ; rétention globale du log à borner (hors SEC-1)                | migration                                                      |

## C — Ligne `users` (scrub, colonne par colonne)

| Colonne                                                                   | Aujourd'hui (v4)                       | Devrait                                                                                       | Écart                        |
| ------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------- |
| `email`                                                                   | placeholder `deleted-<id>@oxv.invalid` | idem                                                                                          | aucun                        |
| `first_name`, `last_name`, `birth_date`, `phone`, `address_*` (4)         | NULL                                   | idem                                                                                          | aucun                        |
| `emergency_contact_name/phone/relation`                                   | NULL                                   | idem                                                                                          | aucun                        |
| **`blood_type`, `medical_notes`** (données de SANTÉ)                      | NULL                                   | idem                                                                                          | aucun — scrub santé confirmé |
| `ffsa_license`, `experience_years`                                        | NULL                                   | idem                                                                                          | aucun                        |
| `avatar_url`, `public_handle`, `admin_notes`                              | NULL                                   | idem                                                                                          | aucun                        |
| `expo_push_token`, `notification_preferences`                             | NULL                                   | idem + `push_notif_enabled` → false                                                           | mineur, corrigé              |
| **`bio`**                                                                 | **IGNORE**                             | NULL                                                                                          | corrigé (migration)          |
| **`socials`, `media`, `livery`** (jsonb)                                  | **IGNORE**                             | NULL                                                                                          | corrigé (migration)          |
| **`vehicle`, `car_number`** (quasi-identifiants publics)                  | **IGNORE**                             | NULL                                                                                          | corrigé (migration)          |
| **`affiliation_code`**                                                    | **IGNORE**                             | NULL                                                                                          | corrigé (migration)          |
| **`suspension_reason`** (texte libre admin)                               | **IGNORE**                             | NULL (les timestamps `suspended_at/by` restent)                                               | corrigé (migration)          |
| **`pavilion_name_optin` / `_at`**                                         | **IGNORE**                             | false / NULL (le nom affiché n'existe plus)                                                   | corrigé (migration)          |
| `accepts_marketing`                                                       | inchangé                               | false                                                                                         | corrigé (migration)          |
| `stripe_customer_id`                                                      | CONSERVÉ                               | CONSERVÉ (réconciliation facturation) — effacement côté Stripe = appel API séparé, à trancher | conservation volontaire      |
| `pact/cgu/privacy/coach_pact_accepted_at + versions`                      | CONSERVÉS                              | CONSERVÉS (preuve de consentement)                                                            | conservation volontaire      |
| `deletion_requested_at/scheduled_at`                                      | CONSERVÉS                              | CONSERVÉS (preuve d'exécution de l'effacement)                                                | conservation volontaire      |
| `role`, `kyc_status/…`, `created_at`, `preferred_language`, `pilot_level` | inchangés                              | inchangés (non identifiants une fois le reste scrubé)                                         | aucun                        |

## D — Storage (12 buckets prod)

| Bucket                                                | Convention de chemin                                   | Aujourd'hui (v4)           | Devrait                                                                                         | Écart                                 |
| ----------------------------------------------------- | ------------------------------------------------------ | -------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------- |
| `vehicles`, `documents`, `avatars`, `audio_briefings` | `{userId}/…`                                           | purge préfixe **1 niveau** | purge préfixe **récursive**                                                                     | sous-arborescences ignorées → edge v5 |
| `pilot-media`                                         | `{pilotId}/{mediaId}.{ext}`                            | **IGNORE**                 | purge préfixe récursive                                                                         | edge v5                               |
| `session-media`                                       | `{pilotUserId}/{sessionId}/{mediaId}.{ext}` (imbriqué) | **IGNORE**                 | purge préfixe récursive                                                                         | edge v5                               |
| `telemetry_raw`                                       | `{userId}/{sessionId}.ubx`                             | **IGNORE**                 | purge préfixe récursive                                                                         | edge v5                               |
| `coach-media`                                         | `{coachId}/{mediaId}.{ext}`                            | **IGNORE**                 | purge préfixe récursive                                                                         | edge v5                               |
| `coach-audio`                                         | `{annotationId}` (PAS de préfixe user)                 | **IGNORE**                 | suppression par liste d'ids `coach_annotations.id` (coach = user), collectée AVANT la purge DB  | edge v5                               |
| `invoices`                                            | —                                                      | IGNORE                     | **CONSERVER** (obligation légale facturation)                                                   | conservation volontaire               |
| `pavillon-photos`                                     | posté par admin                                        | IGNORE                     | procédure MANUELLE sur demande (droit à l'image, photos d'événement — le pilote peut y figurer) | hors purge automatique, documenté     |
| `partner-media`                                       | assets partenaires                                     | IGNORE                     | rien (pas de PII pilote)                                                                        | aucun                                 |

## E — Tables futures (n'existent PAS en prod au 19/07/2026)

| Table                            | Politique posée                                                                                                                                                                                                                                                                                                                                                  | Implémentation                                                                                                                               |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `incident_reports`               | **ANONYMISER, JAMAIS PURGER** : `user_id` → NULL + gel de la ligne (aucune modification ultérieure). Conservation pour sécurité/assurance/contentieux. `// TODO_AVOCAT E5` — durée de rétention et périmètre exact à arbitrer juridiquement. À la création de la table : prévoir la colonne de gel (`anonymized_at`) + trigger d'interdiction d'UPDATE post-gel. | Bloc conditionnel `to_regclass('public.incident_reports')` déjà présent dans `purge_user_data()` — s'active tout seul quand la table naîtra. |
| `biometry_raw` (et `biometry_*`) | **PURGE totale** (donnée de santé, art. 9 — aucune base de conservation)                                                                                                                                                                                                                                                                                         | Bloc conditionnel `to_regclass('public.biometry_raw')` déjà présent dans `purge_user_data()`.                                                |

## F — Conservations volontaires (bases légales)

| Objet                                                                                                                                                                                                         | Base                                      | Note                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `payments`, `registrations`, `invoices` (table + bucket), `subscriptions`                                                                                                                                     | obligation légale de facturation (10 ans) | `payments.user_id` NO ACTION est la raison de la stratégie anonymiser-et-purger. Effacement côté Stripe = à trancher (API séparée). |
| Références « acteur staff » (`granted_by`, `validated_by`, `reviewed_by`, `cancelled_by`, `checked_in_by`, `created_by`, `kyc_validated_by`, `suspended_by`, `owner_admin_id`, `generated_by`, `captain_id`…) | intérêt légitime (traçabilité)            | uuid pointant vers une ligne `users` scrubée = pseudonymisé.                                                                        |
| Acceptations pacte/CGU/confidentialité (`users.*_accepted_at`, versions)                                                                                                                                      | preuve de consentement                    | conservées sur la ligne scrubée.                                                                                                    |

## G — Hors purge automatique (procédure manuelle / autres actions)

| Objet                                                         | Pourquoi                                                                      | Suite                                                                                   |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `sessions.private_client_name/contact`                        | texte libre saisi par l'admin, non rattachable automatiquement à un `user_id` | procédure manuelle documentée + resserrage policy (SEC-1 ACTION 3)                      |
| `_backup_sessions_20260719`, `_backup_registrations_20260719` | copies de tables avec PII, hors RLS applicative et hors purge                 | **DROP à faire approuver par le fondateur** après vérification qu'elles ne servent plus |
| `crews.captain_id` d'un capitaine supprimé                    | l'équipe appartient à ses membres                                             | conservé (pseudonymisé) ; réattribution du capitanat = décision produit                 |

---

## Vérification du 28/07/2026 — colonne par colonne (lot 10)

La consigne du plan de montage était double : retirer la référence morte à
`coach_reviews`, puis **vérifier table par table**.

**La première moitié était déjà faite.** La fonction en production porte la
correction depuis `20260719155347_coach_testimonials_replace_reviews` — elle
supprime bien dans `coach_testimonials`, avec le commentaire qui l'explique.
L'audit décrivait un état antérieur.

**La seconde est faite ici, au niveau de la colonne** et non de la table. Un
premier essai comparait des noms de tables : `registrations` ressortait
« couverte » parce que `event_registrations` apparaît dans la fonction — faux
positif silencieux, sur la table la plus sensible du lot. La requête corrigée
exige que la même instruction cite la table **et** la colonne. Elle se rejoue :
`supabase/verifications/couverture_purge.sql`.

**88 couples (table, colonne) référencent `public.users`. 60 couverts, 28 non.**

> **CORRIGÉ le 28/07/2026.** Le vingt-huitième — `coach_payout_details` — est
> entré dans la purge : migration `20260728161513_l10_purge_coach_payout_details.sql`,
> appliquée sur accord du fondateur. La couverture est passée à **60 / 27**, et
> les 27 restants sont tous justifiés ci-dessus.

Sur ces 28, cette matrice en justifiait déjà 27 — rétention comptable de dix
ans, colonnes d'acteur administratif conservées, capitanat d'équipe. Ce sont des
décisions écrites, pas des oublis. La vérification les confirme une par une.

### Le vingt-huitième

| Table | Colonnes | Constat |
|---|---|---|
| `coach_payout_details` | `coach_id`, `iban`, `bic`, `account_holder` | **PURGÉE depuis le 28/07/2026.** Elle était absente de la fonction ET de cette matrice. Un coach qui exerce son droit à l'effacement laisse ses coordonnées bancaires complètes. Aucune rétention ne le justifie : ce n'est pas une pièce comptable, c'est un moyen de versement. 0 ligne aujourd'hui, aucun coach en base — le défaut est réel et pas encore exercé. |

Appliquée : `supabase/migrations/20260728161513_l10_purge_coach_payout_details.sql`.

### Les copies de sauvegarde : cinq, pas deux

Cette matrice en citait deux. Il y en a cinq, dont `_backup_payments_20260719`
qui n'était pas listée.

| Table | Lignes |
|---|---|
| `_backup_sessions_20260719` | 44 |
| `_backup_weather_20260719` | 14 |
| `_backup_registrations_20260719` | 5 |
| `_backup_payments_20260719` | 2 |
| `_backup_session_feedback_20260719` | 0 |

**Ce n'est pas une exposition.** Vérifié : aucune n'accorde `SELECT` à `anon` ni
à `authenticated`. Le GRANT est absent, donc PostgREST ne les sert pas — que la
RLS soit active ou non, et quatre l'ont désactivée. Seul `service_role` y accède.

C'est un défaut d'**effacement** : un compte purgé survit dans ces copies.
Décision fondateur, comme prévu par la ligne d'origine de cette matrice. Les deux
issues sont chiffrées dans `supabase/migrations/PROPOSITION_L10_purge_completude.sql`.

### Ce qui n'est pas prouvé

La vérification est textuelle. Elle établit qu'une colonne est citée dans une
instruction qui vise sa table ; elle ne prouve pas que le prédicat est juste.

La preuve complète est celle que demande le plan — créer un compte, produire de
la donnée partout, purger, vérifier qu'il ne reste rien. Elle ne peut pas tourner
en production : il faut une branche Supabase, qui se facture. Non faite.
