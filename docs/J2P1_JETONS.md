# Jalon 2 · Phase 1 — Jetons de design

**28 juillet 2026.** Branche `migration/sdk-55`.

Source : `OXV_Mirror_V3_Plan_Montage.md` § « JALON 2 — SOCLE PRODUIT », phase 1,
et `OXV_Mirror_V3_Dossier_Conception.md` §IV.1 à §IV.3.

> « Aucun écran n'est encore refondu. On pose ce que tous consommeront. »

---

## Ce qui est fait

### Les onze graisses mortes — retirées

31 graisses déclarées, 18 réellement employées. Geist, Geist Mono, Rajdhani et
Instrument Serif sont sorties du chargeur et du dépôt.

Une police nommée mais absente du chargeur **ne produit aucune erreur** : React
Native retombe sur la police système, le texte s'affiche, il est simplement faux.
`src/theme/__tests__/policesChargees.test.ts` interdit désormais l'écart dans les
deux sens — nommée sans être chargée (échec), chargée sans être nommée
(signalement).

### Séparateur décimal — virgule

`virgule()` dans `src/utils/format.ts`, appliqué à sept emplacements d'affichage.
`1:41,203`, jamais `1:41.203`.

### Grille et rythme

**Marge latérale** : nouveau jeton `spacing.screen`, 20 pt. **120 écrans sur 157**
y sont passés — ceux dont le corps suit l'idiome
`paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl`.

**Rythme** : `spacing.xl` valait **22 pt** — ni un pas de 8, ni un demi-pas de 4.
Un désalignement invisible sur un bloc isolé, visible dès que deux blocs voisins
l'emploient, et il l'était sur **386 emplacements**. Porté à 24. Toute l'échelle
tombe maintenant sur le demi-pas, ce qu'un test vérifie jeton par jeton.

### Chiffre roi — plafond, puis repli

`src/theme/metriques.ts`, fonctions pures, consommées par `KingNumber`.

Le plafond du dossier est de 56 pt au-delà de 7 caractères. **Il ne suffit pas.**
Sur iPhone SE, `1:41,203` à 56 pt occupe 268,8 pt pour 280 pt utiles : il
« rentre », à 96 % de la largeur, réserve mangée. Le dossier exige 10 % de
réserve — le repli descend donc **sous** le plafond, à 52 pt.

Résultat mesuré : sur iPhone 14/15/16 c'est le plafond qui mord, sur SE c'est la
réserve. Les deux mécanismes servent, chacun sur son terrain.

La colonne de droite — unité, légende, tendance — est soustraite du budget avant
le calcul. L'ignorer aurait fait déborder l'ensemble alors que le chiffre seul
tenait.

### Ligatures — coupées, après lecture de la fonte

Le dossier demande « JetBrains Mono ligatures désactivées ». J'ai lu la table de
la fonte plutôt que de supposer :

| Tag | Présent | Conséquence |
|---|---|---|
| `calt` | oui | c'est par là que passent les ligatures de code → `no-contextual` est le levier juste |
| `dlig`, `ss01`, `ss02` | non | rien à désactiver |
| `tnum` | **non** | `tabular-nums` n'a aucun effet sur cette fonte — sans conséquence, une chasse fixe est tabulaire par construction |

`monoVariant` dans `src/theme/v2.ts`, appliqué au chiffre roi.

### Correctif obligatoire — le hook de réduction des animations

`useReduceMotion` résolvait une promesse : il répondait `false` pendant les
premières images. **Toute l'entrée d'un écran jouait**, puis claquait à l'état
final — chez un utilisateur qui avait demandé l'absence de mouvement. Pire que
de l'ignorer : le saut est lui-même un mouvement brusque, non annoncé.

Passé à `useReducedMotion` de Reanimated, synchrone. Les deux kits cessent au
passage de diverger sur une règle d'accessibilité.

### Acceptation — les chaînes françaises sur 320 pt

`src/theme/__tests__/metriques.test.ts`. Le SE de 1re génération est la seule
largeur où les gabarits cassent, et la seule qu'on ne voit jamais en
développement — le simulateur ouvre un 390 pt.

Couvert : la marge par palier sur six largeurs logiques, le rythme jeton par
jeton, le plafond et le repli du chiffre roi, « Séances » et « Réglages » dans
une cellule de statistique, « Données & sécurité » dans une ligne de navigation,
et l'ensemble chiffre + unité + légende.

---

## Ce qui n'est pas vérifié

**Le calcul n'est pas un rendu.** Le banc calcule un budget de largeur à partir
de la chasse de la fonte. Pour JetBrains Mono il est exact — 600 unités pour
1000 d'em, et une chasse fixe garde la même avance en Bold. Pour Hanken Grotesk,
`avanceProportionnelle` donne une **borne haute prudente**, pas une mesure. Un
budget qui surestime protège ; un budget optimiste tronque.

Seule une capture sur appareil prouvera le rendu. Elle demande un build.

**Le `no-contextual` n'a pas été vu à l'écran.** Le tag `calt` est bien dans la
fonte ; que React Native le transmette au moteur de rendu iOS reste à constater.

---

## Ce qui reste, et pourquoi

| Point | État | Où |
|---|---|---|
| Palier de marge à 24 pt au-delà de 414 pt | non porté par le jeton | D-10 |
| 37 écrans encore à 16 pt de marge | structure différente, travail d'écran | D-11 |
| Zéro non pointé | hors de portée de `fontVariant` | D-12 |
| Trio Söhne Breit / SF Pro | **non appliqué — décision fondateur** | D-12 |

Sur ce dernier point : le dossier nomme un trio typographique qui n'est pas
celui du système V3 adopté. Söhne est commerciale, SF Pro est réservée à Apple.
Je n'ai rien changé. Un changement de fonte est une décision de doctrine, et
celle-ci a un prix.

---

## Portes

`tsc` 0 · `jest` 2 101 tests, 157 suites (2 065 / 155 avant le lot) · `eslint`
0 erreur, 18 avertissements préexistants · doctrine 0 sur 344 fichiers ·
accessibilité 0 sur 344 fichiers · prettier propre.
