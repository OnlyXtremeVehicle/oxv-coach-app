# Rapport — PR-14 · Tests appMap (cohérence routes ↔ zones)

> Backlog V6, jalon M1. Zéro schéma.

## Constat
Le test `appMap` existant ne vérifiait pas que les entrées correspondent à des
routes RÉELLES. Résultat : **`support` (ajouté en PR-10) et `compte` étaient
orphelins** dans `ROUTE_TO_ZONE` — non surlignés par la barre d'onglets sur
deep-link. Exactement la régression que ce garde-fou doit attraper.

## Ce que j'ai fait
- **`src/lib/appMap.ts`** — ajout `compte: 'compte'` et `support: 'compte'`.
- **`src/lib/__tests__/appMap.test.ts`** — 3 tests de cohérence lisant le système
  de fichiers `app/(app)` :
  1. aucune route écran orpheline (hors allowlist debug/médias/partage public) ;
  2. aucune entrée appMap ne pointe vers une route inexistante (anti-stale) ;
  3. chaque onglet pointe vers une route racine existante (paddock=index).

## Gates
- `tsc 0 · eslint 0 · jest 886` (+3).

## Suite (M1)
PR-13 (matrice RLS), PR-15 (consentement), PR-16 (export/suppression), PR-17 (Plausible).
