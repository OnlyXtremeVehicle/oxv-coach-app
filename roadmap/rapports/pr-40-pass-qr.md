# Rapport — PR-39 · QR de présence du Pass OXV

> Backlog V6, jalon M2. Décision Gabin : « enchaîner le QR ». Dépendance ajoutée.

## Ce que j'ai fait
- **Dépendance** : `react-native-qrcode-svg@^6.3.21` (via `expo install`, s'appuie sur
  `react-native-svg` déjà présent ; pur JS, aucun plugin natif).
- **`app/(app)/pass-oxv.tsx`** — chaque pass actif (inscrit / présent) affiche un **QR de
  présence** (`oxv:checkin:<registrationId>`) sur fond clair (lisibilité optique).

## Périmètre honnête
- **Génération QR : faite** (testable au rendu).
- **Scan caméra (expo-camera) : NON branché** — il exige un build device pour être validé
  (quota EAS → 1er juillet) et le **check-in admin manuel existe déjà** (PR-21). Je l'ajouterai
  quand le build sera dispo, pour valider la caméra sur device.

## Gates
- `tsc 0` · `eslint 0` · `jest` vert · scan doctrinal vert (129 .tsx). Types QR OK.

## Suite
Build device (1er juillet) → valider QR + brancher `expo-camera` (scan admin) + valider
toute la pile M1+M2 sur iPhone.
