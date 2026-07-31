# Prompt — travaux sur le site oxvehicle.fr

> ## PÉRIMÉ — NE PAS DONNER À UN AGENT
>
> **Remplacé le 31/07/2026** par `PROMPT_REPRISE.md`, rédigé côté site après
> mesure. Trois constats de ce document se sont révélés **inexacts** :
>
> 1. **La panne n'était pas celle décrite.** Ce document supposait un filtre
>    anti-robots ; la réécriture SPA de Vercel ne s'applique tout simplement
>    pas, et les routes profondes rendent un 404 **à tout le monde**.
> 2. **Le chantier « chemins de l'espace pilote » n'existait pas.** `/compte`,
>    `/compte-sessions` et les autres **sont bien** dans le routeur, avec sept
>    chemins de plus. Rien n'était mal câblé.
> 3. **Le sitemap déclare 35 chemins, pas 33.**
>
> Conservé comme trace, et parce que la cause de ces trois erreurs vaut d'être
> retenue : elles viennent toutes d'avoir conclu depuis l'extérieur, sur des
> codes de réponse, sans lire le routeur du site. Un 404 ne dit pas pourquoi.
>
> La leçon est passée dans le document de remplacement, qui impose de nommer ce
> qui n'a pas pu être vérifié.

---

> À donner tel quel à l'agent qui travaillera sur le dépôt du site. Il est
> autonome : il ne suppose aucune connaissance de l'application ni de cette
> conversation.
>
> Établi le 29 juillet 2026, à partir d'un relevé du site **en production** et
> d'un interrogatoire de la base **en production**. Les faits datés peuvent
> avoir changé : vérifiez-les avant d'agir, le prompt vous dit lesquels.

---

## QUI VOUS ÊTES, ET SUR QUOI VOUS TRAVAILLEZ

Vous travaillez sur **oxvehicle.fr**, le site d'OXV (Only Xtreme Vehicle) —
plateforme premium de journées de circuit en France, au Circuit de Haute
Saintonge. Le site est en ligne, complet côté vitrine : offres (Access 390 €,
Signature 690 €, Heritage 2 490 €), calendrier, espace pilote, espace
administrateur, actualités, mentions légales.

Il existe **une application mobile compagnon**, OXV Mirror, développée dans un
dépôt séparé. Elle est annoncée pour le printemps 2027 sur la page d'accueil.

**Le site et l'application partagent UNE SEULE base Supabase**, projet
`fouvuqkdxarjpjbqnsjq`, région `eu-west-1`. C'est le fait le plus important de
ce document : tout ce que vous écrivez, l'application le lit.

---

## LES QUATRE RÈGLES QUI NE SE DISCUTENT PAS

### 1. Aucune migration destructive. Aucune.

Pas de `DROP`, pas de `TRUNCATE`, pas de `DELETE` massif — **tant que le point
D-01 ci-dessous n'est pas tranché**.

La table `sessions` (les journées de circuit) porte **une seule ligne** en
production, alors qu'une sauvegarde antérieure en portait **quarante-quatre**.
Une opération s'est mal passée et personne n'a encore établi laquelle. Il ne
faut pas en ajouter une seconde.

Si une tâche semble exiger une suppression, **arrêtez-vous et demandez.**

### 2. Le partage des tables

| Table | Propriétaire | La règle |
|---|---|---|
| `sessions` — les journées | **site** | l'application lit seulement |
| `registrations` — les inscriptions | **site** | l'application transitionne et crée |
| `users` | **partagé** | champ par champ — voir plus bas |
| `telemetry_*` | **application** | le site n'y touche pas |
| `app_*` | **application** | le site n'y touche **pas**, sauf la lecture décrite au chantier 1 |

Sur `users`, deux champs sont sensibles :

- **`role`** commande l'accès d'un coach aux données d'un pilote, via la
  fonction `is_coach_of()`. Une écriture fautive ouvre les données d'un pilote à
  quelqu'un qui ne devrait pas les voir. **N'y touchez pas sans accord
  explicite.**
- **`timezone`** est écrit par l'application depuis le 29/07/2026 (le fuseau du
  téléphone du pilote, réécrit s'il voyage). Si le site doit aussi l'écrire, il
  faut d'abord décider qui l'emporte.

### 3. Le ton OXV

Il vaut pour **toute** phrase lue par un pilote — page, courriel, notification.

- **Vouvoiement systématique.** Clientèle premium.
- **Aucun emoji.**
- **Phrases courtes.** Style sec, sans marketing creux.
- **Aucune instruction de pilotage.** Jamais « freinez », « accélérez »,
  « il faut », « vous devriez ». L'application est un miroir : elle montre, elle
  ne dirige pas. Le site ne dit rien d'autre.
- **Aucun classement entre pilotes, aucun vainqueur, aucun rang.**
- Le mot **« marge »**, jamais « limite ».
- **Aucun reproche d'absence** : « vous n'avez pas roulé depuis trois mois » et
  ses variantes sont proscrites, y compris dans un courriel de relance.

### 4. Ce qui n'est pas mesuré ne s'affiche pas

Une donnée absente s'écrit « — ». **Jamais zéro, jamais une valeur de
remplacement, jamais une progression simulée.** Si vous ne pouvez pas afficher
une valeur honnêtement, affichez son absence et dites pourquoi.

---

## CHANTIER 1 — LA PAGE DE PARTAGE (priorité absolue)

### Ce que c'est

Un pilote peut créer, depuis l'application, un lien public vers une vue de ses
données. Le lien a la forme :

```
https://oxvehicle.fr/share/<jeton>
```

**Cette page n'existe pas** — ou du moins elle a répondu 404 le 29/07/2026.
Confirmez-le d'abord (voir « Ce qu'il faut vérifier » plus bas) : le site
pourrait être une application monopage dont les routes profondes répondent 404
aux robots tout en s'affichant dans un navigateur.

C'est la page la plus urgente : **l'application crée déjà ces liens, et un
pilote les envoie à qui il veut.** Si la page manque, chaque partage est un lien
mort adressé à un tiers.

### Le contrat de données

Table `app_progression_shares` :

| Colonne | Type | Sens |
|---|---|---|
| `share_token` | `text` | le jeton de l'URL, 32 caractères base64url |
| `share_scope` | `text` | `last_session` · `last_5_sessions` · `progression_only` · `full_history` |
| `included_metrics` | `jsonb` | **liste blanche** des métriques autorisées |
| `expires_at` | `timestamptz` | après cette date, le lien ne répond plus |
| `revoked_at` | `timestamptz` | non nul = révoqué, immédiatement |
| `view_count` | `integer` | compteur de consultations |
| `last_viewed_at` | `timestamptz` | dernière consultation |

Les cinq valeurs possibles d'`included_metrics` sont exactement :
`best_lap` · `regularity` · `progression` · `lap_count` · `signature`.

### Les trois règles de cette page

1. **N'afficher QUE les métriques listées dans `included_metrics`.** Rien de
   plus, jamais. Le pilote a coché ce qu'il acceptait de montrer ; une métrique
   non cochée n'existe pas pour cette page.
2. **Refuser un lien expiré ou révoqué.** `expires_at` dans le passé, ou
   `revoked_at` non nul → la page dit que le lien n'est plus actif, et ne montre
   aucune donnée. Pas de message culpabilisant, pas de suggestion de contacter
   le pilote.
3. **Aucune donnée d'un autre pilote, jamais.** Pas de comparaison, pas de
   moyenne du plateau, pas de rang. La page montre une personne.

### Le blocage technique à résoudre AVANT de coder

**Vérifié le 29/07/2026 :** les cinq policies RLS de `app_progression_shares`
sont toutes réservées au rôle `authenticated`, et **aucune ne permet la lecture
par jeton**. Un visiteur anonyme ne peut donc rien lire.

La page ne peut pas être bâtie avec la clé publique en l'état. Trois voies :

- **Recommandée — une fonction `security definer`** qui prend le jeton et
  retourne **uniquement** les métriques autorisées, déjà filtrées, avec
  vérification de l'expiration et de la révocation à l'intérieur. Elle ne
  retourne jamais la ligne, jamais `user_id`. C'est le motif déjà employé
  ailleurs dans cette base (`crews_public_rows()`).
- Une route serveur du site utilisant la clé `service_role`. **La clé ne doit
  jamais atteindre le navigateur.**
- Une policy `anon` filtrant sur le jeton. **Déconseillée** : elle expose la
  table à qui devine un jeton, et rend l'énumération possible si la génération
  faiblit un jour.

**Toute création de fonction ou de policy est un changement de schéma sur une
base de production partagée : elle demande l'accord explicite du fondateur avant
d'être appliquée.** Écrivez la migration, faites-la relire, ne l'exécutez pas de
votre propre chef.

---

## CHANTIER 2 — LE SOUS-DOMAINE `app.oxvehicle.fr`

**Vérifié, sans ambiguïté** : `app.oxvehicle.fr` ne résout pas au niveau DNS.
Le sous-domaine n'existe pas.

L'application charge `app.oxvehicle.fr/ar-view` dans une vue web — c'est
l'affichage en réalité augmentée destiné au coach. Il ne peut rien afficher
aujourd'hui.

**À trancher** : créer le sous-domaine et la page, ou servir cette vue ailleurs.
Dans le second cas, c'est l'application qu'il faut corriger, pas le site — dites-le
plutôt que de créer un sous-domaine dont personne n'a besoin.

---

## CHANTIER 3 — LES ROUTES PROFONDES ET LE SITEMAP

**Constat du 29/07/2026, à confirmer.** Le sitemap déclare 33 chemins. Deux
d'entre eux, `/calendrier` et `/booking`, ont répondu **404** à un client HTTP,
alors que la racine rend parfaitement sur les deux domaines.

Deux lectures, et il faut trancher avant de faire quoi que ce soit :

- **Le site est une application monopage sans repli serveur.** Un navigateur
  affiche la page ; les robots reçoivent un 404. Dans ce cas **le sitemap
  déclare une trentaine d'URL que les moteurs de recherche finiront par retirer
  de l'index** — et il faut ajouter une réécriture serveur qui rende 200 sur les
  routes connues.
- **Ou le client HTTP a été filtré** et tout va bien.

**Le test** : `curl -I https://www.oxvehicle.fr/calendrier`, puis la même page
dans une fenêtre de navigation privée. Si le navigateur affiche et que `curl`
rend 404, c'est la première lecture.

---

## CHANTIER 4 — LES CHEMINS DE L'ESPACE PILOTE

L'application et trois courriels envoient les pilotes vers :

```
/compte              (application)
/compte-sessions     (application + courriel de retour de journée)
/compte-documents    (courriel de rappel d'éligibilité)
/compte-preferences  (application)
```

Aucun n'est au sitemap — normal pour des pages derrière authentification, mais
**il faut confirmer que ce sont les bons chemins**.

**Ce qu'on attend de vous** : la liste exacte des chemins de l'espace pilote. Si
l'espace vit ailleurs (`/mon-compte`, `/pilote/...`), **ce sont l'application et
les courriels qu'il faudra corriger, pas le site** — signalez-le, ne créez pas
des redirections pour masquer un mauvais câblage.

Vérifiez aussi que ces trois images existent, servies dans des courriels réels :
`/email-assets/insigne-oxv.png`, `/email-assets/spotify-icon.png`,
`/email-assets/weather-<...>.png`.

---

## CHANTIER 5 — LE TUNNEL DE RÉSERVATION

Le partage des rôles est décidé : **l'application constitue le dossier, le site
encaisse.**

L'application connaît le pilote — son garage, ses documents, son éligibilité,
son numéro — et lui fait remplir sa demande en trois gestes. L'authentification
étant partagée, **il doit retrouver sa demande déjà rédigée en se connectant au
site**, sans rien ressaisir. Il paie sur le site.

Quatre choses manquent du côté site :

1. **Retrouver une demande rédigée dans l'application**, à la connexion.
2. **Une URL de paiement stable pour une demande donnée.** L'application doit
   pouvoir l'ouvrir directement. Aujourd'hui, faute de cette URL, elle mène à
   l'espace compte — un pis-aller assumé et écrit dans son code.
3. **La liste exhaustive des états de `registrations.status`** et des
   transitions autorisées côté site. L'application n'écrit `attended` que depuis
   `pending` ou `confirmed`, jamais en écrasement ; sans la liste, personne ne
   peut prouver qu'aucune collision n'est possible.
4. **La règle de propriété** : le dossier appartient à l'application tant qu'il
   n'est pas payé, au site une fois payé. Avant paiement le pilote modifie dans
   l'application ; après, il passe par le site. Cela évite qu'une modification
   arrive pendant une facturation.

---

## CE QUI PRÉCÈDE TOUT — D-01

**`sessions` porte une ligne en production. Une sauvegarde en portait
quarante-quatre.**

Le site affiche un calendrier et un tunnel de réservation ; l'application lit la
même table. **Tant que ce point n'est pas tranché, ni l'un ni l'autre n'a de
journées à proposer**, et aucun écran ne peut être validé autrement que sur du
vide.

Il faut établir : ce qui s'est passé, quand, par quelle opération, et si les 43
lignes sont récupérables depuis l'une des cinq sauvegardes existantes.

**C'est une opération de base de données, pas du code. Elle passe avant le
reste, et elle demande l'accord du fondateur.**

---

## CE QU'IL NE FAUT PAS FAIRE

- **Ne touchez pas aux tables `telemetry_*`.** Elles appartiennent à
  l'application et portent des données de conduite.
- **N'écrivez pas dans `users.role`.** Il commande un contrôle d'accès.
- **N'exposez jamais la clé `service_role` au navigateur.**
- **N'inventez aucune valeur** pour combler un vide : ni chrono, ni progression,
  ni température. « — » est une réponse acceptable ; un chiffre faux ne l'est
  pas.
- **N'ajoutez ni classement, ni palmarès, ni « meilleur pilote du mois ».** Ce
  n'est pas une préférence de style : c'est la doctrine du produit.
- **N'appliquez aucune migration de votre propre chef.** Écrivez-la, faites-la
  relire.

---

## COMMENT VÉRIFIER VOTRE TRAVAIL

Avant de dire qu'une tâche est finie :

1. **La page répond-elle vraiment ?** `curl -I` sur l'URL exacte, pas seulement
   un clic depuis le menu.
2. **La page de partage montre-t-elle uniquement les métriques cochées ?**
   Fabriquez un lien avec `included_metrics` réduit à une seule valeur et
   vérifiez que rien d'autre n'apparaît.
3. **Un lien expiré est-il refusé ?** Posez `expires_at` dans le passé sur une
   ligne de test et rechargez.
4. **Un lien révoqué est-il refusé immédiatement ?** Idem avec `revoked_at`.
5. **Le texte respecte-t-il le ton ?** Relisez chaque phrase nouvelle :
   vouvoiement, pas d'emoji, aucune instruction, aucun classement.

Et dites **ce que vous n'avez pas pu vérifier**. Un point non vérifié annoncé
comme fait coûte plus cher que le point lui-même.

---

## LE CONTEXTE QU'IL FAUT AVOIR EN TÊTE

**Rien n'a jamais tourné en conditions réelles.** Au 29/07/2026 la base porte :
14 comptes, **1 journée**, 1 inscription, **0 compte coach**, 53 trames de
télémétrie, 1 tour, 0 virage analysé, 1 lien de partage.

Toute affirmation sur le comportement réel du produit est aujourd'hui une
lecture de code, jamais une observation. Écrivez donc les vôtres au même
régime : dites ce que vous avez vérifié, et ce que vous supposez.
