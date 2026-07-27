# T3 — Mesure de performance

**Branche `migration/sdk-55`** · 27 juillet 2026

> _« Flashlight en intégration continue, sur appareil réel. Profiler la
> distribution des temps d'image, jamais la moyenne — les shaders provoquent un
> throttling thermique sur les appareils anciens. »_

---

## Ce qui est livré, et ce qui attend du matériel

| Élément                             | Fichier                        | État                                      |
| ----------------------------------- | ------------------------------ | ----------------------------------------- |
| Règle de lecture — centiles, dérive | `src/perf/frameTimes.ts`       | **fait**, 14 tests                        |
| Juge en ligne de commande           | `scripts/juger-mesure.ts`      | **fait**, éprouvé sur traces témoins      |
| Harnais d'intégration continue      | `.github/workflows/mesure.yml` | **écrit, désactivé** — attend un appareil |
| Parcours par écran                  | —                              | **à écrire**, avec les écrans refondus    |

La séparation est délibérée. Un harnais de mesure qui ne tourne pas emporterait
avec lui la **règle de lecture**, et c'est elle qui compte. Elle est donc écrite,
testée, et utilisable dès qu'une trace existe — y compris relevée à la main.

---

## Pourquoi la moyenne ment, chiffré

Un écran qui rend 95 % de ses images en 8 ms et 5 % en 90 ms affiche une moyenne
de **12,1 ms** — sous le budget de 16,66 ms. Un rapport fondé sur la moyenne
conclurait « conforme ». Le pilote, lui, voit une saccade toutes les vingt images.

Le juge, sur cette même trace :

```
KO  ecran-saccade — 200 images · p50 8.0 ms · p95 12.1 ms · p99 90.0 ms
                  · 95.0 % dans le budget
      centile 99 à 90.0 ms, plafond 33.3 ms
      dérive thermique : centile 95 passe de 8.0 à 90.0 ms
```

C'est exactement le profil du throttling : le rendu tient, puis l'appareil
chauffe et décroche par à-coups. **La moyenne absorbe précisément ce qu'on
cherche.**

---

## Trois conditions, toutes nécessaires

Un écran passe s'il satisfait les trois. Une seule suffit à le refuser.

1. **95 % des images** tiennent le budget de 16,66 ms ;
2. le **centile 99** reste sous deux budgets — au-delà, la saccade se voit ;
3. **aucune dérive** : le centile 95 de la seconde moitié ne dépasse pas
   1,3 fois celui de la première.

La troisième condition est la moins évidente et la plus utile. Un écran dont
_chaque_ image tient le budget peut malgré tout dériver de 12 à 16,5 ms — un test
le vérifie, et le juge le refuse. C'est le début d'un throttling, visible avant
qu'il ne fasse mal.

**Une trace lente mais STABLE n'est pas une dérive** — c'est un autre défaut, et
les confondre enverrait chercher au mauvais endroit. Un test fixe cette
distinction.

---

## Le piège du faux vert, fermé

Une trace **vide** est traitée comme un **échec**, jamais comme un écran parfait.
Sans cette branche, un relevé raté — appareil débranché, Flashlight en erreur —
produirait « aucune image hors budget » et un vert mensonger.

Le workflow porte la même garde en amont : il vérifie qu'un appareil répond à
`adb devices` avant de mesurer, et échoue sinon.

---

## Pourquoi un appareil réel, et pas un émulateur

Le défaut traqué est le **throttling thermique**. Un émulateur ne chauffe pas. Il
rendrait une trace propre et une conclusion fausse.

C'est aussi pourquoi la mesure porte sur un **build réel**, jamais sur un bundle
de développement : le mode debug fausse tout.

---

## Pourquoi le workflow est désactivé

`if: false`, et déclenchement manuel seulement.

Programmé sans exécuteur à appareil, il échouerait à chaque exécution. Un rouge
permanent finit par être ignoré — et une garde qu'on ignore ne garde plus rien.
C'est le motif qui revient dans ce dépôt : la garde multi-circuit, le scanner
d'accessibilité et le scan doctrinal étaient tous présents et tous aveugles.

**Pour l'activer** : enregistrer un exécuteur auto-hébergé avec un appareil
branché en ADB, remplacer `runs-on`, écrire les parcours, retirer le `if: false`.

---

## Ce qui n'a pas été mesuré

**Rien.** Aucune mesure n'a été relevée : il n'y a pas d'appareil dans la chaîne.

Les 14 tests portent sur la **règle de lecture**, éprouvée sur des traces
synthétiques dont on connaît la réponse. Le juge a été passé sur trois témoins —
sain, saccadé, vide — et rend le verdict attendu pour chacun.

Le budget réel des écrans reste donc **inconnu**. Les parcours viendront avec les
écrans refondus : mesurer un écran avant de l'avoir retravaillé n'apprend rien
qu'il faudra garder.
