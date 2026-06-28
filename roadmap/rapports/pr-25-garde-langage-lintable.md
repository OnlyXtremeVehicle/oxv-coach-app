# Rapport — PR-04 · Garde-langage lintable (vocabulaire de jugement §C)

> Backlog V6, jalon M1. Rend le scanner doctrinal de copie **correct et enforced**.
> Zéro schéma.

## Constat (important)
- Le scanner `scripts/check-doctrine.ts` était **déjà branché en CI** (`.github/workflows/check.yml`,
  étape « Scan doctrinal ») — mais il **échouait** (9 violations). **La CI était donc rouge**
  sur cette étape.
- Les 9 hits étaient tous **« lent »**, et tous des **faux positifs** :
  - `\blent\b` matchait « ré**vèlent** » (le `\b` ASCII voit l'accent « è » comme une frontière) ;
  - le reste était du **vocabulaire factuel de vitesse** (« Lent → Rapide » d'un dégradé de
    chaleur, « le virage le plus lent », « plus lent ») et des commentaires.

## Ce que j'ai fait
- **Règle « lent » → « trop lent »** : la charte 09 §C proscrit le **jugement** (« Trop lent
  au 3 » → « Vitesse mini au virage 3 »), pas l'antonyme **factuel** « lent/rapide » d'un
  dégradé de vitesse. La nouvelle règle vise `trop lent(e/s/es)?` uniquement.
- **Wiring npm** : `npm run doctrine` (= `npx --yes tsx scripts/check-doctrine.ts`, même
  approche que la CI) + `npm run doctrine:a11y`. Le garde est désormais lançable localement,
  pas seulement en CI.

## Vérification
- `npm run doctrine` → **OK, 0 violation** (CI verte sur l'étape doctrinale).
- Aucun fichier `src/`/`app/` modifié → tsc/eslint/jest/prettier inchangés.

## Limite connue (suivi, non bloquant)
- Les noms de jugement cat. 6 finissant par un accent (« raté ») ont un `\b` ASCII en
  **faux négatif** (ne matchent pas réellement « raté » seul). À durcir avec des frontières
  Unicode (`\p{L}`, runtime Node OK) dans un petit PR de suivi — n'affecte pas la CI actuelle.

## Suite (M1)
- **PR-05** garde `assertDoctrineSafe` au rendu Bilan. **PR-05b** RGPD transfert hors-UE.
- PR-06→08, puis **PR-09 = 1er STOP-schéma** (`support_tickets`/`messages`) → accord Gabin.
