# Base partagée site ↔ application — document de raccordement

**26 juillet 2026** · rédigé depuis le dépôt de l'application (`oxv-app`)
**Destinataire : la discussion qui tient le site `oxvehicle.fr`.**

---

## Pourquoi ce document

Le site et l'application n'ont pas chacun leur base. Ils écrivent dans **le même
projet Supabase**, avec les mêmes tables, les mêmes policies et le même historique
de migrations. Ce n'est pas un problème en soi — c'est même ce qui permet qu'un
pilote inscrit sur le site retrouve sa place dans l'application. Mais cela cesse
d'être tenable dès que les deux côtés ignorent ce que l'autre a fait.

C'est aujourd'hui le cas. Ce document dit exactement où on en est, ce que le côté
application vient de corriger, et ce qu'il demande au côté site.

---

## Le projet, en une fiche

| | |
|---|---|
| Projet Supabase | `fouvuqkdxarjpjbqnsjq` |
| Région | `eu-west-1` — Irlande, Union européenne |
| Moteur | PostgreSQL 17 |
| Tables dans `public` | 114 |
| Migrations appliquées | 215 |
| Fonctions edge déployées | 34 |
| Tâches planifiées (`cron.job`) | 8, toutes actives |

La région importe : toute la documentation RGPD de l'application affirme un
hébergement dans l'Union. C'est vérifié et exact. Si le site publie une mention
différente (Francfort, par exemple, qui traîne dans d'anciens documents), c'est le
site qui doit être corrigé, pas la base.

---

## Le fait central : l'historique était incomplet des deux côtés

En interrogeant `supabase_migrations.schema_migrations`, on a constaté ceci :

- **215 migrations sont appliquées** en production ;
- **121 seulement existaient** dans le dépôt de l'application ;
- **94 n'existaient nulle part** sous forme de fichier de ce côté-ci.

Autrement dit, près de la moitié de l'histoire de la base n'était écrite dans
aucun dépôt consultable depuis l'application. Elle ne survivait que dans la base
elle-même.

Deux causes, distinctes, et qui appellent des réponses différentes :

**1. Les migrations appliquées depuis le site.** Elles sont dans votre dépôt, pas
dans le nôtre. C'est normal et attendu ; il fallait seulement que nous sachions
qu'elles existent.

**2. Les migrations appliquées directement sur la base, sans passer par un
fichier.** L'outillage permet d'exécuter du DDL en production sans jamais écrire
le `.sql` correspondant. La base enregistre alors la migration, mais aucun dépôt
n'en garde trace. Cette cause-là nous concerne aussi, et probablement vous.

La colonne `created_by` ne permet pas de départager : **les 188 migrations
horodatées portent toutes le même compte** (`administration@oxvehicle.fr`), et les
27 plus anciennes n'ont pas d'auteur du tout. L'origine ne peut donc se lire qu'au
contenu. C'est une limite réelle de ce document : la répartition proposée plus bas
est une lecture de domaine, pas une preuve.

### Ce qui a été fait de notre côté

Le SQL réellement exécuté est conservé dans la colonne `statements` de
`schema_migrations`. Nous l'avons extrait et **reconstitué les 94 fichiers
manquants**, chacun sous le numéro de version exact qui figure en base.

Deux conséquences pratiques :

- le dépôt de l'application raconte désormais l'histoire complète de la base ;
- comme les numéros de version correspondent à ceux enregistrés, un futur
  `supabase db push` reconnaîtra ces migrations comme déjà appliquées au lieu de
  vouloir les rejouer.

Un fichier fait foi : **`supabase/migrations/APPLIQUEES_EN_PRODUCTION.txt`**. Il
liste `version|nom` pour les 215, et se régénère en une requête :

```sql
select string_agg(version || '|' || coalesce(name,'(sans nom)'), E'\n' order by version)
from supabase_migrations.schema_migrations;
```

Les fichiers reconstitués portent un en-tête qui le dit franchement : le SQL est
celui qui a tourné, mais la mise en forme d'origine et les commentaires hors
instruction sont perdus. Ce sont des témoins fidèles sur le fond, pas les
originaux.

---

## Partage du terrain — proposition, à confirmer par vous

Lecture par domaine des 114 tables. **Rien ici n'est établi : c'est ce que nous
croyons comprendre, et nous vous demandons de le corriger.**

**Vraisemblablement au site** — commerce, inscriptions, éditorial, relation client :
`registrations`, `payments`, `invoices`, `invoice_counters`, `pricing`,
`heritage_packs`, `subscriptions`, `demandes_inscription`, `founder_applications`,
`founding_members`, `eligibility_items`, `corporate_leads`, `partner_leads`,
`contact_messages`, `support_tickets`, `support_messages`, `email_log`,
`email_templates`, `resend_events`, `ritual_dispatches`, `articles`, `documents`,
`lodgings`, `restaurants`, `partners`, `partner_accounts`, `partner_offers`,
`pavillon_photos`, `events`, `event_registrations`, `event_partners`,
`b2b_event_reports`, `crews`, `crew_members`, `session_feedback`.

**Vraisemblablement à l'application** — capture, télémétrie, lecture, coaching :
`telemetry_frames`, `telemetry_sessions`, `laps`, `session_insights`,
`app_session_analyses`, `app_segment_analyses`, `app_progression_shares`,
`session_intentions`, `session_media`, `biometry_raw`, `devices`,
`device_assignments`, `device_health_logs`, `media_exports`, `video_overlays`,
`weather_snapshots`, `vehicle_setups`, `vehicles`, `incident_reports`, `convoys`,
`convoy_participants`, `scenic_routes`, `app_pairing_codes`, `app_feature_flags`,
`app_config`, `data_quality_reports`, l'ensemble des `coach_*`, l'ensemble des
`pilot_*`, `duels`, `moderation_*`, `social_pings`, `ping_rsvps`.

**Partagées, et c'est là que ça se joue :** `users`, `sessions`, `circuits`,
`media`, `app_settings`, `admin_audit`.

### Trois pièges dans les tables partagées

**`users.role` et `users.is_admin` sont deux systèmes distincts.** L'application
garde l'espace administrateur derrière `is_admin`, pas derrière `role`. En
production, les deux comptes `role = 'admin'` ont `is_admin = false` : ils
n'atteignent donc pas l'espace admin de l'application. Si le site attribue des
rôles, il faut savoir lequel des deux champs fait autorité, et pour qui. **Cette
question n'est pas tranchée et mérite de l'être.**

**`sessions` et `telemetry_sessions` ne sont pas la même chose.** La première est
la séance au calendrier — une journée de roulage à laquelle on s'inscrit. La
seconde est une capture de télémétrie. Le rapprochement des deux n'est pas trivial,
et une migration récente côté application a **refusé de le deviner** plutôt que de
poser un lien faux. Si le site connaît la règle de correspondance, elle nous
intéresse directement.

**`circuits` est écrit des deux côtés.** L'application y ajoute des tracés, des
lignes d'arrivée et des virages détectés. Une modification côté site sur ces
colonnes casserait la détection de tours.

---

## Les cinq règles qu'on propose d'adopter

**1. Aucun DDL sans fichier.** Toute modification de schéma passe par un fichier de
migration versionné dans le dépôt qui la porte. C'est la règle qui, à elle seule,
aurait évité tout ce document.

**2. Préfixer les migrations par leur origine.** Par exemple `site_` et `app_` dans
le nom. Cela vaut mieux que de deviner au contenu six mois plus tard.

**3. Jamais de `supabase db reset`, jamais de `db push --force` sur ce projet.**
Aucun des deux dépôts ne contient à lui seul de quoi reconstruire la base. Un reset
détruirait la moitié du travail de l'autre.

**4. Prévenir avant de toucher aux tables partagées** — `users`, `sessions`,
`circuits` — et aux policies qui les gardent.

**5. Le registre fait foi.** En cas de doute sur ce qui est appliqué, la réponse
est dans `schema_migrations`, pas dans un dépôt.

---

## Ce que nous vous demandons, concrètement

**1. Le code de deux fonctions edge.** Elles sont **déployées et actives en
production** mais n'existent dans aucun code de notre côté :

- `capture-membre-fondateur` (version 7, `verify_jwt: false`)
- `yousign-webhook` (version 6, `verify_jwt: false`)

Toutes deux déployées le 24 juillet 2026. Les deux acceptent des requêtes **sans
vérification de jeton** — ce qui est normal pour un webhook, à condition qu'elles
vérifient une signature en interne. `yousign-webhook` touche la signature
électronique, donc les décharges de responsabilité des pilotes : c'est un sujet
sensible côté application aussi. **Confirmez-nous qu'elles sont bien à vous, et
partagez leur source.** Si elles ne sont pas à vous, il faut le savoir vite : deux
points d'entrée non authentifiés sans propriétaire identifié, ce n'est pas
acceptable en production.

**2. La liste de vos migrations.** Comparez `APPLIQUEES_EN_PRODUCTION.txt` à votre
dossier. Dites-nous lesquelles des 215 sont les vôtres. Cela permettra de
transformer la répartition proposée plus haut en répartition établie.

**3. Un mot sur cinq tables de sauvegarde.** `_backup_payments_20260719`,
`_backup_registrations_20260719`, `_backup_session_feedback_20260719`,
`_backup_sessions_20260719`, `_backup_weather_20260719`. Elles datent des travaux
de sécurité du 19 juillet et portent sur des tables qui semblent relever du site.
Si elles ont fait leur office, elles occupent de la place et copient de la donnée
personnelle hors du dispositif de purge. **Nous ne les supprimerons pas : elles ne
sont pas à nous.** À vous de dire.

**4. La règle qui relie `sessions` et `telemetry_sessions`,** si elle existe.

**5. Qui fait autorité sur `users.role` et `users.is_admin`.**

---

## Ce que ce document ne dit pas

Par honnêteté, les angles morts :

- **L'origine réelle de chaque migration n'est pas prouvée**, seulement supposée
  d'après son contenu. `created_by` ne distingue pas les deux côtés.
- **Quatre fichiers de notre dépôt n'ont aucune migration appliquée à leur nom.**
  Une vérification de leur contenu contre l'état réel de la base est en cours. Tant
  qu'elle n'a pas rendu son verdict, **personne ne doit les appliquer** : deux
  d'entre eux redéfinissent des vues sur `sessions`, et les appliquer aujourd'hui
  pourrait écraser un état plus récent posé depuis.
- **Rien n'a été observé en fonctionnement.** Ce document est une lecture de la
  base et des dépôts, pas un test.
- **Le sens métier des tables du site nous échappe en partie.** Nous décrivons ce
  que le schéma montre, pas ce que le produit veut dire.

---

## Pour retrouver ce document

Côté application : `docs/architecture/09_HANDOFF_SITE_BASE_PARTAGEE.md`.
Le registre : `supabase/migrations/APPLIQUEES_EN_PRODUCTION.txt`.
Les règles du dossier de migrations : `supabase/migrations/README.md`.
