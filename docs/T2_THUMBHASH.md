# T2 — ThumbHash

**Branche `migration/sdk-55`** · 27 juillet 2026

> _« Aujourd'hui toutes les images partagent le même aplat titane. »_

---

## Ce qui est livré

| Élément                 | Fichier                                  | État                                                   |
| ----------------------- | ---------------------------------------- | ------------------------------------------------------ |
| Codec ThumbHash         | `src/media/thumbhashCodec.ts`            | **porté et testé, mais AUCUN code de production ne l'exécute** — voir « les deux implémentations » |
| API applicative         | `src/media/thumbhash.ts`                 | idem — seul son propre test l'importe |
| Consommation par le kit | `src/ui/v2/media/Photo.tsx`              | **fait, mais PAS via le portage** — il importe `./blurhash` et `./mediaMath`, et relaie une chaîne au décodeur natif d'expo-image |
| Génération serveur      | `supabase/functions/generate-thumbhash/` | **fait ET DÉPLOYÉE** le 03/08/2026 — voir plus bas     |
| Appel à l'envoi         | `src/services/sessionMediaService.ts`    | **fait** — lancé sans être attendu                     |
| Colonne en base         | `20260729034239_t2_thumbhash_session_media.sql` | **appliquée** le 29/07/2026            |

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

## La génération — chemin serveur retenu et RÉALISÉ

Le module encode du **RGBA déjà décodé**. Obtenir ces pixels est le travail de
l'appelant, et c'est là que le lot n'est pas terminé.

**`sharp` est une devDependency, donc Node seulement.** Il ne tourne pas dans
React Native. La mention du plan de montage — _« génération à l'upload, `sharp`
est déjà en devDependencies »_ — désigne donc un traitement **côté serveur**, pas
dans l'application.

Deux chemins étaient possibles. **A a été retenu et écrit.**

**A · Côté serveur, à l'arrivée du média.** Une fonction Edge Supabase lit
l'objet déposé, le réduit sous 100 px avec `sharp`, encode, écrit la colonne.
Avantage : un seul endroit, pas de coût sur l'appareil, et les médias **déjà
déposés** peuvent être traités en lot. Coût : une fonction à écrire et à déployer.

**B · Dans l'application, avant l'envoi.** `expo-image-manipulator` réduit et rend
un PNG base64 ; il faut ensuite un décodeur PNG en JavaScript pour obtenir le
RGBA — l'appareil n'expose pas les pixels bruts. Avantage : aucun serveur. Coût :
un décodeur de plus, du calcul sur l'appareil au moment de l'envoi, et **rien
pour l'existant**.

**A est fait** : `supabase/functions/generate-thumbhash/`. Le parc déjà déposé n'a
pas de ThumbHash, et seul ce chemin peut le rattraper sans demander aux pilotes
de renvoyer leurs photos.

Le hash reste un AGRÉMENT : l'appel applicatif est lancé sans être attendu, son
échec est silencieux, et les vidéos sont écartées ET comptées.

---

## La colonne, à décider

`supabase/migrations/PROPOSITION_T2_thumbhash.sql` — **non appliquée**, nommée
`PROPOSITION_` et non horodatée, donc ignorée par `db push`. Elle ajoute une
colonne `thumbhash text` nullable sur `session_media` — vérifié : `pilot_media` et
`coach_media` N'EXISTENT PAS, les médias de profil vivent en colonnes sur `users`
et `coach_profiles`.

`null` est l'état normal tant que la génération n'existe pas : l'affichage
retombe sur l'aplat titane, ce qui reste correct. Aucune migration de données,
aucun défaut fabriqué.

---

## Ce qui n'a pas été vérifié

Le rendu **à l'écran** du placeholder n'a pas été observé : cela demande un build
et un média porteur d'un ThumbHash, donc la génération. Les 17 tests portent sur
le codec et ses bornes, pas sur l'affichage.

---

## 03/08/2026 — LA FONCTION N'ÉTAIT PAS DÉPLOYÉE

Ce document annonçait la génération serveur « fait ». Elle l'était au sens du
code : `supabase/functions/generate-thumbhash/index.ts` existe, 224 lignes,
appelée depuis `src/services/sessionMediaService.ts:224`.

**Elle n'était pas déployée.** Le projet comptait 33 fonctions Edge actives ;
`generate-thumbhash` n'en faisait pas partie. Chaque envoi de média lançait donc
un appel voué à échouer.

Et l'appel est délibérément silencieux — `void … .catch(() => undefined)`, avec
un commentaire qui explique pourquoi : un aperçu est un agrément, il ne doit pas
transformer un envoi réussi en erreur. Le raisonnement est juste. Sa conséquence
ne l'était pas : **rien n'aurait jamais signalé que la fonction n'existait pas.**
Le seul symptôme aurait été des aperçus qui ne s'affichent pas, indistinguables
d'un choix de conception.

### Ce qui a été fait

Déployée le 03/08/2026, puis exercée en mode rattrapage :

    POST /functions/v1/generate-thumbhash  { "limit": 5 }
    -> 200 {"ok":true,"traites":0,"ecartesVideo":0,"echecs":0,"candidats":0}

Zéro candidat : `session_media` ne porte aucune ligne en production. La fonction
répond correctement à un lot vide — c'est ce qu'on voulait vérifier, et c'est
tout ce que ce test prouve. **Aucun ThumbHash n'a encore été calculé sur une
vraie image.** Cela viendra au premier média déposé.

### ~~Ce qui reste ouvert~~ — CORRIGÉ, ET L'AFFIRMATION ÉTAIT FAUSSE

> **« Aucun écran ne passe la prop » était vrai le 29/07, faux depuis le
> 04/08** (commit `92fa4b9`) : quatre grilles de vignettes la passent. Le
> document déclarait mort ce qui vivait — et vivant, deux lignes plus haut, ce
> qui était mort.

Ce qui manquait vraiment, et qui est corrigé le 14/08 : **les GRANDES images ne
recevaient pas le hash.** `HeroPhoto` n'avait même pas la prop, alors que le
Bilan lui passe un `SessionMediaItem` complet — le hash était en mémoire et
jeté sur le seuil. La visionneuse plein écran de la galerie ne recevait qu'un
`uri`.

C'était l'inverse de ce qui aide : le repli soigné servait aux vignettes, dont
le chargement se voit à peine, et pas aux images plein cadre.

Désormais : `HeroPhoto` porte la prop, `ViewablePhoto` porte le hash jusqu'au
plein écran, et le Bilan le transmet.

### LES DEUX IMPLÉMENTATIONS — ce que ce dossier promettait d'éviter

Ce document écrit que le portage donne *« UNE implémentation, sans divergence
entre ce que l'application exécute et ce que le banc vérifie »*.

**Il y en a exactement deux, et la divergence annoncée comme évitée est celle
qui existe :**

| | ce qui tourne |
|---|---|
| encodage | `esm.sh/thumbhash@0.1.1`, dans la fonction Edge |
| décodage | natif, dans `expo-image` |
| `src/media/thumbhash*.ts` | **rien** — aucun importeur de production |

Les 17 tests portent donc sur du code que rien n'exécute. Ils ne couvrent pas
l'encodeur réel : un défaut côté serveur resterait vert.

**Le portage n'est pas supprimé** — c'est du code correct, pas de
l'anti-doctrine, et la règle du fondateur réserve la suppression franche à ce
qui contredit la doctrine. Il est ANNOTÉ, et la garde d'orphelins du dépôt le
surveille déjà. Le supprimer reste un arbitrage ouvert.

**Rien n'appelle le mode rattrapage.** La fonction sait traiter par lot, l'index
partiel `idx_session_media_thumbhash_manquant` est en place pour ça — mais aucun
cron ne l'invoque. Tant que le chemin d'envoi fonctionne, ce n'est pas gênant ;
le jour où il échouera, personne ne reprendra les médias manqués.
