# La mesure de performance — où elle en est

**Au 14 août 2026 : tout est prêt sauf la machine.**

## Ce qui existe

| | |
|---|---|
| La règle de lecture | `src/perf/frameTimes.ts` — distribution et non moyenne, détection d'étranglement, jugement de budget. Testée. |
| Le juge | `scripts/juger-mesure.ts` — lit des traces, rend un verdict par écran. |
| Les parcours | `perf/parcours/*.yml` — quatre, un par écran à risque. |
| Le workflow | `.github/workflows/mesure.yml` — installe Flashlight, vérifie qu'un appareil est branché, mesure, juge. |

## Ce qui manque, et c'est une seule chose

**Un exécuteur GitHub avec un téléphone Android branché en USB.**

Le jour où il existe, deux lignes changent dans le workflow : retirer le
`if: false`, et remplacer `ubuntu-latest` par l'étiquette de la machine. Rien
d'autre.

## Pourquoi ces quatre parcours et pas d'autres

Ce sont les écrans qui portent une animation continue ou un rendu Skia :
l'accueil, le bilan, la séance et la signature. Les autres sont des listes.
Mesurer d'abord ce qui ne risque rien donnerait des verts sans valeur.

Le morph de la signature mérite une mention : c'est la seule animation du
produit qui traverse le pont UI vers JS à chaque image. Sa preuve profiler est
due depuis le lot L1 ; le parcours `signature.yml` est écrit pour la produire.

## Ce que la mesure ne dira pas

Le temps de chargement réseau. Il dépend du réseau du jour, et le budget de
16,7 ms ne le vise pas — le confondre avec du temps d'image ferait accuser le
rendu d'une lenteur qui vient d'ailleurs.

Et rien ne doit être mesuré sur un bundle de développement : le mode debug
fausse tout, et un vert obtenu dessus ne veut rien dire.
