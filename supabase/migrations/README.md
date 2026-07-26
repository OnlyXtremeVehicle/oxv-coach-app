# Migrations — comment lire ce dossier

Ce dossier ne se comporte pas comme un dossier de migrations ordinaire, et il faut
le savoir avant d'y toucher.

---

## Le fait qui explique tout le reste

**L'application et le site `oxvehicle.fr` écrivent dans la même base.** Un seul
projet Supabase — `fouvuqkdxarjpjbqnsjq`, région `eu-west-1` (Irlande) — deux
dépôts, deux équipes, un seul historique de migrations.

Ce dossier n'a donc jamais contenu toute l'histoire de la base, et ne peut pas la
contenir seul. Le 26 juillet 2026, l'écart était le suivant :

| | |
|---|---|
| Migrations appliquées en production | 215 |
| Fichiers présents ici | 121 |
| **Absents de tout dépôt consultable ici** | **94** |

Deux causes, distinctes :

1. **Les migrations appliquées depuis le site.** Elles vivent dans l'autre dépôt.
2. **Les migrations appliquées directement sur la base**, sans qu'aucun fichier ne
   soit écrit. L'outillage le permet ; la base enregistre la migration, aucun
   dépôt n'en garde trace.

## Ce qui a été fait

Le SQL réellement exécuté est conservé dans la colonne `statements` de
`supabase_migrations.schema_migrations`. Les 94 fichiers absents en ont été
extraits et réécrits ici, chacun sous **le numéro de version exact enregistré en
base**.

Ces fichiers portent un en-tête qui le dit franchement. Ils sont fidèles sur le
fond — c'est le SQL qui a tourné — mais la mise en forme d'origine et les
commentaires hors instruction sont perdus. Ce sont des témoins, pas les originaux.

Par ailleurs, 57 fichiers déjà présents portaient un horodatage différent de celui
sous lequel ils ont été appliqués. Ils ont été renommés sur la version réelle.
C'est ce qui permet à un futur `supabase db push` de les reconnaître comme
appliqués au lieu de vouloir les rejouer.

---

## Le registre fait foi

**`APPLIQUEES_EN_PRODUCTION.txt`** liste `version|nom` pour les 215 migrations
appliquées. En cas de doute sur ce qui est réellement passé en base, c'est lui la
réponse — pas ce dossier, pas votre mémoire.

Il se régénère en une requête :

```sql
select string_agg(version || '|' || coalesce(name,'(sans nom)'), E'\n' order by version)
from supabase_migrations.schema_migrations;
```

---

## Les cinq règles

**1. Aucun DDL sans fichier.** Toute modification de schéma passe par un fichier
versionné ici. C'est la règle qui, à elle seule, aurait évité les 94 disparitions.

**2. Jamais de `supabase db reset` sur ce projet.** Ni de `db push --force`.
Aucun des deux dépôts ne contient à lui seul de quoi reconstruire la base.

**3. Vérifier le registre avant tout `db push`.** Y compris après ce nettoyage :
`created_by` porte le même compte pour les 188 migrations horodatées, l'origine
d'une migration ne se lit donc qu'à son contenu, et rien ne garantit que le site
n'ait pas appliqué quelque chose depuis le dernier relevé.

**4. Prévenir le site avant de toucher aux tables partagées** — `users`,
`sessions`, `circuits`, `media`, `app_settings`, `admin_audit`.

**5. Ce qui ne doit pas être appliqué ne reste pas ici.** Voir
`../migrations_hors_historique/`.

---

## `../migrations_hors_historique/` — à lire avant d'y remettre quoi que ce soit

Quatre fichiers en ont été sortis le 26 juillet 2026. Tous portaient du travail
déjà passé en base sous un autre nom. **Trois d'entre eux dégraderaient la
production s'ils étaient rejoués** — dont un qui écraserait silencieusement la
fonction de purge RGPD et ne casserait qu'au premier droit à l'effacement exercé.

Le détail, vérifié objet par objet contre le schéma vivant, est dans le README de
ce dossier. La leçon tient en une phrase : **un commentaire rassurant en tête de
fichier ne protège pas une base de production ; seule la place du fichier le
fait.**

---

## Pour le site

Le document de raccordement destiné à l'équipe du site est
`docs/architecture/09_HANDOFF_SITE_BASE_PARTAGEE.md`. Il détaille la répartition
supposée des tables, les pièges des tables partagées, et ce qui est demandé au site
— notamment le code de deux fonctions edge déployées en production et absentes de
tout dépôt connu ici.
