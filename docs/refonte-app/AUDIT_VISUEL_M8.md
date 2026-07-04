# Audit visuel M8 — canon écran par écran (2026-07-04)

> Méthode : workflow adversarial — 10 auditeurs (un par groupe d'écrans) sur les
> règles du canon (`04_DESIGN_CANON`, `src/theme/v2.ts`), puis **vérification
> adversariale de chaque constat** critical/medium (réfutation par défaut, faux
> positifs connus écartés : BRONZE admin, rgba dérivées, heritageGold sur
> numéros de virage, or sur chiffre de donnée). Deux passes (reprise après
> limites de session/crédits).

## Bilan chiffré

| | Nombre |
|---|--------|
| Constats confirmés (vérifiés au sens strict) | **68** |
| Corrigés (2 commits) | **66** |
| Confirmés mais **déférés au fondateur** (UX/produit) | **2** |
| Réfutés à la vérification (faux positifs) | 41 |
| `low` (tactile, eyebrow) — non traités, à trier | 47 |
| Groupes non re-vérifiés (crédits épuisés) : admin-a/b, partner-pro-ui | — |

## Règles auditées

- **R1** couleurs sémantiques : or = donnée seule ; rouge = marque/REC/coach ;
  heritageGold = Heritage + n° virage ; vert = tendance/connecté ; bronze = admin.
- **R2** hex en dur avec token exact (DRY canon).
- **R3** typo : mono = chiffres ; jamais de serif sur un chiffre.
- **R4** un seul chiffre dominant par écran.
- **R6** tactile ≥ 44 px (low).

## Conventions unifiées posées par cette passe

1. **CTA / bouton primaire** = fond `palette.cream`, texte `palette.night` (canon §4).
2. **État sélectionné** (pill, carte, radio) = bordure `palette.edge` + fond `palette.card` ;
   **checkbox cochée** = fond `palette.cream`, coche `palette.night`.
3. **Switch actif** = `trackColor.true = palette.green` (état), plus jamais l'or.
4. **Pastille / point décoratif** = `palette.creamMute`, **glow or supprimé**.
5. **Halo or de panneau** (shadowColor gold) = supprimé.
6. **Titre / eyebrow hors donnée** = `creamSoft` / `creamMute` ; l'or reste sur
   les courbes et chiffres de DONNÉE.
7. **Rouge hors marque/REC/coach** = neutralisé (creamMute / faint) ou couleur de
   donnée non réservée.

## Ce qui a été corrigé (66)

- **Onboarding pilote + coach** : 9 CTA passent de l'or au crème/nuit ; mots-titres,
  cases à cocher et barres de progression alignés (index/doctrine/methode/niveau/
  cgu/pacte + coach-onboarding index/mission/pacte).
- **Rouge décoratif critique** : CTA « Découvrir » de `bilan-pret` (rouge de marque
  sur bouton de navigation) → crème.
- **Or hors donnée** : titres des 6 visualisations d'insight, pastilles/halos
  (virage, virage-comparer, telemetry, amis, mon-coach, circuit, settings, stats,
  entre-runs, pilotage-fini, InsightCard, ar, halo carte du hub, halo cockpit
  systémique `vizChrome`), sélections (placement, profil, niveau…), switches
  (settings, consentements, mon-coach, cycles, **ConsentSwitchRow** canonique),
  boutons d'auto-évaluation (objectifs).
- **Rouge hors marque** : « Révoquer » (partage), pins circuits, statuts
  mes-routes / roulages, POI belle-route, eyebrow ERREUR (bilan) ; **heritageGold**
  retiré de la légende heatmap.
- **R2 hex → tokens** : DebriefMirror, cote-a-cote, pass-oxv, admin/preparation,
  pilote/[id], admin/circuit, admin/coachs/[id], index/session/preparation.
- **R3/R4** : chiffre d'empreinte-saison en mono (jamais serif) ; chiffres
  secondaires dégradés (coach/[id], stats).

## Confirmés mais DÉFÉRÉS au fondateur (2)

1. **`bilan.tsx` — deux chiffres héros (R4)** : la jauge RÉGULARITÉ (264 px) et le
   « MEILLEUR TOUR » cohabitent sur le Bilan. Lequel est LE chiffre dominant est
   une **décision produit** (l'un porte la doctrine « un seul chiffre », l'autre la
   charge émotionnelle) — je ne dégrade pas le meilleur tour sans ton arbitrage.
2. **Couleur d'erreur** : le canon n'a pas de token « erreur » ; j'ai neutralisé
   l'eyebrow ERREUR de `bilan` en creamMute, mais si tu veux un rouge d'alerte
   assumé (comme le site), il faut un token dédié — à trancher.

## Restes non traités

- **47 `low`** (cibles tactiles < 44 px, eyebrows non conformes) — passe séparée,
  faible risque.
- **Groupes admin-a/b + partner-pro-ui** : re-vérification tombée sur les crédits ;
  les constats bruts existent dans `.audit_m8_reprise.json`, à re-vérifier au reset
  avant application (ne pas appliquer non vérifié).

## Vérification finale
- Tout se valide **à l'œil au prochain build EAS**, en priorité l'onboarding
  (CTA crème) et les switches verts.
