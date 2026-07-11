# OXV — Cartographie fonctionnelle (dossier de synthèse)

Généré le 2026-07-07 par analyse du code réel de l'app OXV Mirror.

## Contenu

| Fichier | Ce que c'est |
|---|---|
| **`1_Cartographie_fonctionnelle.md`** | Le document complet : **toutes les fonctionnalités par rôle** (pilote 53 · coach 25 · partenaire 9 · admin 22), avec pour chacune son **écran**, sa **table Supabase**, son **objectif** et son **lien inter-rôle**. Sections dédiées aux **connexions inter-rôles**, à l'**architecture Supabase** et à la **liaison au site oxvehicle.fr**. |
| **`2_Schema_connexions_roles_supabase_site.svg`** | Le **schéma visuel** des connexions : les 4 rôles, leurs tables pivots (avec consentement + RLS), le projet Supabase partagé, et la synchronisation avec le site. Ouvrir dans un navigateur ou un éditeur d'images. |

## En une phrase

OXV est une plateforme **mono-rôle** (`pilote / coach / partenaire / admin`) où les rôles
se relient par des **tables pivots** avec **consentement RGPD** et **RLS stricte**, sur un
**projet Supabase unique partagé avec le site oxvehicle.fr** — doctrine commune : le
miroir décrit, ne dirige pas ; aucun classement, progression personnelle uniquement.
