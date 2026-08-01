# Le travail côté site — état complet au 1er août 2026

> Document unique, à jour, vérifié en production le jour même. Il **remplace**
> `docs/PROMPT_SITE.md` (périmé) et complète le `PROMPT_REPRISE.md` rédigé côté
> site le 31/07.
>
> Chaque fait porte la mention de ce qui a été mesuré et de ce qui ne l'a pas
> été. Trois de mes constats du 29/07 étaient faux, et un quatrième l'était
> encore ce matin : la discipline n'est pas une politesse, c'est ce qui manquait.

---

## CE QUI A CHANGÉ AUJOURD'HUI — À LIRE EN PREMIER

### D-01 n'est plus bloquant. Il n'y a jamais eu de perte.

Le dossier de reprise en faisait **le préalable à tout** : `sessions` porte une
ligne alors qu'une sauvegarde du 19/07 en portait quarante-quatre.

**Mesuré** : les deux ensembles sont **totalement disjoints**. Aucune des 44
lignes n'existe dans la table vivante ; l'unique ligne vivante (24/12/2026)
n'existe pas dans la sauvegarde. La sauvegarde couvre un calendrier entier, du
05/05/2026 au 06/04/2027.

**Réponse du fondateur** : aucune journée n'est validée. Il attend la
confirmation du calendrier par le circuit et ajoutera chaque session par le
compte admin.

Ce qui ressemblait à une suppression accidentelle était un état normal, mal
interprété de l'extérieur. **Les cinq tables `_backup_*` sont conservées.**

Ce qui reste vrai : aucun écran de calendrier ni de réservation ne peut être
validé sur des données réelles avant que le circuit confirme les dates. Ce n'est
plus un incident à élucider, c'est une dépendance externe à attendre.

### La page de partage est BEAUCOUP plus simple que je ne l'ai écrit

Mon prompt du 29/07 affirmait qu'elle « ne peut pas être bâtie telle quelle »,
faute d'une policy lisant par jeton. C'était vrai des policies, et faux du
problème.

**Trois fonctions `security definer` existent déjà en production**, et sont
accordées à `anon` :

```
share_public_view(p_token text)            → jsonb     ← celle à utiliser
get_shared_progression(p_token text)       → table
get_shared_progression_values(p_token text)→ table
```

J'avais lu les policies sans regarder la couche suivante. **Il n'y a aucune
migration à écrire pour cette page.**

---

## CHANTIER 1 — LA PAGE DE PARTAGE `/share/<jeton>`

**Ce qui manque : la page. Rien d'autre.** Vérifié : zéro occurrence de `/share`
dans `index.html`.

### L'appel, et il suffit

Avec la clé **anon**, via PostgREST :

```
POST /rest/v1/rpc/share_public_view
{ "p_token": "<le jeton de l'URL>" }
```

### Ce que la fonction fait déjà pour vous

Elle **valide** : longueur du jeton entre 16 et 128 caractères, non révoqué, non
expiré. Elle **filtre** sur `included_metrics` — seules les métriques cochées par
le pilote sont calculées. Elle **compte** la consultation (`view_count`,
`last_viewed_at`). Elle **ne rend jamais** `user_id`, ni la ligne de partage,
ni la moindre donnée d'un autre pilote.

### Les deux formes de réponse

**Lien inactif** — jeton inconnu, révoqué, expiré, ou mal formé :

```json
{ "status": "inactive" }
```

Une seule forme pour tous les cas, délibérément : distinguer « expiré » de
« inconnu » dirait à un curieux qu'un jeton a existé.

**Lien actif** :

```json
{
  "status": "active",
  "scope": "last_5_sessions",
  "metrics": { "best_lap": …, "lap_count": …, "regularity": …, "progression": …, "signature": null },
  "session_count": 3,
  "expires_at": "2026-08-15T…"
}
```

`metrics` ne contient **que** les clés demandées. Une clé présente à `null` est
une mesure impossible, pas un zéro : elle s'affiche « — ».

`signature` rend toujours `null` aujourd'hui — la fonction ne la calcule pas
encore. Ne l'affichez pas.

### Les trois règles de la page

1. **N'afficher que les métriques présentes.** Le pilote a coché ce qu'il
   acceptait de montrer ; une métrique absente n'existe pas pour cette page.
2. **Refuser sans culpabiliser.** « Ce lien n'est plus actif. » Pas de « expiré
   depuis 12 jours », pas de bouton pour en redemander un.
3. **Aucune donnée d'un autre pilote.** Pas de comparaison, pas de moyenne de
   plateau, pas de rang. La page montre une personne.

### Cas de test tout trouvé

L'unique lien en base porte la portée `last_5_sessions`, **une seule** métrique
(`regularity`), 0 consultation, et il est **expiré depuis le 14/07/2026**. Il
doit donc rendre `{"status":"inactive"}` — parfait pour vérifier le refus avant
d'avoir un lien vivant.

---

## CHANTIER 2 — LA RÉÉCRITURE SPA (le préalable technique)

**Constat du 31/07, côté site** : la réécriture Vercel ne s'applique pas. Toutes
les routes profondes rendent un 404 réel, à tout le monde. Le sitemap déclare 35
chemins ; 34 tombent.

Un correctif est committé (`vercel.json`, `source: "/:path*"`) et **non vérifié
en déploiement**.

**C'est le préalable de presque tout le reste** : la page de partage, l'espace
compte, le tunnel de réservation vivent tous sur des routes profondes.

**Signal attendu par l'application** : que `https://www.oxvehicle.fr/compte-sessions`
réponde 200. Prévenez-nous — deux liens de l'app en dépendent (voir chantier 5).

---

## CHANTIER 3 — LA CLÉ PUBLIÉE EN CLAIR

`membre-fondateur.html`, servi publiquement, embarque `OXV_FORM_TOKEN` dans son
JavaScript. C'est la seule protection de l'edge function
`capture-membre-fondateur` (`verify_jwt: false`, CORS `*`), qui à chaque appel
insère en base, **envoie un courriel depuis `contact@oxvehicle.fr` vers une
adresse arbitraire**, et **active une demande de signature Yousign facturée**.

Le risque dominant est la **réputation d'expédition du domaine** : elle porte
tous les courriels transactionnels d'OXV.

Proposition rédigée côté site dans `docs/site/PR_SECURITE_FORMULAIRE_FONDATEUR.md`,
non appliquée. **Piège à connaître** : supprimer la variable ne suffit pas, la
fonction ignore le contrôle si elle est absente.

---

## CHANTIER 4 — LE TUNNEL DE RÉSERVATION

Partage des rôles décidé : **l'application constitue le dossier, le site
encaisse.** Le pilote doit retrouver sa demande déjà rédigée en se connectant,
sans rien ressaisir.

Quatre manques :

1. Retrouver, à la connexion, une demande rédigée dans l'application.
2. Une **URL de paiement stable** pour une demande donnée, que l'application
   puisse ouvrir directement. Aujourd'hui elle mène à l'espace compte —
   pis-aller assumé.
3. **Les transitions autorisées côté site.** L'énumération
   `registration_status_enum` vaut exactement, revérifié le 01/08 :
   `pending · confirmed · cancelled · attended · no_show · pending_payment`.
   Une seule inscription en base, en `pending`.
4. **La règle de propriété** : le dossier appartient à l'application tant qu'il
   n'est pas payé, au site une fois payé.

---

## CHANTIER 5 — CE QUE L'APPLICATION ATTEND DE VOUS

L'application pose exactement **deux** liens vers une route profonde du site.
Les deux tombent aujourd'hui (D-22 côté app) :

| Lien | Posé par | Ce que voit le pilote |
|---|---|---|
| `www.oxvehicle.fr/compte-sessions` | `src/features/club/passLogic.ts:143` | Il touche « réserver une journée », son navigateur s'ouvre sur un 404 |
| `oxvehicle.fr/share/<jeton>` | `src/services/sharesService.ts:58` | Tout lien de partage produit par l'application est mort |

**Nous ne changeons rien, délibérément.** Ce sont les bonnes destinations ; les
rebrancher sur la racine dégraderait durablement le parcours et serait à défaire.

**Dégât réel à ce jour : nul.** L'unique lien de partage est expiré.

---

## CE QUI EST CLOS — NE PAS ROUVRIR

**`app.oxvehicle.fr` ne sera pas créé.** Le sous-domaine ne résout pas et n'a
jamais existé. L'application a été corrigée le 31/07 : la WebView est retirée, la
vraie vue in-lens était déjà native. Aucune action côté site. Voir
`docs/REPONSE_CONSTAT_AR_VIEW.md`.

**Vérifié au passage** : sur les onze hôtes que l'application appelle, c'était le
seul mort. Les dix autres résolvent.

---

## CE QU'IL NE FAUT PAS FAIRE

- **Aucune migration destructive.** Pas de `DROP`, pas de `TRUNCATE`, pas de
  `DELETE` massif sans accord explicite. Et depuis aujourd'hui, une règle de
  plus : **avant tout `drop table`, balayer `pg_get_functiondef`** — la
  suppression de `duels` a cassé `purge_user_data`, qui la référençait. plpgsql
  ne vérifie pas les tables à la création d'une fonction : la panne n'éclate qu'à
  l'exécution.
- Ne touchez pas aux tables `telemetry_*` ni `app_*` (sauf la lecture du
  chantier 1, qui passe par la fonction).
- **N'écrivez pas dans `users.role`** : il commande l'accès d'un coach aux
  données d'un pilote.
- N'exposez jamais la clé `service_role` au navigateur.
- N'inventez aucune valeur pour combler un vide. « — » est une réponse
  acceptable ; un chiffre faux ne l'est pas.
- N'ajoutez ni classement, ni palmarès, ni « meilleur pilote du mois ».
- Ne développez aucun récit propre à un circuit hors de sa page dédiée : OXV est
  multi-circuit.

---

## LE TON

Vaut pour toute phrase lue par un pilote — page, courriel, notification.
Vouvoiement systématique. Aucun emoji. Phrases courtes, sans marketing creux.
**Aucune instruction de pilotage** : jamais « freinez », « il faut », « vous
devriez ». **Aucun classement entre pilotes.** Le mot « marge », jamais
« limite ». **Aucun reproche d'absence**, y compris en relance.

---

## L'ÉTAT RÉEL, MESURÉ LE 01/08/2026

| | |
|---|---|
| Comptes | 14 |
| Journées au calendrier | 1 (aucune validée) |
| Inscriptions | 1, en `pending` |
| Comptes coach | **0** |
| Liens de partage | 1, expiré |
| Captures de télémétrie | 18 |

**Rien n'a jamais tourné en conditions réelles.** Toute affirmation sur le
comportement du produit est une lecture de code, jamais une observation. Écrivez
les vôtres au même régime — et dites ce que vous n'avez pas pu vérifier.

---

## COMMENT VÉRIFIER

1. **La page répond-elle vraiment ?** Interrogez l'URL exacte, pas un clic depuis
   le menu. Attention : dans certains environnements, le proxy sortant refuse
   `oxvehicle.fr` — un échec de connexion n'est pas un 404.
2. **La page de partage montre-t-elle uniquement les métriques cochées ?**
   Fabriquez un lien avec une seule métrique et vérifiez que rien d'autre
   n'apparaît.
3. **Un lien expiré est-il refusé ?** Le lien en base l'est déjà : utilisez-le.
4. **Le texte respecte-t-il le ton ?** Relisez chaque phrase nouvelle.
5. **Avant tout `drop`** : balayez les fonctions.
