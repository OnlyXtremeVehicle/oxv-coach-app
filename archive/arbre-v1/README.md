# Arbre pilote V1 — archive

Ce dossier contient l'**arbre pilote de première génération**, retiré de
l'application le 29 juillet 2026 (lot J5 du Programme V3), sur décision
fondateur : *« le supprimer et en faire un dossier à part pour garder une
sauvegarde »*.

**Rien ici n'est construit, typé, testé ni scanné.** `tsconfig.json`,
`.eslintrc.json` et `jest.config.js` excluent explicitement `archive/`. Le
bundler ne l'atteint pas non plus : aucun fichier vivant ne l'importe, et le
dossier est hors de `app/`, la racine d'expo-router.

---

## Ce qu'il contient

| | |
|---|---:|
| `app-app/` — les 74 fichiers de l'ancien `app/(app)` | 35 583 lignes |
| `src/` — les 28 modules que plus aucun survivant n'atteignait | 3 524 lignes |
| **Total** | **39 107 lignes** |

Le classement écran par écran qui a conduit à ce retrait est dans
[`docs/J5_ARBRE_V1.md`](../../docs/J5_ARBRE_V1.md) : pour chacun des 71 écrans
de route, sa taille, qui l'atteignait, et ce qui le remplace.

---

## Pourquoi une archive et pas une suppression

Git garde tout, et le tag `avant-suppression-arbre-v1` marque l'état complet
juste avant ce retrait. Mais retrouver un écran dans l'historique demande de
savoir qu'il a existé et sous quel nom. Ici, il se lit.

**Ces fichiers ne sont plus une référence.** Plusieurs portent des défauts
identifiés au moment du retrait — `debug-capture.tsx` vise une ligne d'arrivée
qui ne correspond à aucun circuit de la base, les écrans numérotent les virages
avec un cran de trop. Ils sont conservés comme témoin de ce qui a été fait, pas
comme modèle de ce qu'il faut refaire.

---

## Ce que le retrait a demandé avant d'être possible

Neuf étapes, toutes accomplies avant celle-ci :

1. Qualifier le push `/signature`, route que deux fichiers réclamaient ;
2. Recâbler les deux liens de l'espace coach ;
3. Porter le zoom virage — ancre `?corner=`, annotation selon le rôle ;
4. Réhéberger **l'écriture d'intention**, que seul V1 portait ;
5. Porter la durée d'expiration des liens de partage ;
6. Porter les objectifs et la prochaine fois ;
7. Porter le catalogue et la fiche partenaire ;
8. Porter les belles routes ;
9. Recâbler l'espace pilote professionnel — neuf liens et cinq boutons.

Le signalement de contenu et le banc de capture ont été portés en cours de
route, l'un parce que l'application publie du contenu d'utilisateur, l'autre
parce qu'il est la seule surface qui capture des trames réelles.

---

## Pour restaurer

```bash
git checkout avant-suppression-arbre-v1 -- 'app/(app)'
```

Il faudra aussi remettre les modules de `src/`, et retirer `archive` des trois
fichiers de configuration. Mais surtout : relire pourquoi chaque écran est parti.
