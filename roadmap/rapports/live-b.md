# Rapport de lot — LIVE-B · Tableau de marche, Meta Display, multi-live

Branche `feat/site-document-emails` · 25 juillet 2026 · variante **A** (décision fondateur)

---

## La décision qui ouvre le lot

Le lot était bloqué par une **gate juridique absolue** : deux variantes d'écran TV
étaient spécifiées, et rien ne pouvait démarrer avant que Gabin en active une.

Il a tranché pour la **variante A — le tableau de marche** : liste ordonnée par
**numéro de voiture**, jamais par chrono. Aucun rang, aucun tri par performance,
aucune couleur de podium.

Ce n'est pas une préférence esthétique. Un classement compétitif peut
**requalifier juridiquement** un track day en compétition, avec ce que cela
emporte d'assurance et de réglementation. La variante B existe dans la spec ;
elle reste derrière une constante `BOARD_MODE` dont la valeur par défaut est `A`,
et un test échoue si quelqu'un la bascule.

À noter, parce que la confusion serait facile : la validation d'avocat obtenue le
même jour portait sur l'**annexe A** (consentement biométrie). Le classement
relève du **§1** du dossier. Ce sont deux sujets distincts.

---

## Ce qui a été livré

### Livrable 1 — le canal du tableau de marche

`stripHealth` gagne son **premier appelant en production**. C'est un point qui
mérite d'être dit franchement : jusqu'ici ce garde-fou était écrit et testé, mais
aucun code ne l'appelait — sa liste blanche visait ce lot-ci. Elle couvre
désormais les champs publiables, et le payload du board est sa **sortie
exclusive**.

La barrière est **infranchissable par construction** : `openBoardBroadcast.send`
n'accepte que le type de sortie de `stripHealth`. On ne *peut pas* émettre un
payload brut sur le canal public — le compilateur le refuse. Une clé de santé
ajoutée demain ne fuite pas tant qu'elle ne figure pas explicitement dans la
liste.

`boardLogic` (pur, 20 tests) porte le reste : chronos `null` plutôt que zéro
quand aucun tour n'est bouclé, pas d'émission sans pseudo publiable (l'état civil
n'a rien à faire sur un écran que tout le paddock regarde), throttle à 1 Hz, et
l'invariant anti-classement verrouillé par un jeu où l'ordre chronométrique
**contredit** l'ordre par numéro.

### Livrable 3 — la vue Meta Display

L'écran `ar.tsx` existait mais ne s'abonnait à aucun flux. Il suit maintenant le
direct, en trois lignes strictes pensées pour un verre : pilote, chrono du tour en
cours, et fréquence cardiaque si elle est partagée. La FC a sa place ici : c'est
le canal **coach**, pas le board.

### Livrable 4 — le multi-live

Le roster coach s'ordonne par numéro de voiture, et **affiche ce numéro** : un
ordre dont on ne voit pas la clé se lirait comme un classement.

Le numéro voyage par la **présence**, pas par le canal board. C'est un choix
assumé : la présence porte déjà l'identité (prénom, circuit), un numéro de voiture
en est une au même titre — celle qu'on lit du bord de piste. Rien à voir avec la
fréquence cardiaque, mesure de santé qui, elle, reste hors de la présence.

---

## Ce que la vérification adversariale a trouvé

22 agents, quatre lentilles, chaque constat soumis à un réfuteur. **Quatre défauts
confirmés, tous corrigés.**

### Le plus grave — un canal public qui survivait à la séance

`startPilotLiveRelay` est asynchrone et enchaîne quatre requêtes **avant**
d'installer son mécanisme d'arrêt. Si la capture s'arrêtait pendant ces attentes,
`stopPilotLiveRelay` ne trouvait rien à couper — puis le démarrage en vol
terminait sa course et ouvrait les canaux, dont celui du tableau de marche. Plus
personne ne les fermait : **le canal public aurait continué à diffuser après la
fin de la séance**.

Corrigé par un compteur de génération : tout arrêt invalide les démarrages en vol,
qui se démontent eux-mêmes au lieu de publier.

### Le miroir Meta ne pouvait jamais être en direct

Son sélecteur ne proposait que des séances **terminées** (`listPilotSessions`
filtre sur `status = 'completed'`). S'y abonner ne pouvait produire aucun direct.
Il suit désormais le roster de présence, seule source d'une séance vivante.

Pire : son « dernier tour » lisait la table `laps`, qui n'est écrite qu'à la
**clôture** de la capture. En séance elle est vide — ou remplie par une séance
antérieure. Un chrono d'hier était présenté au coach comme le tour qui venait de
passer. Remplacé par le chrono du tour en cours, porté par la trame elle-même.

### Le roster mentait sur son propre ordre

Sur téléphone, la liste n'était pas triée par numéro alors que l'écran affichait
la mention l'affirmant : la variable triée était calculée puis ignorée.

### Un commentaire qui promettait une protection inexistante

Il attribuait au canal de présence un filtrage `stripHealth` qui ne s'y exécutait
pas. Corrigé : la protection y est **structurelle** (aucune FC n'est écrite dans
la présence), pas le fait d'un filtre à l'exécution.

*Écartés après réfutation* : `BOARD_MODE` inutilisé, un-canal-une-voiture, santé
imbriquée sous une clé blanche, RLS `board_recv`, périmètre du consentement.

---

## La migration, et ce qu'elle refuse de faire

`board_recv` / `board_send` sont **appliquées en production**, restreintes à
`authenticated`, vérifiées après coup.

Le cahier voulait ouvrir la lecture « à tout inscrit de la journée ». Cette
ouverture **n'est pas écrite**, et c'est délibéré : le lien n'existe pas au
schéma. Une séance de télémétrie ne référence aucune journée de roulage, et
`event_id` n'est jamais renseigné à la capture. Rapprocher les deux par circuit et
date aurait été une **devinette** — on n'écrit pas une règle d'accès sur une
devinette, et un `circuit_id` nul aurait ouvert la règle en grand.

L'audience retenue est donc la plus étroite défendable : le pilote propriétaire et
les coachs de son binôme consenti — soit **exactement celle du canal coach**.
Conséquence importante : **rien de nouveau n'est exposé aujourd'hui**.

---

## Ce qui reste

**L'écran TV n'existe pas.** Le Livrable 2 (`/board/<sessionId>`) vit dans le
repo `oxv-site`, pas ici. Sans lui, aucun écran de paddock n'est servi.

**Deux décisions vous appartiennent :**

1. **Le chaînon séance → journée.** Une colonne
   `telemetry_sessions.day_session_id` vers `public.sessions` suffirait : le reste
   de la brique existe déjà (`is_registered_for_session`, SECURITY DEFINER, déjà
   utilisée par les convois). Sans elle, le tableau de marche restera lisible par
   le seul binôme.
2. **Le compte de service du téléviseur.** Un écran de paddock n'est pas un
   utilisateur authentifié. Il lui faut son propre chemin d'autorisation, à écrire
   le jour où ce compte existe.

**Preuves** : `tsc` 0 · `jest` 1785 (+32 pour ce lot) · `eslint` 0 · policies
vérifiées en base · aucun fichier de capture cardinal touché.

**Non tenu** : le test réel à deux téléphones et un navigateur TV, et les captures
d'écran de la variante A. Ils demandent du matériel et un écran de paddock —
c'est-à-dire le Livrable 2 et le terrain.
