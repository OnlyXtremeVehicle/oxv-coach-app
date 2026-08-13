# Ce qui attend une décision de votre part

> Ouvert le 04/08/2026, **mis à jour le 13/08 après l'essai terrain de
> Bouteville**. Un seul endroit pour tout ce qui est arrêté faute d'un arbitrage,
> à travers les neuf jalons du programme V3 et la coordination avec le site.
>
> **Si vous ne lisez qu'une section, lisez la § 0.** Le § 0.4 se répond par oui ou
> par non et vous seul le pouvez ; le § 0.2 arrête l'envoi de deux mesures
> inventées à vos clients ; le § 0.9 explique pourquoi votre marge de Bouteville
> vaut 39 quand elle devrait en valoir 51.
>
> **Ce document ne remplace pas `docs/DETTE.md`.** La dette recense ce qui est
> constaté ; celui-ci recense ce qui est *bloqué*, et par quoi.
>
> Il est tenu à jour au fil des jalons. Une décision prise est déplacée en bas,
> dans « Décidé », avec sa date — pour que la liste raccourcisse au lieu de
> gonfler.

---

## Comment lire ce document

Trois natures, et il ne faut pas les confondre.

**DÉCISION** — un choix entre deux options défendables. Personne d'autre que
vous ne peut le trancher, parce qu'il engage le produit, le droit ou l'argent.

**GESTE** — aucune décision à prendre, mais une action que seul votre compte
peut faire : un secret à créer, un compte à ouvrir, dix minutes sur un iPhone.
Ce sont les plus faciles, et ce sont ceux qui traînent le plus longtemps.

**AVIS D'UN TIERS** — un avocat, un expert-comptable. Ni vous ni moi.

Chaque entrée porte ce qu'il en coûte de ne pas trancher. Certaines ne coûtent
rien aujourd'hui, et c'est écrit aussi.

---

# 0 · APRÈS L'ESSAI TERRAIN DU 13/08 — le plus court chemin

*Ajouté le 13/08, étendu le même jour après l'arbitrage, puis le 14/08. Ces dix points sont en
tête parce qu'ils sont courts, qu'ils touchent des données ou des clients réels,
et qu'aucun ne demande de réfléchir longtemps.*

*Le § 0.4 ne vient pas du terrain mais d'une lecture directe de la base : il est
ouvert depuis mai, et aucun document ne le mentionnait. Il passe devant le
reste.*

*Le § 0.7 a été TRANCHÉ le 13/08 — il est conservé, clos, parce que le
raisonnement vaut d'être gardé. Il tenait la dernière ligne ouverte du jalon 5.*

*Restent donc HUIT points ouverts : 0.1 à 0.6, 0.8, et 0.9 — ce dernier ajouté
le 14/08, après que j'ai dû corriger ce que j'avais écrit la veille.*

## 0.1 — GESTE · Renseigner la longueur de vos trois tours

**Une commande. Elle ouvre le cinquième niveau de restitution.**

```bash
psql "$SUPABASE_DB_URL" -f scripts/sql/backfill_laps_distance.sql
```

`laps.distance_meters` n'a jamais été écrite — documenté depuis le 26/07,
corrigé le 13/08 pour toutes les séances À VENIR. Vos trois tours de Bouteville
gardent donc une longueur vide, et `compteToursComparables` n'accepte que des
longueurs strictement positives : le niveau « Le delta et la trace » reste fermé
sur votre séance, avec le message *« Aucun tour comparable »* — alors que vos
trois tours tiennent dans quatre mètres.

**Ce que le script calcule.** L'intégration de la vitesse Doppler sur vos propres
trames, exactement comme le fait désormais l'odomètre embarqué. Vérifié par
recoupement avec `avg_speed_kmh × duration_seconds` : les deux méthodes
concordent à **1,4 m près sur 5 875**. Idempotent, ne touche que les lignes
nulles, réversible (requête d'annulation en fin de fichier).

**Coût de ne rien faire.** Quatre niveaux sur cinq au lieu de cinq, pour toujours,
sur la seule séance réelle que porte la base.

## 0.2 — GESTE · Déployer `ritual_dispatcher`

**La fonction envoie toujours « 0°C · Conditions à confirmer » et « Vent 0 km/h »
à vos pilotes, la veille de leur journée.**

Le correctif est dans le dépôt depuis le 13/08 — la ligne météo est composée en
amont, et sans mesure elle dit « Prévision indisponible ». La fonction déployée,
elle, est celle d'avant.

**Je ne l'ai pas déployée : elle écrit à vos clients.** C'est un envoi sortant,
et il ne m'appartient pas de le déclencher.

**Coût de ne rien faire.** Deux mesures inventées, présentées comme des mesures,
à chaque J-1 — c'est la consigne A-WEATHER-1 violée au mot près, dans le seul
message que le pilote reçoit avant de rouler.

## 0.3 — GESTE · Signer le Pacte de Pilotage

Sur `gabinfillat@gmail.com`. Jamais fait. L'application le proposera au premier
lancement, une fois.

**Je ne l'ai pas signé à votre place, et je ne le ferai pas.** Un pacte accepté
par un tiers ne vaut rien, et ce n'est pas à moi de cocher une case qui vous
engage.

## 0.4 — DÉCISION · Deux comptes sont administrateurs. Est-ce voulu ?

*Ajouté le 13/08 après vérification directe sur la base — puis RÉDUIT le même
jour, la moitié du constat étant déjà réglée.*

**Le fait, et il tient :** `julie.huet.perso@gmail.com` (créé le 09/05) et
`bitaube.p@gmail.com` (13/05) portent `role = 'admin'`. `is_admin()` lit `role`
— ils ont donc **un accès complet aux données de tous les pilotes, depuis
mai**.

Vous seul pouvez dire si c'est voulu. **Répondez par oui ou par non.** Si non,
c'est un retrait de privilège :

```bash
psql "$SUPABASE_DB_URL" -c "update public.users set role='pilot' where email in ('julie.huet.perso@gmail.com','bitaube.p@gmail.com');"
```

---

**Ce qui N'EST PLUS un problème, et que l'arbitrage croyait ouvert.** Il annonce
« deux administrateurs invisibles » et « deux systèmes d'autorisation divergents
en production ». C'était vrai le 28 juillet. Ça ne l'est plus :

- `accesLogic.estAdmin` ne lit QUE `role`, en miroir exact de `is_admin()` — le
  repli `OR is_admin` a été retiré au lot 8, et un commentaire de vingt lignes
  explique pourquoi le réintroduire recréerait le défaut en sens inverse ;
- la colonne porte en base l'annotation : *« INERTE depuis le 28/07/2026 —
  `role` fait seule autorité. Conservée le temps de vérifier le site web. Ne
  plus s'en servir. »*

**Aucun écran de l'application ne lit cette colonne pour décider d'un accès.**
L'arbitrage ne pouvait pas le savoir : sa § F prévient qu'il n'a pas lu les
fichiers de l'application mobile. C'est la cinquième fois que cette réserve se
vérifie.

Reste donc une seule question, et elle est de fait, pas de conception.

## 0.5 — DÉCISION · Le quota de builds iOS est épuisé

Le plan gratuit EAS ne rend ses builds iOS que le **1er septembre**.

**Ce qui est déjà construit et testable :** le build 50 porte onze des douze lots
du 13/08 — tout ce qui a cassé au terrain est dedans.

**Ce qui n'est dans aucun build :** la récupération automatique des trames au
lancement. Elle est committée et testée, mais ne tournera sur appareil qu'au
prochain build. Sans conséquence pour l'essai suivant : ce filet ne sert que si
une séance a perdu des trames côté serveur, ce qui n'est pas arrivé.

**Deux issues, et c'est un choix d'argent :** passer le compte EAS en plan payant,
ou faire un build local avec Xcode. Aucune n'est à moi de trancher.

## 0.6 — GESTE · La vérification qu'aucun test ne remplacera

**Verrouillez l'écran en pleine séance, roulez dix minutes, regardez si les
trames sont là.**

L'arrière-plan BLE est déclaré en entier — `modes: ['central']`,
`isBackgroundEnabled`, et surtout `restoreStateIdentifier`, celui sans lequel iOS
ne réveille jamais l'application. Une garde fige les trois morceaux ensemble.

Mais **aucun test ne réveille un téléphone**, et aucun harnais de test n'a de fil
UI. C'est la seule vérification qui compte, et elle est au circuit.

Si les trames ne suivent pas, le message « AUCUNE DONNÉE » s'affichera au bout de
douze secondes — vous le saurez sur place, plus au retour.

---

## 0.7 — TRANCHÉ le 13/08/2026 · Le mot d'écran suivait la mauvaise branche

*Cette entrée demandait votre arbitrage entre deux de vos décisions. Vous l'avez
rendu le jour même, et par un chiffre. Elle est conservée ici, close, parce que
le raisonnement vaut d'être gardé.*

### Ce qui tranchait

Le QDI de Bouteville — **le seul QDI de toute la base** — porte
`trajectoire: 97` et `regularite: 34` dans le même objet. L'écran Signature
affichait « Trajectoire » en lisant `regularite` : le pilote voyait **34 sous
un mot dont la clé homonyme valait 97**. Ce n'était pas un double vocabulaire à
arbitrer, c'était un homonyme piégé — quiconque compare l'écran au JSON conclut
à un bug, et le cherche.

### La décision, et ce qu'elle épargne

L'arbitrage du 19/07 tombe. **Le vocabulaire client, non.** L'Arbre V3
demandait la disparition du double vocabulaire : ç'aurait détruit cinq mots de
marque, que les instructions du projet figent, pour régler un problème qui
n'avait qu'une occurrence.

Une seule correspondance a été échangée :

| | avant | après |
|---|---|---|
| `trajectoire` | Cap | **Trajectoire** |
| `regularite` | Trajectoire | **Cap** |

Visée, Plongée, Anticipation ne bougent pas. Le 19/07 avait pris le mot le plus
évident pour le brancher ailleurs, alors que le mot juste était disponible dans
la même liste. Coût identique à une suppression — un écran, un module, un test —
et la marque est intacte.

### « Intensité » : retirée des branches, motif écrit

Ce n'était ni une sixième branche ni un mot égaré. Sur un radar qui se lit
« plus haut, mieux », une branche Intensité signifierait qu'un pilote **améliore
sa figure en roulant plus près de la limite** — une restitution transformée en
incitation, sur un produit dont vos propres documents écrivent qu'il n'est pas
agréé pour évaluer.

Le mot est retiré des six documents qui le portaient, **avec son motif à côté** :
sans motif, il revient dans six semaines.

**Le code ne l'avait jamais commis.** Le pilier physiologique existe sous le nom
« Aplomb », vit **hors** du radar, en barre séparée, fermé sur trois conditions,
et rend `null`. Ce sont les documents qui avaient promu le mot au rang de
branche.

### Ce que la correction ne rend PAS

Une figure lisible. Ce seul QDI porte `fluidite: 0`, `acceleration: 0`,
`freinage: 7` et `reference.sessions: 0` : le radar est quasi plat et ne compare
à rien. **Ne lisez pas cette figure comme une mesure** tant que la référence ne
s'est pas remplie. Corriger un mot faux reste juste quelle que soit la donnée ;
cela ne fabrique pas la donnée.


---

## 0.8 — GESTE · Deux commandes que le classifieur m'a refusées

**Le renommage `regularity` → `consistency` est fait dans le code. Il lui manque
ses deux moitiés de production, et je n'ai pas pu les exécuter.**

Les deux actions ont été refusées par le classifieur de sécurité. Je ne les ai
pas contournées.

### Ce qui est déjà fait

Le calcul embarqué, la lecture du coach, l'écran de pondération et la source de
la fonction serveur portent tous `consistency`. Une garde lexicale
(`margeConsistency.guard.test.ts`) interdit le retour du mot dans le code des
quatre fichiers concernés — y compris la fonction Deno, que `tsc` ne compile pas
et que rien d'autre ne surveillait.

### 1. Redéployer la fonction serveur

```bash
supabase functions deploy cron-analyze-pending-sessions --project-ref fouvuqkdxarjpjbqnsjq
```

C'est **le second écrivain de la même colonne**, et il tourne : `pg_cron` job 4,
« analyze-pending-sessions », actif, toutes les heures.

Précision qui change la gravité : il ne balaye que les séances **dépourvues**
d'analyse. Il ne réécrira donc pas les lignes converties — mais chaque séance
neuve repartirait avec l'ancienne clé, et la colonne porterait deux formes.

### 2. Convertir les quatorze lignes existantes

Le fichier est prêt :
`supabase/migrations/20260813233000_j6_margin_breakdown_consistency.sql`

Elle est idempotente, ne change **aucune valeur** — seulement le nom d'une clé —
et se vérifie elle-même : si une ligne portait encore l'ancienne clé après
l'`UPDATE`, elle échoue au lieu de se déclarer réussie.

### Ce que vous ne risquez pas en attendant

**Rien ne lit `margin_breakdown` aujourd'hui.** `DebriefMirror` — le composant
des « quatre piliers » — n'a aucun appelant, et `computeCoachReading` non plus.
La colonne est écrite par deux sources et lue par zéro écran.

C'est un constat en soi, et il vaut d'être noté : les quatre piliers du
débriefing sont calculés, stockés, et affichés nulle part.

### Deux points annexes, laissés en place

- **`coach_reading_weights.w_regularity`** garde son nom : c'est une colonne, et
  le schéma vous revient. Le champ TypeScript est passé à `wConsistency`, la
  correspondance est faite au seul endroit qui mappe la table.
- **`dataColors.regularity`** sert encore de teinte à la pondération « Constance »
  de l'écran coach. C'est la couleur de la BRANCHE QDI : l'employer là rejoue en
  couleur l'homonymie qu'on vient de retirer des mots. Une teinte propre à la
  marge est à trancher.

---

## 0.9 — DÉCISION · La marge note zéro une régularité de 3,98 %

**Et j'ai d'abord raconté cette affaire de travers. La correction d'abord.**

### Ce que j'avais écrit, et qui était faux

Le 13/08 au soir, dans quatre fichiers et dans un commit, j'ai écrit que
`qdi.regularite` et `margin_breakdown.regularity` étaient **deux mesures
différentes** — « le QDI mesure la constance du geste, la marge la dispersion
des temps au tour ».

`qdiLogic.computeRegularite` reçoit `laps.map((l) => l.durationSeconds)`. **Les
deux partent des mêmes temps au tour.** Ce n'était pas une homonymie entre deux
grandeurs : c'est **une grandeur, deux formules qui ne s'accordent pas**.

Le renommage reste justifié — deux formules d'une même grandeur doivent porter
deux noms —, mais le motif n'était pas celui que j'avais écrit. Les quatre
fichiers portent la correction.

### Le vrai défaut, reproduit sur vos trois tours

| | |
|---|---:|
| Vos tours de Bouteville | 360,485 · 327,542 · 339,483 s |
| Moyenne | 342,503 s |
| Écart-type | 13,617 s |
| **Dispersion relative** | **3,98 %** |
| QDI (coefficient de variation) | **34** |
| Marge (écart-type absolu) | **0** |

Les deux valeurs de la base sont reproduites à l'unité par un test
(`deuxFormulesUneGrandeur.test.ts`).

**Le seuil de la marge est ABSOLU** : une seconde, cinq secondes, quelle que
soit la longueur du tour. Sur un tour de kart de 60 s, cinq secondes d'écart-type
valent 8 % — dispersé, la note zéro est méritée. Sur vos tours de 5 min 42, elles
valent **1,5 %**, et la formule rend zéro quand même. Elle compare un temps à un
seuil sans le rapporter à la durée du tour.

Autrement dit : **plus le circuit est long, plus la formule vous punit** — et
Bouteville est long.

### Ce que je n'ai pas fait, et pourquoi

Le correctif tient en une division : rapporter l'écart-type à la moyenne, comme
le fait déjà le QDI. **Je ne l'ai pas appliqué.**

`consistency` pèse 0,6 de la marge pilote, elle-même 0,6 de `margin_global` —
**le seul chiffre que l'écran affiche**, celui du Principe 5. Le passer en
relatif ferait passer votre séance de **39 à 51**, et changerait de zone.

Déplacer le chiffre central du produit sur sa seule séance réelle n'est pas une
correction de bord. C'est un choix d'algorithme, et il est à vous.

### Trois façons d'en sortir

1. **Passer en relatif** — cohérent avec le QDI, et la contradiction disparaît.
   Les quatorze analyses existantes sont à recalculer.
2. **Garder l'absolu, mais le rapporter au tour** — un seuil exprimé en
   pourcentage de la durée médiane. Même effet, formulation plus explicite.
3. **Ne rien changer** — mais alors la marge et le QDI continueront de dire
   deux choses opposées de la même séance, et le premier pilote qui compare
   posera la question.

**Coût de ne rien décider** : `margin_global` est le chiffre du Principe 5. Tant
que ce seuil ne tient pas compte de la longueur du tour, il sous-note toutes les
séances sur circuit long — c'est-à-dire les vôtres.

---

# 1 · CE QUI ARRÊTE DU TRAVAIL AUJOURD'HUI

## 1.1 — DÉCISION · La typographie : trois questions liées

**Jalon 2, Phase 1.** C'est le seul point de la Phase 1 encore ouvert.

**Ce qui est mesuré.** Le dépôt porte **cinq** familles de caractères, là où le
plan en nomme trois : Hanken Grotesk, JetBrains Mono, Inter, Syncopate,
Michroma. Trois tables de jetons concurrentes, trois langages de titre.

**a. Le trio du plan a-t-il été refusé par vous, ou par moi ?**

Le plan de montage (27/07) nomme *Söhne Breit · SF Pro · JetBrains Mono*.
L'adoption de Hanken Grotesk date du **10/07** — donc le plan est le document
le plus récent, et il nomme un trio que le dépôt ne porte pas. Ce qui vient
après, c'est le refus : `DETTE.md` D-12, le 28/07, motivé — Söhne est une fonte
commerciale sous licence Klim, SF Pro est réservée à Apple.

Le motif est solide. Mais D-12 porte la mention « traité par : décision
fondateur », et **je n'ai trouvé aucune trace de cet arbitrage hors du dépôt**.
Si cette mention est une auto-attribution, le point n'est pas tranché.

> *Ma recommandation :* confirmer le refus. Les deux fontes du plan sont
> juridiquement indisponibles ; le sujet n'est pas esthétique.

**b. Michroma et Syncopate : on consolide, ou on assume par écrit ?**

Toutes deux sont **antérieures** au plan (Programme V2 le 18/07, lot
PROFIL_CARTES le 17/07). Ce ne sont donc pas des décisions postérieures qui
excuseraient l'écart : ce sont précisément les systèmes que le plan voulait
consolider. Aucune entrée de dette ne les consigne.

> *Ma recommandation :* consolider vers Hanken. Trois langages de titre sur une
> application de cinq onglets, c'est un accident d'historique, pas une intention.

**c. Le point ou la virgule pour les chronos ?**

Deux règles écrites se contredisent. Le plan : *« séparateur décimal : virgule.
`1:41,203`, jamais `1:41.203`. Corriger partout. »* Et
`src/lib/queries/cartesLogic.ts:44` : *« POINT décimal (jamais de virgule —
norme chronométrage) »*, avec un test qui le verrouille. Aucune source n'est
citée pour cette norme.

J'ai converti 27 chaînes vues par le pilote à la virgule le 04/08, et **laissé
`cartesLogic` intact** — j'avais commencé par renverser son test au passage, je
l'ai rétabli.

> *Ma recommandation :* la virgule partout dans le produit. C'est une
> application française pour des clients français. Si une norme de chronométrage
> impose le point sur un document officiel, elle concerne ce document, pas
> l'écran d'un pilote.

**Coût de l'attente :** la Phase 1 ne peut pas être déclarée close, et le
Jalon 2 ne peut pas passer en Phase 2.

---

## 1.2 — DÉCISION · Le rythme de la grille : `space.lg = 18`

**Jalon 2, Phase 1.**

Le dossier pose une base de 8 avec demi-pas à 4. `src/ui/v2/tokens.ts:64` porte
`space.lg = 18` — hors du pas comme du demi-pas. Il est employé **236 fois** et
couvert par **aucun test**.

Le corriger déplace 236 mises en page. Ce n'est pas un correctif qu'on glisse :
ça se regarde sur un écran avant de se décider.

> *Ma recommandation :* passer à 16 après un build, en regardant trois écrans
> denses. 18 n'est pas un choix, c'est une valeur qui a échappé à la règle.

**Coût de l'attente :** faible. Le rythme est imparfait, rien ne casse.

---

## 1.3 — DÉCISION · La Phase 2 touche l'autorisation : j'y vais ou pas ?

**Jalon 2, Phase 2.** Le plan l'écrit lui-même : *« ce lot touche
l'autorisation. Une erreur ici verrouille des comptes. »*

Il s'agit de faire de `role` la source d'autorité et de `is_admin` un miroir
maintenu par déclencheur. Avec une exemption obligatoire dans la même migration :
`administration@oxvehicle.fr` porte `role = 'pilot'` et `is_admin = true` — le
miroir le rétrograderait et **le verrouillerait hors de son propre espace
d'administration**.

Je peux préparer la migration et vous la soumettre sans l'appliquer, comme
`PROPOSITION_mark_attendance.sql`. Je ne l'appliquerai pas sans votre mot.

> *Ma recommandation :* oui, préparer. Mais l'appliquer un jour où vous êtes
> disponible pour vous reconnecter juste après et confirmer votre accès — c'est
> l'acceptation que le plan exige, et elle ne se délègue pas.

**Coût de l'attente :** le Jalon 2 s'arrête là.

---

## 1.4 — DÉCISION · La purge RGPD : 55 couples sans statut

**Jalon 2, Phase 3, lot 10.** Le sujet le plus lourd du jalon.

`supabase/verifications/couverture_purge.sql` se rejoue. Rejoué le 04/08 :

| | 28/07 | 04/08 | écart |
|---|---|---|---|
| couples totaux | 119 | 129 | +10 |
| couverts | 67 | 66 | −1 |
| **non couverts** | **52** | **63** | **+11** |

Huit des 63 sont des tables internes de Supabase, hors de notre ressort. **Le
trou applicatif réel est de 55**, et il s'est creusé de onze en sept jours.

La matrice de rétention (`docs/architecture/14_PURGE_MATRIX.md`) justifie les
27 du référentiel `public.users` — rétention comptable de dix ans, colonnes
d'acteur administratif, une décision produit. **Les autres ne sont statués nulle
part.** Parmi eux : `pilot_notes`, `pilot_waiver_signatures`,
`pilot_signature_snapshots`, `coach_invoices`, `pilot_development_cycles`.

Toutes ces tables sont à zéro ligne aujourd'hui. Le préjudice est nul. **Elles
se rempliront à la première journée réelle.**

Ce que j'attends de vous : pour chacune, **effacer ou conserver**, et si
conserver, sur quel fondement. Je peux vous préparer la liste en tableau à
cocher si c'est plus simple.

> *Ma recommandation :* effacer tout ce qui n'a pas d'obligation légale de
> conservation. Une signature de décharge relève probablement de la prescription
> — c'est le point à poser à l'avocat (§3.1).

**Coût de l'attente :** nul jusqu'à la première journée réelle. Non nul après.

---

## 1.5 — RIEN À DÉCIDER · Les Insights : c'était déjà fait

**Entrée ouverte puis refermée le 04/08/2026, le jour même.** Je l'avais posée
comme une décision en attente. Vérification faite, le lot 13 est livré et
branché — il n'y a rien à trancher.

`src/components/insights/disponibilite.ts` porte les trois états `disponible` ·
`absent` · `demo`, avec `productionAutorise` qui interdit le rendu du troisième
hors développement. `src/services/sessionInsightsService.ts` filtre par
`engine_version` sur une liste blanche de moteurs réels, avec un second verrou
côté client au cas où le filtre serveur sauterait. Et
`app/(app2)/data/session/[id].tsx:99` consomme `etatLecture` et
`sectionAffichable`.

La conséquence annoncée par le plan tient toujours : tant que rien n'est mesuré,
la section s'efface. C'est le comportement voulu, et il est en place.

Consigné plutôt que supprimé : une entrée qui disparaît sans trace laisse penser
qu'on l'a oubliée.

---

## 1.6 — L'ÉTAT RÉEL DE LA PHASE 3, vérifié le 04/08

Le plan décrit cinq lots bloquants. Trois n'en sont plus.

| Lot | État vérifié |
|---|---|
| 10 · Purge RGPD | **Ouvert** — 55 couples sans statut. Voir §1.4. |
| 11 · `registrations.status` | **Ouvert** — la RPC attend votre mot. Voir §2.1. |
| 12 · `registration_id` jamais devinée | **Tenu par construction.** La colonne n'existe pas sur `telemetry_sessions`, et rien ne l'écrit. Consigné en D-45 : le jour où ce lien sera voulu, le chemin facile sera le rapprochement par date, et il se trompera. |
| 13 · Insights, liste blanche | **Fait.** Voir §1.5. |
| 27bis · Déclencheur `coach_availability` | **Fait, les deux moitiés.** Le déclencheur pose `pending_validation` et non plus `closed` ; `creneauMessageLogic.ts` le dit à l'écran — « Créneau proposé », « en attente de validation ». |

Autrement dit : **le Jalon 2 tient en trois arbitrages** — la typographie
(§1.1), la migration d'autorisation (§1.3), et la rétention RGPD (§1.4) — plus
la RPC de pointage côté site (§2.1).

---

# 2 · CE QUI ATTEND LE SITE

Ces points sont bloqués par une équipe qui attend une réponse de vous, ou par
un geste sur l'autre dépôt.

## 2.1 — DÉCISION · `PROPOSITION_mark_attendance.sql`, et son ordre

Le site s'apprête à révoquer `UPDATE` colonne par colonne sur `registrations`.
Sa liste contient `attended_at` mais pas `attended_by` ni
`attendance_updated_at` — or l'application écrit les trois d'un coup, et
**Postgres refuse l'instruction entière dès qu'une colonne manque au droit**.
Le pointage des présences tomberait net, le jour d'un roulage, au circuit. Et
pour les administrateurs aussi, les grants se vérifiant avant la RLS.

La contrepartie est écrite et non appliquée. L'ordre est contraignant : RPC,
puis bascule de l'application, puis REVOKE. **Notre étape intermédiaire passe
par une revue App Store** — ce n'est pas un déploiement web.

> *Ma recommandation :* appliquer la RPC. Elle ne casse rien à elle seule, et
> elle ferme au passage un défaut de notre côté : la garde qui interdit de
> pointer une inscription annulée tourne aujourd'hui dans l'application, donc
> n'importe quel jeton authentifié peut l'ignorer.

## 2.2 — DÉCISION · Les cinq contradictions relevées par le site

Ils attendent votre arbitrage, pas le mien. Rappel de leur formulation :

1. `events` conservé pour les balades, alors que la base porte
   `DEPRECATED — À SUPPRIMER`, écrit le 30/06 ;
2. le prix se calcule dans le navigateur, et tout pilote peut réécrire
   `price_total` sur sa propre ligne ;
3. `is_premium` : le site s'en sert à quatre endroits, sa suppression casse
   l'annuaire partenaires ;
4. le parrainage est décrit comme « symbolique, sans avantage commercial », mais
   le site promet déjà trois paliers dont deux sont opérationnels ;
5. l'homonymie D-22 — levée, et notre dossier est corrigé.

## 2.3 — DÉCISION · L'URL de paiement `/paiement/{registration_id}`

Techniquement, elle s'intègre sans obstacle : le statut `pending_payment` est
déjà libellé, l'identifiant est en portée, et l'application ouvre déjà
`oxvehicle.fr/compte-sessions`.

**Ce n'est pas pour autant une validation.** Ouvrir un parcours de paiement
depuis l'application touche la revue App Store sur les services vendus hors
application. C'est votre arbitrage, pas le mien.

## 2.4 — GESTE · Le merge de leur branche sur `main`

Leur branche est poussée, `main` n'a pas bougé, et Vercel ne déploie que `main`.
Tant que le merge n'a pas lieu, `/share/{jeton}` ouvre la page d'accueil : le
lien de partage de l'application ne mène nulle part. Second registre de D-22,
toujours ouvert.

## 2.5 — DÉCISION · Les trois énumérations partenaires

Ils attendent les valeurs exactes. Je n'ai pas d'avis : c'est du vocabulaire
produit.

---

# 2bis · JALON 3 — LE FLUX REC

Relevé le 05/08/2026 par inventaire adversarial des huit écrans.

## 2bis.1 — DÉCISION · Le plan demande deux écrans que la dette dit inutiles

`OXV_Mirror_V3_Arbre_Pilote.md:197` et `:218-224` réclament deux écrans neufs,
`rec/appairage` et `rec/consentement`. Aucun n'existe.

Ce n'est pas un oubli : votre décision du 01/08 (`DETTE.md:761`, commit `ea637f0`)
a replié le consentement en feuille sur `equipement`, et maintenu le flux à huit
étapes. Les deux textes coexistent, et se contredisent.

**Conséquence pratique :** une relecture du plan conclut « il manque deux
écrans » ; une relecture de la dette conclut « c'est fait ». Le prochain qui
lira l'un sans l'autre se trompera.

> *Ma recommandation :* amender le plan, pas le code. Votre décision est plus
> récente et mieux motivée — le pilote vient de connecter son boîtier, c'est là
> que la question du cardio a un sens.

## 2bis.2 — DÉCISION · Le chrono en roulage : le code est plus strict que le plan

`Arbre_Pilote.md:240` dit que l'écran de roulage « affiche le chrono et le
dernier tour bouclé ». `roulage.tsx` n'affiche **aucun chrono** — et le revendique
en en-tête, au nom du Principe 3.

Je m'attendais à trouver une violation. C'est l'inverse : l'implémentation est
plus silencieuse que ce que le plan autorise.

> *Ma recommandation :* garder le silence total et amender le plan. Un chiffre
> qui bouge en piste appelle le regard, et c'est exactement ce que le Principe 3
> refuse. Le chrono figé existe déjà un écran plus loin.

## 2bis.3 — DÉCISION · La barre d'onglets : deux règles écrites s'opposent

`Plan_Montage.md:229` : « barre masquée en roulage seulement ».
`centralButtonLogic.ts:98` la masque sur **cinq** segments du flux.

L'une des deux doit céder.

## 2bis.4 — DÉCISION · Le « passable » du QCM, en haut à droite

`Arbre_Pilote.md:262` place l'action « passer » en haut à droite. La règle des
cibles du même jalon dit : « aucune action critique dans le tiers supérieur ».
À trancher **avant** de dessiner l'écran, pas après.

## 2bis.5 — DÉCISION · La ceinture cardio réservée aux pilotes coachés

`equipement.tsx:894` applique cette règle. Elle est assumée en commentaire et
n'apparaît dans aucun document de cadrage.

## 2bis.6 — SCHÉMA · Trois changements, à soumettre sans appliquer

- **`pilot_notes` structuré.** La table ne porte qu'un `body text`. Le plan le
  dit : « un texte libre ne se croise pas ». Le QCM de l'entre-runs ne peut pas
  être livré proprement avant. Le vocabulaire des options devra rester aligné
  sur celui de la variable coach.
- **`declared_at` sur `eligibility_items`.** Absente ; dix occurrences dans le
  dépôt, toutes documentaires.
- **Une policy d'écriture pilote sur `eligibility_items`.** Même avec la
  colonne, le pilote ne pourrait rien déclarer : l'`UPDATE` y est réservé à
  `is_admin()`. Second changement, second accord.

## 2bis.7 — DÉCISION PRODUIT puis SCHÉMA · Qui possède la ligne d'éligibilité

Question D-13 de `docs/CE_QUI_ME_MANQUE.md:91`, jamais tranchée : le site ou
l'application. Elle bloque le bloc d'éligibilité en tête de préparation.

À savoir avant de trancher : **le pilote n'est pas aveugle aujourd'hui.** La
fonction serveur `eligibility-reminders` lui envoie à J-14, J-7 et J-2 la liste
nominative de ce qui manque, avec renvoi vers le site. Le défaut est un défaut
de rapatriement dans l'application, pas une absence d'information.

## 2bis.8 — DÉCISION · La préséance pilote : il n'y a rien à arbitrer, encore

Le plan demande que le ressenti du pilote prime sur « la variable posée par le
coach ». **Aucun producteur de cette variable n'existe.** Le coach écrit des
objectifs que rien dans l'espace pilote ne lit, et ce n'est pas le même objet.

Il faut d'abord trancher **quel objet** est cette variable. C'est un lot, pas un
correctif.

---

## 2bis.9 — DÉCISION · Le rouge de marque ne peut pas porter de texte à 7:1

**Mesuré le 05/08/2026, pas estimé.** Sur `#C8102E`, aucune couleur de texte
n'atteint le plancher de 7:1 que le jalon impose aux huit écrans du flux :

| texte sur le rouge | contraste |
|---|---|
| blanc pur `#FFFFFF` | **5,88** — le maximum atteignable |
| `#F5F5F7` | 5,40 |
| `text.hi` `#E8E9ED` | 4,85 |

Trois libellés sont dans ce cas, dont « Maintenez pour armer » sur le bouton
d'armement. Il était à **2,90** — `text.hi` à 70 % d'opacité — c'est-à-dire que
la consigne expliquant comment armer la capture était le texte le moins lisible
du flux. Corrigé à 5,88 le 05/08 : l'opacité retirée, le blanc pur posé. C'est
le mieux possible sans toucher au rouge.

Trois issues, et la troisième est légitime :

- **changer le rouge de marque** sur ces boutons — il faudrait un rouge bien
  plus sombre, et ce n'est plus la couleur OXV ;
- **passer ces boutons en bord seul**, texte clair sur fond sombre : le
  plancher redevient atteignable, mais l'armement perd sa masse rouge, qui est
  précisément ce qui le rend trouvable en plein soleil ;
- **assumer 5,88 sur les boutons pleins**, en écrivant pourquoi. Le plancher
  s'applique au texte qu'on doit lire pour comprendre ; un libellé de bouton
  est doublé par la forme, la position et le geste.

> *Ma recommandation :* la troisième, écrite noir sur blanc dans le dossier de
> conception. Un plancher qu'on ne peut pas tenir et qu'on ne discute pas
> devient un plancher qu'on ignore.

## 2bis.10 — DÉCISION · `mid` sur `bg.card2` mesure 6,74

Quatre centièmes sous le plancher. C'est un défaut de JETON, pas d'écran : les
huit écrans du flux emploient désormais `mid` comme gris secondaire, et il passe
sur `bg.base` (8,14) et `bg.card` (7,52).

Le relever le rapprocherait de `hi` (12,44) et écraserait un palier de la
hiérarchie — c'est exactement l'arbitrage que la note du 25/07 avait déjà tranché
dans l'autre sens pour `low` et `dim`. Il se regarde sur un écran, pas dans un
tableau.

**Coût de l'attente :** trois écrans du flux emploient `bg.card2`. Faible, et
mesurable.

---

# 3 · CE QUI ATTEND UN TIERS

## 3.1 — AVIS · L'avocat

Trois sujets, et ils se posent ensemble :

- les **décharges de responsabilité** (lot P3) : le logiciel est livré et gaté
  hors ligne, il attend une relecture avant d'être allumé ;
- la **durée de conservation** d'une signature de décharge — c'est la question
  qui débloque §1.4 ;
- le **dossier avocat** du programme V3 (`docs/programme-v3/OXV_Dossier_Avocat.md`),
  jamais transmis.

## 3.2 — GESTE · Le SIRET

Bloque l'activation de l'économie coach : facturation, versements, et la
validation des créneaux.

---

# 4 · DES GESTES, PAS DES DÉCISIONS

Aucun arbitrage à rendre. Seul votre compte peut les faire.

## 4.1 — Les secrets d'intégration continue

**85 tests de politique de sécurité n'ont jamais tourné.** Ils sont écrits,
ils attendent des secrets qui n'ont jamais été créés. Procédure dans
`docs/architecture/17_CI_RLS_SETUP.md`.

**Ne les pointez jamais vers la production.** Ces tests écrivent.

Le même geste débloque la vérification de couverture de purge (§1.4), qui
devrait faire échouer la chaîne quand un couple non couvert apparaît, et qui ne
le peut pas faute d'accès base. Deux gardes, une cause.

## 4.2 — Dix minutes sur l'iPhone, cinq écrans

C'est la dernière condition pour clore T0 du Jalon 1. La liste est prête :
`docs/T0_ACCEPTATION_VISUELLE.md`, cinq écrans qui couvrent les douze familles
d'animation.

**Coupez d'abord « Réduire les animations »** dans les réglages d'accessibilité.
Cinquante fichiers du dépôt s'y conforment : s'il est actif, tout sera figé,
correctement, et indistinguable d'une migration cassée.

## 4.3 — Un exécuteur à appareil dans la chaîne

Bloque T3 du Jalon 1 — la mesure des temps d'image sur appareil réel. Le
workflow existe, désactivé, en attente d'une étiquette d'exécuteur qui n'existe
pas. Ce n'est pas réglable depuis un poste Windows.

## 4.4 — Une séance réelle — ~~à Valence~~ **FAITE, à Bouteville le 13/08**

*Mis à jour le 13/08. Cette entrée était le point de blocage le plus large du
document ; elle est en grande partie levée.*

La séance a produit **26 999 trames et trois tours**, toutes porteuses de vitesse
de lacet et des deux accélérations. La base est passée de 53 trames à 27 052.

**Ce que ça débloque, effectivement :** quatre des cinq niveaux de restitution
s'ouvrent sur données réelles (le cinquième attend le geste 0.1), et les mesures
des jalons 1 et 4 ne portent plus uniquement sur des séries fabriquées.

**Ce qui reste ouvert, et qu'il ne faut pas déduire :**

- la **calibration des seuils** du socle de calcul demande plusieurs séances, pas
  une — et Bouteville est une boucle de routes ouvertes, pas un circuit fermé ;
- le **seuil réel de bascule superposition → bande** reste une convention à 24 ;
- la **célébration de record** n'a toujours pas été observée : elle se déclenchait
  à chaque séance jusqu'au 13/08 (défaut corrigé), donc ce qui a été vu ne
  prouvait rien ;
- les **six lectures d'Insight** n'ont pas été vérifiées sur cette séance.

## 4.5 — La publication de `origin/main`

`main` est loin derrière la branche de travail — **68 commits au 04/08, davantage
depuis**. Ce n'est pas un problème technique ; c'est une décision de publication
qui n'a jamais été prise.

---

# 5 · CE QUI DÉRIVE SANS RIEN BLOQUER

Ces points n'arrêtent aucun travail. Ils s'aggravent doucement.

## 5.1 — DÉCISION · La chaîne de freinage : l'armer ou la retirer

Elle est morte de bout en bout, à une prop près. Un layer entier qui ne peut
pas s'allumer parce qu'aucun appelant ne passe la prop qui le déclenche.
Deux issues, et c'est un choix produit : l'armer, ou la retirer franchement.

## 5.2 — DÉCISION · Réveiller le socle de calcul T1bis ?

Cinq modules purs et testés dorment sans appelant. `DETTE.md` D-40 a conclu
« laisser dormir », avec un critère explicite : un module ne vaut d'être branché
que s'il **remplace** du code qui fait moins bien.

Rouvrir cette décision n'est pas une tâche de lot : brancher le socle changerait
les valeurs publiées au pilote et au coach.

## 5.3 — Deux propositions en attente, sans urgence

- `supabase/migrations/PROPOSITION_L34_realtime_seances.sql`
- `docs/PROPOSITION_POLITIQUE_8_3.md`

## 5.4 — À enquêter avant Valence, et ce n'est pas une décision

`DETTE.md` D-43 : les apex de Haute Saintonge sont posés en fraction d'**indice**
de polyline et lus en fraction de **distance**. Écart mesuré jusqu'à **371 m sur
un circuit de 2231 m**. Ce chemin tourne à la fin de chaque séance et persiste
son résultat.

Ce qui n'est **pas** établi, et qu'il ne faut pas déduire : si cette analyse est
bornée au circuit de Haute Saintonge, et ce qu'elle devient sur une séance à
Valence. À traiter comme sujet propre.

---

# 6 · DÉCIDÉ

*Les décisions rendues, avec leur date. Cette section grossit ; celles du haut
raccourcissent.*

| Date | Sujet | Décision |
|---|---|---|
| 13/08 | **Pointage et statut d'inscription** | **CORRIGÉ EN PRODUCTION** sur instruction fondateur. Un pilote pouvait faire passer son inscription en `confirmed` et se pointer présent lui-même : grant `UPDATE`, policy `own_or_admin`, et aucun trigger `BEFORE UPDATE`. Un trigger — pas un `REVOKE` — pour ne pas casser l'annulation, que le pilote provoque légitimement et qui écrit `status`. Éprouvé par exécution sous un vrai jeton pilote, dans les deux sens. |
| 13/08 | **Chaîne de freinage** | **GARDÉE et rendue fiable** — contre l'arbitrage, qui proposait de la retirer. Armée sur l'écran de triage du coach (il manquait une prop), et la détection cesse de confondre un lever de pied avec un freinage : la décélération se dérive de la distance et se compare au seuil PARTAGÉ −0,3 g. Le test qui la « prouvait » employait une trajectoire qui est physiquement un lever de pied. |
| 13/08 | **Typographie — trio du plan** | **Refus RATIFIÉ et daté du 13/08** (il s'auto-attribuait une décision du 28/07 sans trace). Söhne sous licence Klim, SF Pro réservée à Apple : motif juridique, pas esthétique. Tombera avec l'achat d'une licence. |
| 13/08 | **Typographie — consolidation** | **Inter sort** (redondance pure avec Hanken Grotesk, 66 fichiers basculent). **Michroma RESTE en attente d'un œil** : `typo.display` porte 39 écrans, dont tout REC et tout Club, et le quota de builds iOS est épuisé jusqu'au 1er septembre. Mesure faite : les 5 familles = 2 tables de jetons en parallèle, migration L6 à l'arrêt. |
| 13/08 | **`bg.card2` / contraste** | **Le fond bouge, pas le gris** — `#232630` → `#202329` (6,74 → 7,03). Relever `mid` aurait écrasé la hiérarchie des gris, employée partout ; `card2` sert à trois endroits. |
| 13/08 | **« Maintenez pour armer »** | **Sortie du rouge.** Un LIBELLÉ peut assumer 5,88, doublé par la forme et le geste ; une INSTRUCTION n'est doublée par rien. Sur fond sombre elle dépasse 12:1, et le bouton garde sa masse rouge. |
| 13/08 | **Plan V3, 5 points du flux REC** | **Le code gagne, le plan est amendé DANS le plan** — pas dans un fichier annexe. Consentement au bon moment, aucun chrono en roulage, barre masquée sur les cinq segments, « passer » hors du tiers supérieur, cardio réservé aux coachés (article 9 RGPD). |
| 13/08 | **Récupération des trames au lancement** | **Automatique.** Si une séance a perdu des trames côté serveur, ses octets sont sur le téléphone : l'application les recolle seule au démarrage, sans rien demander. Bornée à une séance par lancement, la plus récente d'abord, et aucun fichier n'est LU tant qu'un manque n'est pas établi par comptage. Un comptage impossible ne conclut rien. |
| 13/08 | **Arrière-plan BLE** | **Activé.** Les trois morceaux ensemble — `modes: ['central']`, `isBackgroundEnabled`, `restoreStateIdentifier`. Le troisième est celui qui fait fonctionner le mécanisme : sans lui, le manifeste passe la revue App Store et rien ne se produit. **Reste à vérifier au circuit** (§0.5) : aucun test ne réveille un téléphone. |
| 13/08 | **Hub PISTE** | **Adapté, pas supprimé.** Une vérification l'avait classé « code mort » ; le constat était juste dans ses effets et faux dans sa cause — il était INATTEIGNABLE, `setSessions` n'ayant aucun appelant. Le supprimer aurait effacé le seul écran qui sait reprendre un jour J à son étape. Une garde fige désormais ses entrées. |
| 12/08 | Fenêtre du radar Signature | **Tranchée en autonomie** — les 30 jours tombent, le radar lit l'historique borné (24 séances). Pour six journées de piste par an, une fenêtre d'un mois laissait le radar vide onze mois sur douze ; le plan V3 fixe d'ailleurs les effectifs du sélecteur en séances d'historique (« Signature générale · 11 séances »). La Saison reste l'objet du temps. **Réversible :** `BASELINE_MAX_SESSIONS` dans `useSignature`. |
| 12/08 | Destination du bouton central | **Tranchée en autonomie** — le Pass, sauf capture en cours. Le plan le dit deux fois (« le bouton central ouvre le Pass », « le bouton Réserver ouvre le Pass y compris quand `app_payments` est fermé »). Le câblage L0 menait à la porte Club. **Réversible :** `centralButtonRoute`. |
| 12/08 | QR de pointage — statuts éligibles | **Tranchée en autonomie**, fail-closed : `confirmed` et `attended` seulement. Une journée réservée non réglée se voit dans le Pass mais ne produit pas de code — le portail, devant la file, est le pire endroit pour l'apprendre. **Réversible :** `qrAffichable`. |
| 12/08 | Véhicule à l'armement | **Tranchée en autonomie** — le principal est pré-sélectionné ET affiché. L'attacher en silence ferait découvrir au débrief que la séance est rangée sous une voiture non choisie. |
| 03/08 | Fonction de détection des virages | Déployer et calculer |
| 03/08 | Rayon de Valence | Délégué — « je te laisse réfléchir au mieux » |
| 03/08 | La Charade | Détacher puis supprimer |
| 03/08 | Contrainte `corner_index` | Autorisée |
| 01/08 | Dépôt GitHub public | Assumé — la RLS est la seule barrière |
