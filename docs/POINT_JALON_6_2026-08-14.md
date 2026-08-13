# Point de fin de jalon — JALON 6, COACH

> 14 août 2026. Chaque ligne du plan a été **mesurée**, pas relue. C'est la
> leçon du jalon 5 : j'avais annoncé un lot de 71 écrans en attente alors que
> l'arbre était supprimé depuis des jours, parce que j'avais cru un document.

---

## En une ligne

**Le jalon 6 est fait aux trois quarts, et ce qui reste n'est pas du code.**
Neuf lignes sur quatorze sont livrées, trois attendent une commande de votre
part, deux attendent qu'un compte coach existe.

---

## L'état, ligne par ligne

| Ligne du plan | État | Ce que la mesure a montré |
|---|---|---|
| **Le fil de séance** | **fait** | `app/(coach)/fil.tsx`, 384 lignes. Trois registres, deux bandes, aucune prescription |
| **Lot 27a-bis — canal biométrie par coach** | **fait** | `openBiometryBroadcast(sessionId).sendTo(coachId, …)` ouvre bien `live:bio:<coachId>:<sessionId>`. Le plan le décrit comme à faire ; il l'est |
| **La phrase de consentement dit la comparaison d'élèves** | **fait, puis corrigé** | Elle existait — mais n'était rendue qu'APRÈS l'accord. Corrigée le 13/08 : conditionnel avant, indicatif après |
| **`coach_queue` câblée** | **fait** | `coachQueueLogic` + `coachQueueService` |
| **Le hub à deux modes** | **fait** | Le plan dit « quinze sorties, c'est un menu ». Mesuré : **six** |
| **La carte de séance survit à `triage`** | **fait le 14/08** | Voir ci-dessous — c'est le lot du jour |
| **`payment_link` : l'application n'écrit plus** | **fait** | Depuis le 12/08. La colonne, elle, reste (§ ci-dessous) |
| **Marge : `consistency`, formule et clé** | **fait le 14/08** | Trois défauts serveur corrigés en chemin |
| **`users.is_admin` peut partir** | **prêt** | Migration écrite, avec le piège des deux triggers |
| **Suppression de `payment_link` (colonne)** | **votre commande** | `PROPOSITION_J6_payment_link_et_testimonials.sql` |
| **Suppression de `coach_testimonials`** | **bloqué par la RLS** | Voir ci-dessous — il manque une fonction serveur |
| **Suppression des quatre écrans** | **DEUX supprimés, deux gardés** | Voir ci-dessous — le plan se trompe sur deux d'entre eux |
| **`rapport` devient la carte de séance** | **non commencé** | |
| **`assistant` devient le transcripteur** | **non commencé** | |
| **Phase 5bis — statut fondateur** | **colonnes en base** | `founder_since`, `founder_number` existent |
| **Phase 5ter — écuries** | **non commencé** | Aucun écran. Le plan note lui-même que l'annuaire *« restera vide toute la première saison »* |

---

## Le lot du jour : la chaîne de freinage ne dépend plus d'un écran condamné

Le plan condamne quatre écrans — `debrief`, `triage`, `lecture`, `priorites` —
parce que le fil de séance les rend inutiles. L'argument tient pour le texte.

**Mais `triage` portait autre chose.** Il était le SEUL montage de `PilotPreset`
dans l'application, donc le seul endroit où `detectBrakingPoints` était appelé,
donc le seul endroit où `BrakingPointsLayer` pouvait s'allumer.

Le supprimer aurait éteint la chaîne entière — celle que vous m'avez demandé le
13/08 de garder **et** de rendre fiable.

Deux instructions se croisaient. Aucune n'était à trancher : il suffisait de les
découpler. La carte vit dans `CarteSeanceFreinage`, montée par le fil.

**Ce qui n'a pas suivi : le tri.** Le plan note que `triage` est
*« doctrinalement douteux — un signalement automatique est une
interprétation »*. On garde la carte et les faits qu'elle situe ; le classement
reste derrière.

La garde n'exige pas seulement que la chaîne soit appelée. Elle exige qu'**au
moins un appelant ne soit pas un écran** : un service dont la survie tient à un
fichier d'écran est un service qu'une suppression de routine éteint.

---

## Ce que la mesure a trouvé et que le plan ne savait pas

### Treize analyses sur quatorze ne mesurent rien

En corrigeant la formule de constance, trois défauts sont sortis de la fonction
serveur — dont deux que l'application avait corrigés de son côté sans que le
serveur suive :

- `pilotMargin = 100` par défaut quand la séance n'a pas deux tours ;
- `max_g_lateral ?? 0` pour la marge véhicule, donc **100 %** quand la colonne
  est nulle.

Ce qu'ils ont écrit : **cinq lignes à `margin_global = 100.00`**, treize à
`margin_pilot = 100.00`, plusieurs G latéraux de 5 à 6,7 g — impossibles pour
une voiture de route.

**Une seule séance porte des tours valides.** Le reste est de la valeur par
défaut persistée.

### `coach_testimonials` ne peut pas être remplacé côté application

Le plan veut *« les faits d'activité dérivés de `coaching_bookings` — un relevé
que le coach ne peut pas écrire lui-même »*. L'intention est juste.

Mais la RLS n'expose `coaching_bookings` qu'aux deux parties. **Un pilote qui
consulte une fiche de coach ne peut pas lire ses réservations** — et c'est très
bien ainsi. Dériver les faits côté application supposerait d'ouvrir la table,
donc d'exposer qui roule avec qui.

`PROPOSITION_J6_coach_activity_facts.sql` rend trois nombres et une date, jamais
une ligne. **L'application ne l'appelle pas encore, délibérément** : écrire
l'appelant d'une fonction qui n'existe pas produit une erreur à l'exécution ;
écrire la logique sans appelant produit du code inerte. Ce dépôt a payé les
deux.

Rien à perdre au remplacement : **zéro témoignage en base.**

---

## Les quatre écrans — deux partent, deux restent

Le plan dit que le fil rend inutiles `debrief`, `triage`, `lecture` et
`priorites`. **Il se trompe sur deux d'entre eux**, et la règle qui le montre
vient du fondateur, le 14/08 :

> *« Avant de supprimer un écran, chercher ce qu'il monte en exclusivité. »*

Appliquée aux quatre :

| écran | ce qu'il détient en exclusivité | verdict |
|---|---|---|
| `triage` | la carte (`PilotPreset`) et la chaîne de freinage | **supprimé** — la carte est réhébergée dans le fil ; le tri, doctrinalement douteux, ne l'a pas suivi |
| `debrief` | rien. Que des services partagés | **supprimé** — mode présentation en lecture seule, ce que le fil fait |
| `lecture` | **le seul consommateur de `coachReadingService`** | **gardé.** C'est l'unique écrivain de `coach_reading_weights` : le supprimer orpheline la pondération entière |
| `priorites` | un écran d'ÉCRITURE — le coach désigne des virages pour un pilote | **gardé.** Le fil LIT ; supprimer `priorites` retire un chemin d'écriture, pas une redite |

Deux écrans partis, 933 lignes. Les deux autres ne sont pas des fenêtres sur le
même objet : ce sont des outils qui écrivent.

Une garde existante — `coachNav.test.ts` — a attrapé les deux entrées de
navigation devenues orphelines. Elle a fait exactement son travail.

---

## Les quatre critères d'acceptation

Le plan en pose quatre. **Aucun ne se vérifie sans matériel et sans deux comptes
coach.**

| | critère | ce qui manque |
|---|---|---|
| 1 | Le fil se remplit-il en temps réel pendant un run ? | un run, un boîtier |
| 2 | Un marqueur posé sur les lunettes se résout-il en tour, virage, mesures ? | les lunettes |
| 3 | Une carte de séance est-elle reçue par un pilote, avec l'audio ? | un compte coach — **et l'affiliation acceptée** |
| 4 | Le canal par coach émet-il au bon destinataire, et à lui seul ? | deux comptes coach |

Le code du 4 est écrit et lisible ; sans deux comptes, personne ne peut le
prouver.

### Le blocage n'est PAS celui que j'avais écrit

J'avais noté « zéro compte coach en production ». C'est vrai sur
`users.role = 'coach'`, et cela raconte l'inverse de ce qui se passe. **Le
dispositif est monté** — relevé par le fondateur, vérifié :

| | |
|---|---|
| `coach_profiles` | une ligne, `administration@oxvehicle.fr`, publiée, depuis le **07/07** |
| `coach_pilots` | `administration@` → `fillatgabin@gmail.com`, niveau `programme`, depuis le **22/06** |
| statut de ce lien | **`pending`** — jamais accepté |

Ce qui empêche de s'en servir : **`role` est unique.** Un compte ne peut pas être
administrateur ET coach. Passer `administration@` en coach lui retirerait
l'administration — et c'est le seul compte dont `is_admin()` soit vrai de manière
assumée (cf. § 0.4, les deux autres admins attendent votre oui ou non).

Il faut donc **deux comptes distincts** de l'admin et du pilote de test :
comptes dédiés, ou une branche Supabase si le budget le permet.

**Et l'affiliation du 22/06 est à accepter** : `pending`, elle bloquera le
critère 3 même une fois les comptes créés.

---

## Ce qui vous revient pour clore le jalon

**Quatre commandes**, toutes écrites, aucune appliquée :

| | fichier | ce qu'elle fait |
|---|---|---|
| 1 | *(déploiement)* `cron-analyze-pending-sessions` | clé + formule + les deux fabrications |
| 2 | `PROPOSITION_J6_reprise_analyses_fabriquees.sql` | vide les marges non calculables — **après** le 1 |
| 3 | `PROPOSITION_J6_coach_activity_facts.sql` | ouvre le remplacement de `coach_testimonials` |
| 4 | `PROPOSITION_J6_drop_users_is_admin.sql` | la colonne, avec ses deux triggers d'abord |

**Un mot** : les quatre écrans partent, ou restent. Depuis aujourd'hui, plus
rien ne s'y perd.

**Un compte coach** : sans lui, deux critères d'acceptation sur quatre restent
invérifiables, et `rapport` comme `assistant` n'ont pas d'utilisateur à servir.

---

*Ce document est mesuré au 14/08/2026. S'il est relu dans un mois, remesurer
avant de le croire — c'est ce qui a manqué au jalon 5.*
