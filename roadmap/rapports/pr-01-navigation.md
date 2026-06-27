# Rapport — PR 1 · Navigation 5 zones

## Ce que j'ai fait
- **`src/lib/appMap.ts`** — source unique de vérité : `ROUTE_TO_ZONE` (toutes les routes `(app)` → zone), `TAB_ORDER` (Paddock·Session·Bilan·Progression·Club), `TAB_MAIN_ROUTE`, `zoneOfRoute`, `dataLabScreens`, `shouldShowTabBar`. + test Jest (6 cas).
- **`src/components/AppTabBar.tsx`** — barre custom 5 onglets : icônes SVG 21px stroke 1.65, actif `#F8F9FA` / inactif `#54545C`, fond `rgba(5,5,5,0.92)`, border-top `#1C1C20`, label Geist Mono 8.5. **Zéro or.**
- **`app/(app)/_layout.tsx`** — barre posée AU-DESSUS du `Stack` (colonne flex), Stack **inchangé**. Masquée en `S6_roulage` + flux de capture (silence en piste). Compte n'est PAS un onglet.
- **`app/(app)/session/index.tsx`** + **`app/(app)/club/index.tsx`** — hubs net-neufs (Session, Club).

## Décision d'architecture (déviation assumée du ticket A2)
Le ticket proposait « convertir `(app)/_layout` en `Tabs` **OU** `Stack` + barre custom ». J'ai retenu **`Stack` + barre overlay**. Convertir ~50 routes plates en `Tabs` aurait changé la sémantique push/back de TOUS les écrans pilote — régression non testable sans device. La barre additive sur le `Stack` = **zéro changement de la navigation existante**, contenu inséré via colonne flex. Tous les critères A2 restent tenus (specs canon, masquage en piste, Compte en icône, routes préservées).

## Ce qui est testé et fonctionnel (statique)
- `tsc` 0 · `eslint` 0 · `jest` 797/797 (dont 6 `appMap`).
- Aucune route supprimée ; toutes les routes `/(app)/*` restent accessibles.
- L'onglet Bilan ouvre `/(app)/bilan` qui résout déjà « la dernière session du user » sans paramètre.

## Ce qui reste en suspens (nécessite un build pour valider visuellement)
- Rendu réel de la barre (icônes, highlight de l'onglet actif, masquage en piste) — vérifiable seulement sur device/build (SVG natif).
- Double inset bas possible (safe-area écran + barre) → polish PR 7.
- Fond « flouté » du canon non implémenté (pas d'`expo-blur`) → fond translucide ; blur en PR 7.
- Icône d'accès **Compte** haut-droite : la barre ne la porte pas (correct) ; le branchement dans les `AppBar` reste à faire (PR 6 / tâche #25).

## Questions pour Gabin
1. On valide la déviation « Stack + overlay » plutôt que `Tabs` natif ? (Reco : oui — le plus sûr, non-cassant.)
2. On masque la barre en `S6_roulage` seul, ou aussi en `S5_approche` (canon §6) ? (Reco : `S6` seul pour PR 1 ; à l'arrivée circuit la nav reste utile.)
3. Le label « PROGRESSION » est long à 8.5px — on garde, ou on raccourcit (« PROGRÈS ») ?

## Recommandations
- Lancer un build preview pour valider la nav visuellement **avant** la PR 2.
- PR 2 (Paddock contextuel) enchaîne naturellement : `appMap` + barre sont prêts.

## Estimation suite
- PR 2 Paddock : moyen. PR 3 Bilan + Data Lab : moyen. PR 7 polish (Instrument Serif, `v2.ts` réaligné, blur) : transverse, après stabilisation de la structure.
