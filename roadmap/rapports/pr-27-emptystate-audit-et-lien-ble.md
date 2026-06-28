# Rapport — PR-07 (audit EmptyState) + PR-08 (honnêteté lien BLE)

> Backlog V6, jalon M1, zéro-schéma. Fin du bloc M1 zéro-schéma avant le STOP
> Support (PR-09).

## PR-07 — Audit EmptyState : **déjà satisfait** (vérifié, pas de diff)
Audit des écrans data : le primitif partagé `EmptyState` est utilisé dans **29 écrans**.
Les autres écrans-liste gèrent le vide honnêtement :
- messages inline (« Aucun… », « le revenu n'apparaît que si des roulages… ») ;
- catalogues **statiques** jamais vides (`insights.tsx` = 6 lectures fixes ; `reperes.tsx`
  = liste de virages constante).
Aucun écran ne rend une liste DB sans repli honnête. **Aucune correction nécessaire** —
convertir les replis inline vers le composant partagé serait du refactor cosmétique
multi-fichiers, contraire à la méthode. Item clos par vérification.

## PR-08 — Honnêteté du lien BLE en capture : **vrai gap corrigé**
`captureSessionService` exposait `onCaptureLinkStatus` (recording / **interrupted** /
**lost**) — mais **aucune UI ne le consommait**. L'écran `roulage.tsx` montrait donc le
voyant REC même boîtier décroché, exactement ce que le service interdit (« ne jamais
laisser croire qu'on enregistre alors que le boîtier a décroché »).

- **`src/services/captureLinkStatusLogic.ts`** (pur) — `captureLinkMessage(status)` :
  `null` si nominal ; sinon « LIEN INTERROMPU · reconnexion en cours » ou « LIEN PERDU ·
  session enregistrée jusqu'ici ».
- **`app/(app)/roulage.tsx`** — s'abonne à `onCaptureLinkStatus` et affiche ce constat à
  la place du « EN PISTE » nominal. **Sans son, sans HUD défilant, et sans rouge** (le
  rouge reste réservé au REC actif) : pas une entorse au silence en piste, l'app reste
  honnête sur ce qu'elle fait.

## Tests
- 3 tests `captureLinkMessage` (nominal / interrompu / perdu).
- `tsc 0 · eslint 0 · jest 883` (+3) · scan doctrinal vert.

## Fin du bloc zéro-schéma M1
PR-05b et PR-06 vérifiés déjà-satisfaits ; PR-07 idem ; PR-08 corrigé. **Prochaine
étape = PR-09 (tables Support) → STOP, en attente de votre validation schéma.**
