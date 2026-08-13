# Point sur les jalons — 13 août 2026

*Met à jour [`BILAN_V3.md`](BILAN_V3.md) (29/07). Ce document ne le remplace pas :
le bilan du 29/07 reste le constat d'avant l'essai terrain, et c'est sa valeur.*

---

## Ce qui a changé, en une ligne

Le bilan du 29 juillet portait cette phrase :

> **Aucune séance ne porte à la fois des trames et un tour.**

Elle est fausse depuis la nuit du 13 août.

| | 29/07 | 13/08 |
|---|---:|---:|
| Trames de télémétrie | 53 | **27 052** |
| Tours | 1 (un `is_outlap` de 0,022 s) | **4** (dont 3 réels) |
| Séances portant trames **et** tours | 0 | **1** |
| Trames avec vitesse de lacet | 0 | **27 052** |
| Trames avec les deux accélérations | 0 | **27 052** |
| Séances closes | — | 11 sur 20 |
| Comptes coach | 0 | 0 |
| Instantanés météo | 0 | 0 |

La conséquence porte loin. Le bilan du 29/07 concluait :

> **toutes les mesures des jalons 1 et 4 portent sur des données synthétiques.**

Ce n'est plus vrai. Les trois tours de Bouteville — 5 875,5 / 5 873,7 / 5 874,7 m,
mesurés par deux méthodes indépendantes qui concordent à 1,4 m — sont la première
donnée réelle que cette application ait produite.

---

## Les cinq niveaux de restitution, sur la séance réelle

C'est le test le plus direct du jalon 4, et il se calcule sans rien exécuter.

| Niveau | Condition | Sur la séance du 13/08 |
|---|---|---|
| Le chrono | ≥ 1 tour chronométré | **ouvert** — 3 |
| La régularité | ≥ 3 tours | **ouvert** — 3 |
| Le delta et la trace | ≥ 2 tours comparables | **fermé** — voir ci-dessous |
| Les phases du virage | ≥ 100 trames avec lacet | **ouvert** — 27 052 |
| L'enveloppe | ≥ 100 trames avec les deux g | **ouvert** — 27 052 |

**Quatre sur cinq.** Le cinquième est fermé pour une raison qui vous revient :
`laps.distance_meters` est vide sur ces trois tours, et `compteToursComparables`
n'accepte que des longueurs strictement positives. La cause est corrigée pour
toutes les séances à venir ; celles-ci se rattrapent en une commande :

```bash
psql "$SUPABASE_DB_URL" -f scripts/sql/backfill_laps_distance.sql
```

Après quoi les cinq niveaux s'ouvrent sur une séance réelle, ce qui n'était
jamais arrivé.

---

## L'état par jalon

| | Jalon | 29/07 | 13/08 |
|---|---|---|---|
| 0 | Ce qui bloque tout | Satisfait | inchangé |
| 1 | Technique | Fait sauf T2 | inchangé — ThumbHash toujours proposé, non appliqué |
| 2 | Socle produit | Fait | inchangé |
| 3 | **Le jour J** | Logiciel fait, **terrain non vérifié, aucun build n'existe** | **Éprouvé au terrain, et il a beaucoup cassé.** Voir ci-dessous |
| 4 | La restitution | Largement fait, **sur données synthétiques** | **Sur données réelles**, 4 niveaux sur 5 ouverts · les **quatre lots « rien ne bloque » sont faits** (rampe, petits multiples, carnet, strip map) |
| 5 | Les espaces | Non commencé | **Largement fait, et je l'ai annoncé faux.** Voir ci-dessous |
| 6 | Coach | Non commencé | inchangé — zéro compte coach en production |
| 7 | Admin et partenaires | Non commencé | inchangé |
| 8 | Innovations et serveur | Non commencé | inchangé |

---

## Le jalon 5 — je vous l'ai annoncé bloqué, il ne l'était pas

Le 13 août, je vous ai écrit que le jalon 5 attendait « les sept arbitrages sur
l'arbre V1 », et que « le lot 21, soit 71 écrans et 35 488 lignes, les attend ».

**C'était faux.** L'arbre V1 n'existe plus : commit `2e52f26`, *« l'arbre V1
quitte l'application »*. `app/(app)` a disparu du dépôt. La vérification tenait
en une commande, `ls app/`, et je ne l'avais pas faite — j'avais relu
`docs/J5_ARBRE_V1.md`, qui affirmait encore que le premier blocage tenait.

C'est le motif de ce dépôt, appliqué à moi : un document relu au lieu d'être
remesuré. Les deux fichiers sont corrigés.

### L'état réel, ligne par ligne du plan

| Ligne du jalon 5 | État |
|---|---|
| Portage des sept orphelins V1 | fait |
| Recâblage des douze liens | fait |
| **Suppression de l'arbre V1** | fait — `2e52f26` |
| Écriture d'intention réhébergée | fait — `dbad829`, `CarteProchaineFois` montée dans `rec/fin` |
| Saison objet principal | fait — les cinq lectures ouvrent le hub Data |
| Véhicule principal (`is_primary`) | fait — colonne en base depuis le 12/08, index unique partiel |
| Ressenti après run | fait — `qcmLogic` + `rec/entre-runs` |
| Le carnet sort de VOUS pour Data | **fait le 13/08** — VOUS passe de sept portes à six |
| Le Club, le Pass | écrans présents (`club/index`, `club/pass`, et six autres) |
| QDI et vocabulaire technique | **reste** — la seule ligne du jalon qui n'a pas été traitée |

Ce qui reste du jalon 5 est donc **une ligne**, pas un lot de 71 écrans.

---

## Le jalon 3, et ce que le terrain a révélé

Le plan exigeait une vérification sur appareil. Elle a eu lieu. **Elle a produit
plus de défauts que les quatre semaines de lecture qui l'ont précédée.**

### Ce qui a été trouvé et réparé

| Défaut | Ce qu'il coûtait |
|---|---|
| Colonne générée `duration_seconds` écrite à la clôture | **aucune séance captée par l'app ne pouvait se clore**, jamais |
| `useFirstViewport` armé puis non attaché | l'écran Data **tuait l'application** à chaque ouverture |
| L'armement ne consultait pas la journée réservée | lancement sur le mauvais circuit |
| `laps.distance_meters` jamais écrite | le niveau « delta » **ne pouvait s'ouvrir sur aucune séance** |
| `typeof best_lap_seconds === 'number'` | **chaque séance célébrée comme record personnel** |
| `trackConditions` sans état inconnu | « Conditions sèches » **affirmé sur zéro mesure** |
| `temperature_celsius: 0` dans l'e-mail J-1 | « 0°C » envoyé aux pilotes — le zéro fabriqué nommé par la consigne |
| `totalFrames` transmis et jeté | une séance à zéro trame **ne le disait pas** |
| Bandeau de synchro lu une fois au montage | « en attente du réseau » à **chaque** fin de séance nominale |
| `.tmp` orphelin mis en quarantaine | un crash bénin → alerte permanente, sans issue |
| Reprise pouvant clore la séance en cours | garde annoncée, jamais posée |
| Liste des séances sans repli hors ligne | **écran d'erreur au retour du circuit** |
| `reimportUbxToFrames` sans appelant possible | filet de dernier recours inatteignable |

### Ce qui reste, et qui ne se lit pas

- **capture écran verrouillé** — l'arrière-plan BLE est déclaré en entier
  (`modes`, `isBackgroundEnabled`, `restoreStateIdentifier`), mais aucun test ne
  réveille un téléphone. Verrouiller l'écran, rouler dix minutes, constater ;
- **seuil réel de bascule superposition → bande** — convention à 24, mesure
  terrain toujours requise ;
- **centile 95 du rendu Saison** et **mémorisation de position au retour de
  feuille** — appareil requis, inchangés depuis le 29/07.

---

## Le motif dominant, deux semaines plus tard

Le bilan du 29/07 en listait neuf cas : *une garde existe, elle ne se déclenche
pas, et un document affirme qu'elle le fait.*

La quinzaine en a produit une dizaine de plus, tous de la même forme — et
plusieurs étaient les corrections précédentes elles-mêmes :

- la garde anti-plantage de `useFirstViewport` testait `ref.current === null`,
  **une condition qui ne peut pas être vraie sur le fil UI** ;
- le test qui la « prouvait » comparait deux positions de chaîne dans un
  fichier : il serait resté vert si la condition avait dit `=== 'bleu'` ;
- `repriseSeanceService` promettait de ne jamais tourner pendant une capture
  active ; sa seule protection était un seuil d'âge de trois heures, et
  `isCaptureSessionActive()` n'avait aucun appelant ;
- `saveWeatherSnapshot` : dix-sept colonnes, aucun appelant. La table est lue par
  quatre chemins et écrite par aucun ;
- `STORAGE_KEYS.LAST_SESSIONS` : déclarée, **vidée à chaque déconnexion**, jamais
  écrite ;
- `execAttachIntention` : le même `UPDATE` que la clôture, sans la garde que la
  clôture avait reçue pour ce motif exact ;
- `jest.config.js` cherchait `*.test.ts` : **148 écrans, jamais cherchés** — et
  un commentaire affirmait qu'ils étaient « testés manuellement en build dev ».

Ce dernier est la cause racine de tous les autres : rien, dans ce dépôt, ne
montait un composant. C'est corrigé — deux projets jest, et
[`TESTS_ECRANS.md`](TESTS_ECRANS.md) dit précisément ce que le harnais attrape
**et ce qu'il n'attrape pas**, vérifié en rétablissant le code d'avant le
correctif pour constater que les tests restaient verts.

---

## Ce qui vous revient

### Immédiat

1. **`scripts/sql/backfill_laps_distance.sql`** — ouvre le cinquième niveau sur
   vos trois tours. Vérifié par deux méthodes concordant à 1,4 m ;
2. **déployer `ritual_dispatcher`** — la fonction envoie toujours « 0°C ·
   Conditions à confirmer » aux pilotes. Le correctif est dans le dépôt, la
   fonction n'est pas déployée. Je ne l'ai pas fait : elle écrit à vos clients ;
3. **signer le Pacte de Pilotage** sur `gabinfillat@gmail.com` — jamais fait, et
   ce n'est pas à moi de cocher une case qui vous engage.

### Décisions en tête de chaîne

- **sept arbitrages** sur l'arbre V1 — le lot 21 (71 écrans, 35 488 lignes) les
  attend. Deux blocages identifiés qui ne se règlent pas en supprimant des
  fichiers ;
- **trois propositions de schéma** écrites, non appliquées, dont une destructive
  tenue par la règle 0.5 ;
- **jalon 6** — zéro compte coach en production. Rien de ce qui a été construit
  côté coach n'a jamais été vu par un coach.

### Dépendances externes, inchangées

SIRET, site, avocat, noms officiels des virages. Aucune n'a bougé depuis le 29/07.

---

## Une phrase à corriger dans le plan

Le plan de montage se termine par :

> **Rien n'a jamais tourné.** Toute affirmation sur le comportement réel est une
> lecture de code, jamais une observation.

Ce n'est plus vrai, et c'est le seul changement qui compte. Une séance a tourné,
et elle a démenti quatre semaines de lecture de code sur treize points.
