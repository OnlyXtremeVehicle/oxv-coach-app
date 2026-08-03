# T1 — Socle de rendu : le registre

> Livrable d'acceptation réclamé par `OXV_Mirror_V3_Plan_Montage.md:136` et
> `OXV_Mirror_V3_Dossier_Travail_v3.md:1332`. Il manquait depuis la livraison du
> lot. Écrit le 03/08/2026.
>
> Ce n'est pas un rapport. C'est un constat : ce que les cinq modules font, ce
> qu'ils coûtent, ce qu'ils pèsent, et ce qu'on ne sait pas d'eux.

---

## Ce que le plan exigeait, et ce que ce document peut en tenir

| Exigence | État |
|---|---|
| Mesures réelles par module **sur appareil** | **Non tenue.** Mesures sous node, sur poste. Voir plus bas. |
| Poids ajouté au binaire | **Tenue** — et la réponse est zéro. Voir plus bas. |
| Ce qui n'a pas tenu le budget de 16,66 ms | **Indéterminable** aujourd'hui. Voir plus bas. |
| Écran de démonstration jetable dans `dev-galerie` | **Non fait.** `dev-galerie.tsx` n'importe rien de `src/render`. |

Le plan posait lui-même une réserve, et elle vaut toujours : *« Aucune donnée
réelle n'existe pour valider ces modules : les mesures porteront sur des données
synthétiques, à dire explicitement. »* C'est dit.

---

## LE FAIT QUI COMMANDE TOUT : aucun module n'est branché

Au 03/08/2026, **aucun fichier de `app/` ou de `src/` n'importe `src/render/*`.**
La seule occurrence du chemin dans l'arbre vivant est une ligne de commentaire.

Ce n'est pas un oubli, c'est une décision, prise après enquête le même jour et
consignée en `docs/DETTE.md` D-40 : neuf modules orphelins ont été examinés, et
neuf verdicts « à brancher » sont tombés. Aucun ne remplace du code existant qui
ferait moins bien. Les brancher demanderait de leur inventer un consommateur.

**Un module pur, testé, sans consommateur est un actif — à condition que rien
n'affirme le contraire.** Ce document est là pour que la condition soit tenue.

---

## Poids ajouté au binaire : zéro

Metro n'embarque que ce qui est atteignable depuis le point d'entrée. Aucun de
ces cinq fichiers ne l'étant, **ils n'ajoutent pas un octet au binaire livré**.

C'est une réponse exacte, et elle est provisoire par nature : elle deviendra
fausse le jour où un écran importera l'un d'eux. Le chiffre à connaître ce
jour-là est la taille source, qui borne la contribution :

| Module | Lignes |
|---|---|
| `projection.ts` | 182 |
| `ramp.ts` | 194 |
| `gg.ts` | 187 |
| `ribbon.ts` | 155 |
| `decimate.ts` | 116 |
| **Total** | **834** |

Aucune dépendance externe. Aucun `import` hors du lot, sauf `decimate` et
`ribbon` qui lisent `projection`.

---

## Mesures — et ce qu'elles ne valent pas

**Conditions.** node 24, poste de développement Windows, `tsx`, données
synthétiques. Entrée : un tour de 100 s à 25 Hz, soit **2500 points** — l'ordre
de grandeur que produira le RaceBox Mini. Médiane et 95ᵉ centile sur 100 à 500
répétitions, après chauffe.

| Opération | médiane | p95 |
|---|---|---|
| `buildProjection` (2500 pts) | 0,054 ms | 0,705 ms |
| `project` × 2500 | 0,096 ms | 0,490 ms |
| `decimate` (2500 pts) | 0,211 ms | 0,766 ms |
| `traceLength` (2500 pts) | 0,097 ms | 0,271 ms |
| `buildRamp` (3 arrêts) | 0,003 ms | 0,019 ms |
| `ramp.at` × 2500 | 0,240 ms | 0,488 ms |
| `buildRibbon` (1877 pts décimés) | 1,636 ms | 3,418 ms |
| `buildRibbon` (2500 pts bruts) | 1,937 ms | 4,038 ms |
| `buildGgCloud` (2500 échantillons) | 0,110 ms | 0,269 ms |

**CES CHIFFRES NE SONT PAS UN BUDGET D'IMAGE.** Trois raisons, et aucune n'est
un détail.

D'abord, ce n'est pas l'appareil. Un iPhone sous Hermes, avec un throttling
thermique après vingt minutes de piste au soleil, ne se déduit pas d'un poste de
bureau. Le plan demandait Flashlight sur appareil réel, et il avait raison.

Ensuite, la dispersion est large. Deux exécutions successives ont donné 1,22 ms
puis 1,64 ms de médiane pour le même `buildRibbon` — 30 % d'écart, sur la même
machine, à une minute d'intervalle. Ces mesures situent un ordre de grandeur,
elles ne classent pas.

Enfin, aucun de ces modules ne tourne aujourd'hui dans une image. Rien ne dit à
quelle fréquence ils seraient appelés : une fois au montage d'un écran, ou à
chaque image d'un scrubbing.

**Ce qu'elles disent quand même**, et c'est utile : `buildRibbon` est d'un ordre
de grandeur au-dessus de tout le reste, et c'est la seule opération dont le p95
approche les 4 ms. Si un jour quelque chose ne tient pas le budget, ce sera lui.
Les huit autres opérations sont sous 0,8 ms au p95, soit moins d'un vingtième
d'une image à 60 Hz.

### Deux observations de bord

**`decimate` ne décime presque pas** sur ce tracé : 2500 points en entrée, 1877
en sortie, avec les défauts documentés (1,5 m, 2°). C'est cohérent — à 25 Hz et
150 km/h, deux points consécutifs sont déjà à 1,7 m l'un de l'autre. Le module
n'est donc pas un réducteur de charge à ces réglages ; il le deviendrait sur un
tracé plus dense, ou avec une tolérance plus large.

**Le ruban produit 3754 sommets** pour 1877 points — deux par point, conforme au
`triangleStrip` annoncé.

---

## Ce qui n'a pas tenu le budget de 16,66 ms

**Inconnu, et personne ne peut le dire aujourd'hui.**

`.github/workflows/mesure.yml` existe, avec `if: false` et un déclenchement
manuel seul. Il attend l'étiquette d'un exécuteur à appareil, qui n'existe pas
dans la chaîne. Le choix est assumé et écrit dans `docs/T3_MESURE.md:88` :
mieux vaut un workflow désactivé qu'un rouge permanent qu'on apprend à ignorer.

Le juge, lui, est écrit et testé — `src/perf/frameTimes.ts`, 14 tests, trois
conditions cumulatives, et une trace vide comptée comme un échec plutôt que
comme un écran parfait. Il attend des traces.

---

## Le piège du mode de mélange n'a pas été rencontré

Le plan désigne une difficulté centrale : *« `Vertices` en `triangleStrip`, une
couleur par sommet. **Poser explicitement le mode de mélange** — le défaut
`dstOver` sort un ruban gris. »*

`src/render/ribbon.ts` s'arrête à la géométrie : il produit des sommets et
duplique les couleurs par sommet (`perVertex`). **Aucun composant Skia ne
consomme ces sommets.** `Vertices`, `Atlas`, `RuntimeEffect` et `BlendMode` sont
à zéro occurrence dans tout le dépôt.

Le piège reste donc entier. Il ne peut pas être fermé par Jest : il se voit à
l'écran, ou pas du tout.

---

## Le tracé de Haute Saintonge est sous ODbL

Le plan le rappelle et c'est une obligation, pas une politesse : les points de
`src/trackviz/hauteSaintonge.ts` viennent d'OpenStreetMap. **Toute remontée en
base transporte l'obligation d'attribution.**

Depuis le 03/08/2026, `circuits.centerline_latlon` porte pour Haute Saintonge
les 72 points du way OSM `54412766`, et pour Valence et Charente des relevés de
même origine. L'attribution « © contributeurs OpenStreetMap » doit apparaître
partout où ces tracés sont affichés. Cette vérification n'a pas été faite écran
par écran.

---

## Comment reproduire ces mesures

Elles ont été prises avec un script jetable, volontairement non conservé — un
banc de mesure qui dort finit par mentir sur ce qu'il mesure. Le refaire est
l'affaire de vingt lignes : générer 2500 points sur une boucle, appeler chaque
fonction exportée entre deux `process.hrtime.bigint()`, trier, prendre la
médiane et le p95.

La seule chose à ne pas refaire : croire que le résultat parle de l'appareil.
