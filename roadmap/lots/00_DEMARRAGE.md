# Démarrage Claude Code — OXV Mirror

*30/08/2026. Ce fichier est le point d'entrée. Lisez-le en entier avant
d'ouvrir un autre document.*

---

## En une minute

Le dépôt `oxv-app` est plus avancé que ne le disent les plans qui l'ont précédé.
Une **vraie capture existe** depuis le 12 août, **quarante modules sont écrits,
testés et dormants**, et **cinq manques signalés dans ce dossier existaient
déjà**. Le travail des quatre prochaines semaines est donc surtout du
**branchement**, pas de l'écriture.

L'échéance est le **26 septembre au Mans**, devant une écurie professionnelle
qui n'a ni télémétrie, ni ingénieur, ni donnée. Le point de non-retour est la
répétition de **Bouteville le 19 septembre**.

---

## Ce qu'il faut faire, dans l'ordre

| Lot | Fichier | Ce que c'est | Statut |
|---|---|---|---|
| **CLAUDE.md** | `CLAUDE.md` | À copier à la racine du dépôt. Lu à chaque session | prêt |
| **P0** | `10_P0_Qualite_et_Cap.md` · `11_P0_A_Coller.md` | Trois champs de qualité + la règle du cap | prêt à coller |
| **P1** | `20_P1_Recette_Bouteville.md` | La recette sur la séance réelle | prêt |
| **P2** | `30_P2_Circuits.md` | Bouteville, le Bugatti, Albi | **bloqué : 2 identifiants OSM** |
| **P3** | `40_P3_Ecrans.md` | Le lot des écrans — le plus gros | prêt |
| **P4** | `50_P4_MotsCles.md` | Les quarante mots-clés | prêt à coller |
| **L1–L9** | `60_Autres_Lots.md` | Virages, chemin `.ubx`, tailles, tests, drapeaux, hors-ligne, autonomie | prêt |
| **Design** | `design/` | Étude, recherche mesurée, comparaison de lisibilité | prêt |

Les spécifications d'interface sont dans `specs/` (blocs A à G). Le contexte,
les mesures et le journal des décisions sont dans `reference/`.

---

## La première session, concrètement

**1. Poser le brief.** Copier `CLAUDE.md` à la racine de `oxv-app`. Se placer sur
`migration/sdk-55`.

**2. Ouvrir P0 et coller `11_P0_A_Coller.md`.** Trois fichiers, chaînes exactes,
aucun chiffre affiché ne bouge. C'est le lot le plus sûr du dossier, et il rend
décidable la question du cap avant Bouteville.

**3. Puis P1, qui n'est pas du code.** Ouvrir chaque écran dépendant de
`telemetry_frames` sur la séance `ff384ace-d6ce-414b-8338-cef030218ee0` et écrire
ce qu'il affiche réellement. Le document dit ce qui *devrait* apparaître —
douze virages, cinq niveaux ouverts, vingt-sept fiches composables, cinq cartes
de débrief nommées. **Tout écart entre le calcul et l'écran est le vrai sujet de
la session.**

**4. Puis L2, qui vaut le week-end.** Le fichier brut de Bouteville
(`telemetry_raw/…/ff384ace….ubx`, 2,30 Mo) **et** ses 26 999 trames existent pour
la même séance. Rejouer le brut et comparer par `itow_ms` valide, aujourd'hui, la
méthode entière du Mans — le boîtier enregistre seul, on vide sa mémoire, on
importe. Une demi-journée.

**5. Ensuite P3 et P4 en parallèle**, si vous êtes deux. Sinon P3 d'abord : il
porte le calendrier. L1 et L3 avant Le Mans.

---

## Les trois règles de ce dossier

**1. Chercher avant d'écrire.** Cinq manques signalés, cinq déjà couverts par le
dépôt. Avant toute fonction : `modulesOrphelins.guard.test.ts`,
`registrePresentations.ts`, la liste des fonctions edge. **Ne nommez jamais un
défaut sans citer sa garde.**

**2. Une garde rouge arrête le travail.** On ne la contourne pas, on ne
l'ajoute pas à une liste d'exclusions. Si elle gêne, c'est la conception qu'on
rediscute.

**3. Quand la spécification se trompe, corrigez-la et dites-le.** Les blocs C et
F ont déjà été réécrits après lecture du dépôt. Les autres peuvent porter les
mêmes erreurs.

---

## Ce qui attend une décision du fondateur

Ne contournez aucune de ces trois par une hypothèse.

| Sujet | Ce qu'il bloque | Butée |
|---|---|---|
| **Filtrage du signal inertiel** | `fluidité 0` et `accélération 0` devant un pilote professionnel. Diagnostic fait et chiffré ; le geste implique un incrément de `QDI_ALGO_VERSION` et un recalcul de l'historique | 19/09 |
| **Identifiants OSM** du Bugatti et d'Albi | Les deux circuits en base, donc P2 entier | 05/09 |
| **Débrief IA** : opt-out ou opt-in | Le comportement par défaut au Mans | 25/09 |

## Trois gestes en base, à faire une fois

1. **`detect-circuit-corners` sur Bouteville.** Un appel. Le résultat attendu est
   dans `30_P2_Circuits.md` — douze virages, 5 902 m.
2. **Rattacher l'intention du 12/08 à sa séance** (`session_intentions.session_id`
   est nul). Sans cela P01 reste écartée alors que le pilote a écrit son
   intention.
3. **Supprimer la ligne `mirror-insights-demo`** de `session_insights`.
   L'application ne la voit pas — trois filtres — mais elle est le seul contenu
   de la table, donc visible de tout ce qui la lit hors du service.

---

## Les chiffres à connaître par cœur

**La séance de référence.** `ff384ace-d6ce-414b-8338-cef030218ee0` — Bouteville,
12/08/2026, 26 999 trames à 25,0 Hz, trois tours : 360,485 · **327,542** ·
339,483 s, pour 5 875 · 5 874 · 5 875 m. 100 % de fixes valides, 15,4
satellites, 0,23 m. Gyroscope et trois G sur chaque trame. Les cinq niveaux de
restitution y sont ouverts.

**Ce qui manque dans cette séance.** `heading` nul sur 100 % des trames.
`heading_accuracy`, `speed_accuracy`, `pdop` jamais écrits. QDI : trajectoire 97,
régularité 34, freinage 7, **fluidité 0, accélération 0**.

**Sa limite.** C'est une boucle **routière**, roulée de nuit, avec deux arrêts à
7,8 et 12,2 km/h. Elle valide la chaîne de bout en bout. **Elle ne calibre pas un
seuil de piste.**

---

## Ce que le produit refuse de faire

Il ne conseille pas, il ne classe pas, il n'explique pas. **Il montre.**

OXV n'est pas agréé pour l'enseignement du pilotage. Cette retenue n'est pas un
style : c'est ce qui autorise l'outil à entrer dans la cabine d'un professionnel.
Tout le reste — les gardes, le lexique proscrit, la règle des mots-clés, le
refus du tour idéal — en découle.
