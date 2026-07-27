# T2 — ThumbHash

**Branche `migration/sdk-55`** · 27 juillet 2026

> _« Aujourd'hui toutes les images partagent le même aplat titane. »_

---

## Ce qui est livré

| Élément                 | Fichier                       | État                                                   |
| ----------------------- | ----------------------------- | ------------------------------------------------------ |
| Codec ThumbHash         | `src/media/thumbhashCodec.ts` | **fait** — porté, 17 tests                             |
| API applicative         | `src/media/thumbhash.ts`      | **fait** — encodage, décodage, bornes, couleur moyenne |
| Consommation par le kit | `src/ui/v2/media/Photo.tsx`   | **fait** — `thumbhash` prioritaire sur `blurhash`      |
| Colonne en base         | —                             | **PROPOSÉE, non appliquée**                            |
| Génération à l'envoi    | —                             | **NON FAITE** — voir la contrainte ci-dessous          |

---

## Pourquoi ThumbHash remplace BlurHash

Trois raisons concrètes, pas une préférence :

- il porte le **rapport d'aspect** — un portrait cesse de s'afficher dans un cadre
  de paysage le temps du chargement ;
- il gère la **transparence**, ce que BlurHash ne fait pas ;
- il restitue mieux les **dégradés** à taille égale — ce qui compte sur des
  photos de piste, souvent un ciel au-dessus d'un bitume.

Un test vérifie le premier point, un autre le troisième : la vignette décodée
d'un dégradé sombre-vers-clair restitue bien ce sens.

---

## Le codec est porté, pas importé — et voici pourquoi

Le paquet npm `thumbhash` (MIT, 2 Ko) est publié en **ESM pur**. Metro le
consomme sans peine ; le banc d'essai, sous ts-jest en CommonJS, échoue sur
`export`.

**La correction évidente a été essayée, mesurée, et abandonnée.** Ajouter une
transformation Babel pour `node_modules` faisait passer tous les fichiers JS du
projet par `babel-preset-expo`, qui tire la chaîne Expo entière par ouvrier Jest.
La suite complète s'effondrait :

```
FATAL ERROR: Committing semi space failed. Allocation failed -
JavaScript heap out of memory
```

Le test ciblé, lui, passait — c'est ce qui rend ce genre de changement
dangereux : il paraît réussi tant qu'on ne relance pas tout.

Déstabiliser deux mille tests pour un paquet de deux kilo-octets était un mauvais
échange. Le portage donne **une** implémentation, éprouvée par les tests du
dépôt, sans divergence entre ce que l'application exécute et ce que le banc
vérifie. Attribution et licence MIT conservées en tête de fichier.

**Non porté** : `thumbHashToDataURL`, qui encode un PNG à la main — soixante
lignes de CRC et de flux zlib pour un besoin qui n'existe pas encore.
`expo-image` consomme le hash directement.

---

## LA CONTRAINTE QUI RESTE — la génération

Le module encode du **RGBA déjà décodé**. Obtenir ces pixels est le travail de
l'appelant, et c'est là que le lot n'est pas terminé.

**`sharp` est une devDependency, donc Node seulement.** Il ne tourne pas dans
React Native. La mention du plan de montage — _« génération à l'upload, `sharp`
est déjà en devDependencies »_ — désigne donc un traitement **côté serveur**, pas
dans l'application.

Deux chemins possibles, et le choix vous revient :

**A · Côté serveur, à l'arrivée du média.** Une fonction Edge Supabase lit
l'objet déposé, le réduit sous 100 px avec `sharp`, encode, écrit la colonne.
Avantage : un seul endroit, pas de coût sur l'appareil, et les médias **déjà
déposés** peuvent être traités en lot. Coût : une fonction à écrire et à déployer.

**B · Dans l'application, avant l'envoi.** `expo-image-manipulator` réduit et rend
un PNG base64 ; il faut ensuite un décodeur PNG en JavaScript pour obtenir le
RGBA — l'appareil n'expose pas les pixels bruts. Avantage : aucun serveur. Coût :
un décodeur de plus, du calcul sur l'appareil au moment de l'envoi, et **rien
pour l'existant**.

**Recommandation : A.** Le parc de médias déjà déposé n'a pas de ThumbHash ; seul
le chemin serveur peut le rattraper sans demander aux pilotes de renvoyer leurs
photos.

---

## La colonne, à décider

`supabase/migrations/PROPOSITION_T2_thumbhash.sql` — **non appliquée**, nommée
`PROPOSITION_` et non horodatée, donc ignorée par `db push`. Elle ajoute une
colonne `thumbhash text` nullable sur les tables de médias.

`null` est l'état normal tant que la génération n'existe pas : l'affichage
retombe sur l'aplat titane, ce qui reste correct. Aucune migration de données,
aucun défaut fabriqué.

---

## Ce qui n'a pas été vérifié

Le rendu **à l'écran** du placeholder n'a pas été observé : cela demande un build
et un média porteur d'un ThumbHash, donc la génération. Les 17 tests portent sur
le codec et ses bornes, pas sur l'affichage.
