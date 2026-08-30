# Lots L1 à L9 — ce qui reste à développer sur l'application

*30/08/2026. Trouvés en lisant le dépôt et la base, pas en imaginant des besoins.
Chaque lot porte le fait qui le motive.*

> **Numérotation.** Ces lots sont notés **L**, et non **P**, pour ne pas entrer en
> collision avec les paquets `P0` à `P8` du plan v5 (`reference/`), où `P5` à `P8`
> désignent déjà quatre autres travaux. **L6** est le seul qui recoupe le plan :
> il fournit la source de données que son `P5` — le bandeau de santé de la chaîne —
> consommera.

---

## L1 · Réconcilier le nombre de virages — **bloquant pour Le Mans**

**Le fait.** Le système porte aujourd'hui **quatre comptes différents** pour la
même chose :

| Source | Compte | Où |
|---|---|---|
| L'application | **7 virages** | `BELTOISE_CORNERS`, générateur de courbure |
| Le moteur serveur de référence | **13 virages** | minima de vitesse |
| Le détecteur sur Bouteville | **12 virages** | `corners-v1` |
| Haute Saintonge : déclaré / détecté | **7 / 8** | `turns_count` vs `corners` |

L'en-tête de `sessionInsightsEngine` le dit lui-même : *« leur réconciliation est
un calibrage post-Valence (données réelles requises) »*. **Les données réelles
sont là depuis le 12 août.**

**Pourquoi c'est bloquant.** Toute la restitution par zone en dépend : un coach
qui annote « le virage 9 » désigne deux endroits différents selon qui regarde.
Devant une écurie professionnelle, c'est le genre d'incohérence qui se voit en
une minute.

**Le geste.** Choisir **une** source de vérité — je recommande le détecteur, parce
qu'il est le seul qui fonctionne sur un circuit inconnu, donc le seul qui marchera
au Bugatti — et faire dériver les autres de celle-là. Puis retirer les sept
virages câblés.

**Recette.** Un même circuit rend le même compte à l'écran, en base et dans les
insights. Test qui échoue si les trois divergent.

---

## L2 · Valider le chemin d'enregistrement autonome — **maintenant, pas le 19**

**Le fait, et c'est une chance.** Le fichier brut de la séance de Bouteville
**existe** : `telemetry_raw/…/ff384ace….ubx`, **2,30 Mo**, déposé le 12/08. À
88 octets par message, cela fait **environ 27 400 messages** — cohérent avec les
26 999 trames en base.

Autrement dit : **pour une même séance, vous avez le flux brut ET les trames
importées en direct.** C'est exactement le jeu d'essai dont
`reimportUbxToFrames` a besoin.

**Pourquoi c'est le lot le plus important de cette liste.** La méthode du Mans
est : le boîtier enregistre seul dans la cabine, on le récupère entre les
séances, on vide sa mémoire (~4 min 40), on importe. **Si ce chemin n'a jamais
tourné de bout en bout sur une vraie séance, toute la méthode repose sur du code
non éprouvé** — et vous le découvririez le 26 septembre, seul, dans un paddock.

**Le geste.** Rejouer le `.ubx` de Bouteville par `reimportUbxToFrames` sur une
séance neuve, puis comparer trame à trame **par `itow_ms`**, qui est l'identité
physique. Trois questions, trois réponses chiffrées :

1. Combien de trames le réimport produit-il, contre 26 999 ?
2. Combien d'`itow_ms` coïncident exactement ?
3. Les tours détectés sont-ils les mêmes — 360,485 / 327,542 / 339,483 ?

**Une demi-journée. Elle vaut le week-end.**

---

## L3 · La typographie et les tailles — voir l'étude de lisibilité

**Le fait.** Mesuré contre `ISO 9241-303`, à 600 mm : les mots-clés de la maquette
sont à **7,3′ à 12,3′**, pour un plancher à **16′**. Les nombres, eux, sont à
28-45′. **La maquette rend les nombres lisibles et le sens illisible** — or la
règle des mots-clés fait des mots-clés le contenu.

**Le geste, en trois temps.**
1. Remonter les mots-clés à 21 pt (plancher) et 26-29 pt (cible).
2. **Couper.** Voir la feuille B de l'étude : trente-quatre valeurs deviennent
   douze. La contrainte de taille est une contrainte éditoriale déguisée.
3. Trancher la fonte sur cinq critères, dont deux éliminatoires : axe **`GRAD`**
   (corrige l'irradiation sur fond sombre sans décaler les chasses) et **chiffres
   tabulaires**.

**Ce qui est acquis** : le fond sombre reste. En forte lumière ambiante, l'effet
de polarité disparaît (Dobres 2017). Il se paie en taille, pas en couleur.

---

## L4 · Découper `app/(app2)/data/session/[id].tsx`

**Le fait. 165 026 octets dans un seul fichier d'écran.** C'est le consommateur
unique des six lectures approfondies, et c'est l'écran que L3 touche le plus.

**Pourquoi maintenant.** Remonter les tailles et couper des valeurs dans un
fichier de 165 Ko est un travail à l'aveugle. Le découper d'abord rend L3
faisable ; l'inverse n'est pas vrai.

**La garde qui protège** : `deuxEntrees`. Chaque morceau extrait doit avoir deux
appelants réels, sinon il entre dans la liste des orphelins avec sa raison.

---

## L5 · Les espaces sans aucun test

**Le fait, tiré du bilan.** `partnerService`, `adminUsersService`,
`coachAdminService`, `attendanceService`, `b2bReportService`, `eventsService` :
**zéro test**. Les 837 tests verts ne couvrent pas ces espaces — soit
**44 écrans et environ 13 100 lignes**.

**Ce que ça veut dire.** L'espace pilote est tenu par des gardes ; l'espace
commercial ne l'est par rien. Or c'est celui qui facture.

**Le geste, borné.** Pas une campagne de tests. **Un test par service, sur le
chemin qui prend de l'argent ou qui donne un droit** : créer une facture,
valider une inscription, changer un rôle. Six tests. C'est le minimum qui
transforme une régression silencieuse en une régression bruyante.

---

## L6 · La santé de la chaîne n'a aucune source

**Le fait.** `devices` : **0 ligne**. `device_health_logs` : **0 ligne**. Les
tables existent depuis la migration `admin_quality_data_and_devices`, et rien
n'écrit dedans.

**Conséquence.** Le bandeau de santé de la chaîne (L1 du plan v5) affichera un
état vide honnête — et rien d'autre — tant que la capture n'y écrira pas. Et la
sonde sonore de santé, si vous l'ouvrez, n'aura rien à sonifier.

**Le geste.** Enregistrer le boîtier comme `device` au premier appairage, et
écrire une ligne de santé à chaque changement d'état de liaison — pas à chaque
trame. `onCaptureLinkStatus` existe déjà et porte l'événement.

---

## L7 · Sept drapeaux, tous éteints

**Le fait.** `app_feature_flags` porte sept clés, **toutes à `false`** :
`video_overlay`, `biometry`, `app_payments`, `coach_billing`, `convoys`,
`founders`, `pilot_waivers`.

Deux méritent une question. **`founders = false`** alors que l'objectif est de
trente Membres Fondateurs. **`pilot_waivers = false`** alors qu'une table de
signatures de décharge existe et a été durcie par une migration dédiée.

**Le geste.** Pour chacun des sept : *branché, ou retiré, ou daté*. C'est la règle
« jamais dormir sans le dire », appliquée aux drapeaux comme elle l'est aux
modules. Un drapeau éteint sans date est du code mort avec un interrupteur.

---

## L8 · Le hors-ligne au paddock

**Le fait.** `src/services/offlineQueue.ts` existe. Le réseau d'un paddock aux
24 Heures Camions ne ressemble à aucun réseau de bureau : saturé, intermittent,
avec des trous complets sous les tribunes.

**Ce qui n'est pas éprouvé.** Que se passe-t-il si l'on note une observation au
camion, hors réseau, et que l'application est tuée avant la synchronisation ?
C'est le scénario exact de l'idée retenue I-3 — les notes libres saisies dans
l'application — et **la seule trace du verbatim du pilote disparaîtrait**.

**Le geste.** Un test qui coupe le réseau, écrit une note, tue le processus, le
relance, et vérifie que la note est là.

---

## L9 · L'autonomie, jamais mesurée

**Le fait.** La capture tient une liaison BLE en arrière-plan à 25 Hz, avec
`keep-awake` armé, pendant deux heures ou plus. Personne n'a mesuré ce que cela
coûte au téléphone.

**Pourquoi c'est un risque de terrain et pas un détail.** Au Mans vous serez
seul, avec un téléphone qui sert aussi à téléphoner. Une batterie à plat en fin
de journée efface la dernière séance.

**Le geste.** Une mesure, une fois : batterie au départ, batterie à l'arrivée,
sur les deux heures de la répétition du 19/09. Si la consommation dépasse 40 %,
la batterie externe entre dans la liste de matériel.

---

## L'ordre, et ce qui passe avant Le Mans

| Lot | Coût | Avant Le Mans |
|---|---|---|
| **L2** · Valider le chemin `.ubx` | 1/2 j | **oui — c'est la méthode du week-end** |
| **L1** · Réconcilier les virages | 1 j | **oui — visible en une minute** |
| **L3** · Tailles et fonte | 1,5 j | **oui — c'est ce qu'on regardera** |
| L6 · Source de la santé de chaîne | 1/2 j | oui, si le bandeau est monté |
| L9 · Mesure d'autonomie | 0 j | oui, pendant la répétition du 19/09 |
| L8 · Hors-ligne | 1 j | oui, les notes en dépendent |
| L7 · Inventaire des drapeaux | 2 h | oui, c'est du ménage |
| L4 · Découper l'écran de 165 Ko | 2 j | seulement s'il bloque L3 |
| L5 · Six tests sur l'espace commercial | 1 j | après Albi |

**Le seul que je défendrais contre tous les autres, c'est L2.** Le reste améliore
le produit. Celui-là décide si le week-end du Mans produit une donnée ou une
leçon.
