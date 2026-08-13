# Point de fin de jalon — JALON 6, COACH

> 14 août 2026. Chaque ligne du plan a été **mesurée**, pas relue. C'est la
> leçon du jalon 5 : j'avais annoncé un lot de 71 écrans en attente alors que
> l'arbre était supprimé depuis des jours, parce que j'avais cru un document.

---

## En une ligne

**Toutes les lignes de code du jalon 6 sont traitées ; ce qui reste n'est pas
du code.** Onze lignes sur quatorze sont livrées, une attend une commande de
votre part (`payment_link`), deux attendent qu'un compte coach existe et qu'un
run ait lieu.

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
| **`rapport` devient la carte de séance** | **fait le 14/08** | Contrainte élargie, note écrite, LUE par le pilote, et la voix avec |
| **`assistant` devient le transcripteur** | **hors de ma portée** | Aucune transcription n'existe dans le dépôt. Voir ci-dessous |
| **Phase 5bis — statut fondateur** | **colonnes en base** | `founder_since`, `founder_number` existent |
| **Phase 5ter — écuries** | **fait le 14/08** | Écran, baptême et annuaire livrés. Deux fonctions serveur avaient dormi depuis le 04/07 |

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

### `rapport` : le produit était le PDF — il ne l'est plus

*« `rapport` devient la composition de la carte de séance — le PDF reste un
export, plus le produit. »*

Le défaut est réel et il est écrit dans l'en-tête de l'écran : le coach rédige
son bilan, le PDF est généré, et **le bilan n'est stocké nulle part** — « il
voyage dans le document ». Si le pilote perd le fichier, le bilan de sa séance
n'existe plus. Le critère d'acceptation n° 3 — *« une carte de séance est-elle
reçue par un pilote ? »* — ne peut pas être satisfait : rien n'est reçu,
quelque chose est partagé.

`coach_annotations` semblait convenir sans une ligne de schéma : elle porte
`telemetry_session_id`, `corner_index` est nullable, et `audio_url` existe déjà.

**Le CHECK dit non**, et il fallait le lire :

```
CHECK ( (corner_index IS NULL AND marker_elapsed_ms IS NOT NULL)
     OR (corner_index BETWEEN 1 AND 30) )
```

`corner_index` nul n'est permis QUE pour un marqueur horodaté. Une note portant
sur la séance entière est refusée. Le typage ne voyait rien — l'insertion est
castée.

`20260814210000_j6_note_de_seance.sql` — **appliquée** — élargit la contrainte à
trois formes exclusives, dont la troisième exige la séance ET un texte : sans
cela on créerait une note qui ne porte sur rien. Aucune colonne, aucune RLS
touchée.

**Les deux moitiés sont câblées.** Le coach enregistre (`upsertSessionNote`,
une note par séance et par coach : rédiger à nouveau REMPLACE) ; le pilote la
lit dans son bilan, sous « LE MOT DE VOTRE COACH · *nom* », voix attribuée.
N'écrire que la première moitié aurait reproduit le défaut corrigé : quelque
chose d'écrit que personne ne lit.

**Et la voix, qui manquait au critère n° 3.** `audio_url` et le bucket privé
`coach-audio` existent depuis le 18/06, avec quatre policies dont une écrite
exprès pour laisser le pilote lire. Mesuré le 14/08 : `getAnnotationAudioUrl`
n'avait **aucun appelant**. Le coach pouvait parler, personne ne pouvait
entendre — la garde posée, non armée, dans sa forme la plus nue. Le mémo vocal
est sorti de `annoter` (composant partagé, styles compris, pour ne pas dépendre
de la survie d'un écran), le rapport l'enregistre, le bilan le joue.

L'ordre des deux écritures n'est pas un confort : `coach_audio_insert` autorise
l'objet si son NOM est l'uuid d'une annotation. L'audio ne peut donc pas
précéder la note. `chaineAudioArmee.guard.test.ts` tient cet ordre, et surtout
tient l'invariant qui manquait — **les deux moitiés ont un appelant de
production**.

**Et le code disait le contraire de la base.** Le commentaire de
`poserMarqueur` annonçait « NOT NULL avec CHECK (1..7) jusqu'à ce que
PROPOSITION_L30 soit appliquée ». Elle l'est depuis le 02/08, et la borne est
30, pas 7. Corrigé : le commentaire porte désormais l'état relu en production,
et ce que la contrainte autorise vraiment.

### `assistant` : le plan demande un backend qui n'existe pas

*« `assistant` devient le transcripteur des notes vocales, plus l'analyste : il
met en forme ce qu'un humain a dit, il ne coache pas. »*

L'intention est doctrinalement juste — aujourd'hui l'IA **pré-rédige** une
observation, et seule la validation humaine la retient. Mais la bascule vers la
transcription demande trois choses que le dépôt n'a pas :

| | |
|---|---|
| un moteur de transcription | **zéro occurrence** dans tout le dépôt. Depuis le 14/08 le fichier est enregistré, envoyé et JOUÉ — mais jouer n'est pas transcrire, et rien ne le transcrit |
| une fonction serveur | l'audio ne peut pas être transcrit côté application |
| une clé d'API payante | donc une **dépendance critique** — validation fondateur (CLAUDE.md) |

Ce n'est pas un refus, c'est une frontière. Les 1 311 lignes de l'écran actuel
ne sont pas le problème : le problème est qu'il n'y a rien à brancher derrière.

---

## Les écuries — deux fonctions serveur dormaient depuis six semaines

Vous aviez demandé de garder cette ligne pour la fin. La mesure explique
pourquoi elle valait mieux que « non commencé ».

`crews` et `crew_members` sont en production depuis le **04/07**, avec quatre
fonctions serveur et une cinquième pour l'annuaire. `referralService.ts` les
expose toutes, testées, commentées. Mesuré le 14/08 :

| Fonction | Rôle | Appelants |
|---|---|---:|
| `getMyCode` | le code de parrainage | VOUS |
| `redeem` | rejoindre une écurie | VOUS |
| `getMyCrew` | mon écurie | 5 |
| **`nameMyCrew`** | **le baptême** | **0** |
| **`crews_public_rows`** | **l'annuaire public** | **0** |

Une écurie ne pouvait donc pas être nommée, et l'annuaire n'existait nulle
part. Le code était écrit, correct, testé — et sans personne pour l'appeler.

`app/(app2)/club/ecurie.tsx` les arme. **Zéro migration, zéro colonne** : il ne
manquait que l'appelant.

### Deux règles tenues par des tests, pas par des commentaires

*« L'ordre porte l'information, le numéro déclarerait un verdict. »* L'annuaire
est trié par taille et ne porte **aucun rang**. Un test vérifie que les lignes
rendues ne portent que les trois clés du serveur — un index ajouté au tri
traverserait jusqu'à l'écran.

*« Aucun chrono nulle part dans l'écurie. »* La raison n'est pas affaire de
goût : A rejoint l'écurie de B, puis C la rejoint — **A et C ne se sont jamais
choisis**. `are_friends()` exige les deux accords ; l'appartenance à une écurie,
non. La garde cherche onze marqueurs de chrono **après avoir retiré les
commentaires**, sinon elle tomberait sur sa propre documentation — l'en-tête de
l'écran écrit le mot pour énoncer la règle.

### Ce qui n'est pas livré, et pourquoi ce n'est pas un choix

Le plan prévoit aussi le logo téléversé par le capitaine, l'exclusion par le
capitaine et l'invitation par tous. **Les fonctions serveur n'existent pas**, et
aucun bucket de logo n'est déclaré. Les écrire côté application supposerait
d'écrire dans `crew_members` en direct — ce que la RLS refuse, à juste titre :
c'est au serveur d'arbitrer qui exclut qui.

Poser des boutons qui échoueraient serait le défaut que ce lot corrige ailleurs.

### Une ligne du plan était déjà satisfaite

*« Le parrainage quitte définitivement `rec/preparation`. »* Mesuré : cet écran
n'y porte plus aucun recrutement. Il garde un filtre « mon groupe » sur la liste
des présents, ce qui n'est pas recruter. Le code de parrainage vit dans VOUS.

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

### Et une garde neuve, pour que la prochaine suppression se voie

Une suppression d'écran laisse derrière elle des modules que plus personne
n'appelle — sans rien casser à la compilation. C'est le motif dominant du
dépôt, dans sa version la plus coûteuse : celle qu'on vient de créer soi-même.

`modulesOrphelins.guard.test.ts` construit le graphe d'imports RÉEL — les
spécificateurs sont résolus en chemins de fichiers, barils compris — et fige la
liste des modules de `src/` qu'aucun code de production n'importe. **Trente-deux
au 14/08.** La garde n'exige pas qu'elle soit vide ; elle exige qu'elle ne bouge
pas dans un sens ou dans l'autre sans qu'on le sache.

Il a fallu trois écritures pour que la mesure soit juste, et les deux premières
sont documentées dans le fichier : la recherche par nom ratait
`@/services/v2/…` ; la résolution mélangeait les séparateurs sous Windows et
rendait tous les barils faussement orphelins. La troisième a été **falsifiée sur
trois cas** avant d'être livrée.

Une précision que la mesure a imposée : les dossiers `__tests__` sont écartés du
parcours, donc « sans consommateur » veut dire **hors tests**.
`circuit/hauteSaintonge.ts` est importé — par deux tests, et par rien d'autre.
Ce n'est pas « personne ne s'en sert », c'est « plus aucun code de production ne
s'en sert », et un test vert ne s'en aperçoit pas.

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

## APPLIQUÉ le 14/08/2026 — les cinq commandes sont passées

*Sur votre accord. Chacune vérifiée en base après coup.*

| | ce qui a changé |
|---|---|
| déploiement du cron | version 20 · clé, formule, et les deux fabrications retirées |
| reprise des analyses | 13 lignes vidées de leurs marges fabriquées |
| `coach_activity_facts()` | créée, `SECURITY DEFINER`, `EXECUTE` au seul rôle `authenticated` |
| `w_regularity` → `w_consistency` | colonne renommée, code aligné |
| `users.is_admin` | supprimée, ses deux triggers traités d'abord |
| note de séance | le CHECK accepte désormais la troisième forme |

### L'état mesuré après

| | avant | après |
|---|---:|---:|
| analyses portant une marge | 14 | **1** |
| lignes à `margin_global = 100` | **5** | **0** |
| séances dans la file du cron | 0 | **0** |
| `users.is_admin` | présente | supprimée |

La seule analyse qui garde une marge est Bouteville — la seule qui en mérite
une. Elle porte encore l'ancienne clé et l'ancienne formule : la reprise ne
touche pas les lignes mesurables, délibérément. Effacer une analyse réelle
emporterait aussi son QDI, le seul de la base.

### ET J'AI CASSÉ LE CRON EN LE DÉPLOYANT

Le paramètre `verify_jwt` est **requis** par l'outil de déploiement, avec `true`
pour valeur par défaut. Je l'ai omis : la fonction est passée de `false` à
`true`.

Or le cron poste avec `Content-Type` et `X-Cron-Token` — **aucun
`Authorization`**. La plateforme l'aurait rejeté en 401 avant d'entrer dans la
fonction, et le balayage se serait arrêté sans que rien ne le dise.

Repéré dans la réponse du déploiement, corrigé en version 20. Vérifié :
`cron.job_run_details` ne montre **aucun passage** dans la fenêtre d'une minute
et demie — le dernier a réussi à 20 h.

Le fichier porte maintenant l'avertissement : *toujours redéployer avec
`verify_jwt: false`*, avec la raison.

### Ce que la régénération des types a attrapé

Trois fichiers demandaient encore `is_admin` à `users` : `useAuthStore` (le
`SELECT` du profil), `adminUsersService` (le `SELECT` de la console), et
`UserProfile` dans `src/types`. Aucun n'aurait été vu sans régénérer.

---

## Ce qui vous revient pour clore le jalon

**Les commandes sont passées.** Ce qui reste ne s'achète pas en SQL :

**Deux comptes coach**, distincts de l'admin et du pilote de test — `role` est
unique, et `administration@oxvehicle.fr` est le seul admin assumé. Sans eux,
deux critères d'acceptation sur quatre restent invérifiables.

**L'affiliation du 22/06** — `administration@` → `fillatgabin@`, restée
`pending`. Elle bloquera le critère 3 même une fois les comptes créés.

**Le terrain** : un run, un boîtier, les lunettes.

**Une clé d'API de transcription**, si `assistant` doit devenir transcripteur.

**Les écuries**, laissées pour la fin sur votre consigne.

---

*Ce document est mesuré au 14/08/2026. S'il est relu dans un mois, remesurer
avant de le croire — c'est ce qui a manqué au jalon 5.*
