# P1 — recette sur la séance de Bouteville

*30/08/2026 · calculé sur les données réelles, pas supposé · aucune écriture*

La recette devait attendre une vraie séance. Elle existe depuis le 12 août. Ce
document dit ce que cette séance permet réellement d'afficher — écran par écran,
fiche par fiche, avec les chiffres.

---

## 1 · Les virages de Bouteville, calculés et corroborés

Bouteville était le seul circuit en base **sans aucun virage détecté**
(`corners` nul, `corners_engine_version` nul), alors qu'il porte 139 points de
tracé médian. Sans découpage en zones, la moitié de la restitution n'a rien sur
quoi s'appuyer.

### D'abord vérifier le moteur, ensuite s'en servir

J'ai porté `circuitGenerator.generateCircuit` avec `PARAMS_CENTERLINE`
(`smoothWin 0`, `resampleStep 10`, `cornerRadius 100`) et je l'ai fait tourner
sur **Haute Saintonge**, dont les virages sont déjà en base :

```
MON PORT : 1/right/0.0909  2/left/0.197  3/left/0.2879  4/left/0.3636
           5/right/0.5606  6/right/0.6515  7/right/0.803  8/right/0.9545
EN BASE  : 1/right/0.0909  2/left/0.197  3/left/0.2879  4/left/0.3636
           5/right/0.5606  6/right/0.6515  7/right/0.803  8/right/0.9545
```

**Huit sur huit, sens et position identiques.** Longueur calculée 2 208 m contre
2,21 km déclarés. Le port est fidèle ; ce qu'il dira de Bouteville est ce que la
fonction serveur écrira.

### Bouteville — douze virages

139 points bruts → 128 après rééchantillonnage. Longueur calculée **5 902 m**,
déclarée 5 910 m, mesurée sur les trois vrais tours **5 874 m**. Les trois
concordent à 0,6 % près.

| Virage | Sens | Rayon | Position | V min réelle | V avant | Trames |
|---|---|---|---|---|---|---|
| 1 | gauche | 36 m | 4,7 % | 38,6 | 60,9 | 487 |
| 2 | gauche | 48 m | 14,1 % | 48,9 | 69,6 | 963 |
| 3 | droite | 84 m | 25,8 % | 55,8 | 88,8 | 395 |
| 4 | droite | 12 m | 35,9 % | **12,2** | 81,9 | 897 |
| 5 | gauche | 79 m | 40,6 % | 58,0 | 69,6 | 409 |
| 6 | droite | 33 m | 50,0 % | 58,2 | 85,3 | 668 |
| 7 | gauche | 40 m | 55,5 % | 57,0 | 79,2 | 154 |
| 8 | droite | 33 m | 71,1 % | **7,8** | 94,0 | 957 |
| 9 | gauche | 26 m | 79,7 % | 34,0 | **106,3** | 598 |
| 10 | droite | 14 m | 84,4 % | 26,0 | 86,1 | 836 |
| 11 | gauche | 46 m | 90,6 % | 50,6 | 74,6 | 417 |
| 12 | gauche | 95 m | 97,7 % | 53,3 | 70,3 | 139 |

**Les douze sont corroborés par la trace réelle.** Dans chacun, la vitesse
minimale est inférieure à la vitesse d'approche, et l'ordre suit globalement le
rayon : les deux plus serrés (12 m et 14 m) sont deux des trois passages les plus
lents. Ce ne sont pas douze nombres produits par un algorithme — ce sont douze
endroits où le pilote a réellement ralenti.

### Deux réserves, dites tout de suite

**Le virage 6 ne tient pas la physique.** 58,2 km/h sur un rayon annoncé de 33 m
demanderait 0,81 g latéral, alors que le maximum mesuré sur toute la séance est
de 0,62 g. Le rayon y est sous-estimé — le tracé médian a un point tous les 46 m
à Bouteville, ce qui est grossier. À recaler sur la trajectoire réelle, pas sur
le tracé.

**Cette séance n'est pas une séance de piste.** Deux passages descendent à 7,8 et
12,2 km/h après des approches à 94 et 82 km/h : ce sont des arrêts, pas des
virages. C'est une boucle routière de 5,9 km, roulée de nuit (23 h 35 – 23 h 54).
Elle valide la chaîne de bout en bout, ce qui est précieux. **Elle ne doit pas
servir à calibrer un seuil de piste** — le QDI en particulier.

---

## 2 · Les cinq niveaux de restitution sont tous ouverts

`etatNiveau` calculé sur les faits de la séance :

| Niveau | Condition | Bouteville | État |
|---|---|---|---|
| Le chrono | ≥ 1 tour chronométré | 3 | **ouvert** |
| La régularité | ≥ 3 tours | 3 | **ouvert** (au seuil exact) |
| L'écart entre vos tours | ≥ 2 tours comparables | 3 | **ouvert** |
| Les phases du virage | ≥ 100 trames avec lacet | 26 999 | **ouvert** |
| Les appuis de la voiture | ≥ 100 trames avec accélérations | 26 999 | **ouvert** |

**Les cinq. Aucun état vide sur l'échelle de lecture.** C'est la première fois
que cela peut se dire d'une séance réelle.

La régularité passe *au seuil exact* : un tour de moins et elle se serait fermée.
À Bouteville le 19/09, viser au moins cinq tours.

---

## 3 · Ce que le moteur de composition rendrait, calculé

Entrées réelles du compte : **9 séances · 5 journées · 3 circuits · 0 coach ·
0 présentation déjà ouverte · 2 runs le 12/08**.

D'où : `plafondNiveau = 2` (preuve) et `cartesParDefaut = 5`.

**27 fiches composables sur 65. 38 écartées, chacune avec son fait.**

### Les cinq cartes du débrief

| | Fiche | Rôle |
|---|---|---|
| 1 | **P09 · Réussite du run** | réussite |
| 2 | **P16 · Meilleur passage répétable** | réussite |
| 3 | **P50 · Album des forces** | réussite |
| 4 | **P10 · Opportunité principale** | opportunité |
| 5 | **P08 · Verdict du run** | autre |

Trois réussites avant l'opportunité, une seule opportunité. **Le §00 est tenu
mécaniquement, sans que personne n'ait à y penser** — c'est l'ordre que
`RANG_ROLE` produit, pas une mise en scène.

Cinq fiches d'avant-run s'ouvrent en plus (P03 à P07), sur leur propre écran.

### Dix-sept fiches à un geste

P11, P13, P15, P17, P18, P19, P20, P21, P24, P25, P26, P27, P28, P29, P30, P31,
P49 — toutes disponibles, toutes hors budget de cartes. Elles sont dans la liste,
elles s'ouvrent d'un toucher, et le motif le dit.

### Les trente-huit écartées, par cause

| Nombre | Cause | Fiches |
|---|---|---|
| 16 | surface coach ou Lab | P33 P34 P41 P42 P45 P55–P65 |
| 5 | pas de consigne du coach | P22 P37 P39 P43 P44 |
| 4 | aucun coach rattaché | P35 P36 P40 P54 |
| 4 | aucun acquis validé | P46 P47 P48 P51 |
| 2 | pas de ressenti nommé | P23 P52 |
| 2 | pas de vidéo | P32 P53 |
| 2 | une seule zone à la fois | P12 P14 |
| 1 | pas d'intention | **P01** |
| 1 | santé de la chaîne non relevée | P02 |
| 1 | pas de repère de piste | P38 |

**Treize des trente-huit tiennent au coach** (consigne, rattachement, acquis).
Sur un compte sans coach, c'est correct. Devant une écurie professionnelle, c'est
un tiers du catalogue qui ne s'ouvrira pas au Mans, et il faut le savoir avant de
promettre un passeport de compétences.

---

## 4 · Le défaut que ce calcul a révélé

**P01 « Objectif du run » est écartée faute d'intention. Or l'intention existe.**

`session_intentions` porte une ligne, écrite le 12/08 sur le circuit de
Bouteville, qui commence par *« Officiellement la première session effectuée sur
OXV… »*. Son `session_id` est **nul** : elle est rattachée au circuit, pas à la
séance.

Le pilote a donc écrit son intention, elle est en base, et le moteur ne peut pas
la voir. Une ligne à rattacher, et P01 s'ouvre — et avec elle la boucle complète
du §05.A : *« le pilote parle avant que la donnée ne lui dise quoi penser »*,
puis la donnée répond à ce qu'il a écrit.

C'est exactement ce qu'une recette est censée trouver.

---

## 5 · Ce qu'il faut faire, dans l'ordre

1. **Lancer `detect-circuit-corners` sur Bouteville.** Un appel. Le résultat
   attendu est le tableau du §1 : douze virages, 5 902 m. S'il diffère, c'est
   mon port qui a tort et il faut le dire.
2. **Rattacher l'intention du 12/08 à la séance** (`session_id`), ou décider que
   les intentions se rattachent au circuit et adapter le moteur. La première est
   plus simple et plus juste.
3. **Ouvrir les dix écrans** que le §3 annonce, et noter pour chacun ce qui
   s'affiche réellement. Le calcul dit ce qui *devrait* apparaître ; seule
   l'ouverture dira si c'est le cas.
4. **Recaler le virage 6** sur la trajectoire réelle plutôt que sur le tracé.
5. **Ne pas calibrer le QDI sur cette séance.** Elle est routière.

---

## 6 · Ce que cette recette prouve déjà

Avant Le Mans, sur une séance réelle : la chaîne de capture tient la milliseconde,
les tours se ferment à deux mètres près, le découpage en zones tombe sur des
ralentissements réels, les cinq niveaux de lecture s'ouvrent, et le moteur de
composition rend cinq cartes dans l'ordre exact que la doctrine demande.

Ce qui manque n'est pas le calcul. C'est **l'écran qui le montre** — et les
modules qui le feraient sont écrits, testés, et dormants.
