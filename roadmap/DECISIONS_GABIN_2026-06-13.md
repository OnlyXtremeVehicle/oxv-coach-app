# Décisions Gabin — 2026-06-13 (réconciliation bundle v2)

> Arbitrages pris par Gabin après lecture de [`RECONCILIATION_BUNDLE_2026-06-13.md`](RECONCILIATION_BUNDLE_2026-06-13.md).
> Contrat de référence : `docs/specs-bundle-v2/`. Ces décisions font foi.

| # | Sujet | Décision | Implication | Statut |
|---|---|---|---|---|
| 1 | **Périmètre alpha** | **Tout inclure** (périmètre maximal) : tous les blocs visés, y compris 50/70/80/90/E0, idiome HUD (30.3) et insights profondeur 3-4 (30.5). | Roadmap à réétendre ; construction par incréments validés. Aucun bloc « différé » par défaut. | ⏳ planification |
| 2 | **Conseil pilote (C-1)** | **Rester dans le cadre légal** → **supprimer** la suggestion de geste (tous pilotes), garder fait + question ouverte. | `focusCorner.ts` corrigé ; test + scanner durcis. | ✅ **fait (2026-06-13)** |
| 3 | **Suppression RGPD (B-1)** | **Self-service** (edge function + cascade), bouton actif dans `settings.tsx`. | Chantier backend : edge function de suppression `auth.users` + propagation `telemetry_frames`. | ⏳ à faire |
| 4 | **Charte (D12/C-5)** | **Aligner sur le `:root` du site dès maintenant** (#FFB703 Or UI, #E63946 rouge UI, 5 couleurs piliers, Syncopate/JetBrains Mono). | Refonte de `src/theme/tokens.ts` + revue des écrans ; vérifier dispo polices dans Expo. Incrément dédié. | ⏳ à faire |
| 5 | **Relation coach (C-6)** | **Pilote-invite** (ou double voie « OXV propose / pilote active »). | Inverser le flux d'invitation (aujourd'hui admin-assigne) ; UI « Inviter un coach » + RLS. | ⏳ à faire |
| 6 | **Pricing coach (D7)** | **Gratuit à l'alpha** ; 750 €/saison **différé V1.1** (lié au statut juridique d'OXV). | Aucune dépendance paiement maintenant. Acté comme différé, pas un trou. | ✅ acté (différé) |
| 7 | **AR coach (C-3)** | **WebView autorisée pour E0 uniquement** (page `ar-view` hébergée côté site), l'app reste native ailleurs. Non bloquant alpha. | Bloc E0 prototypable ; **non publiable avant GA Meta** des Ray-Ban Display. Ticket côté repo site. | ⏳ preview |
| 8 | **Circuits / capture (N-1)** | **Haute Saintonge = premier circuit.** Fournir un **formulaire de création de circuit (admin OXV)** + **création de circuit perso par chaque pilote** (bloc 50.3). | Formulaire livré : [`docs/FORMULAIRE_CREATION_CIRCUIT.md`](../docs/FORMULAIRE_CREATION_CIRCUIT.md). Reste : outil de création in-app + (recommandé) migration « topologie en base ». | 🟡 formulaire fait ; outil à bâtir |

---

## Points doctrine soulevés par la critique adversariale (à valider hors des 8)

- **C-2 / mocks affichés comme réels** (`carte.tsx`, `prochaine-fois.tsx`) → à remplacer par un état vide honnête. **Prochain incrément.**
- **C-2bis / chiffre central rouge-jugement** (`bilan.tsx`) : le `MetricHero` de marge est colorié rouge en zone basse, alors que le contrat (`01:69`) impose une couleur **donnée**, jamais rouge-alerte. **Décision visible à confirmer** : neutraliser la couleur du chiffre central. **+ question de fond** : « marge globale % » est-elle encore conforme, ou doit-elle céder la place à un **fait saillant** (ex. meilleur tour) comme `MetricHero` central, le QDI/score global étant abandonné par le bundle ? → à trancher avec Gabin.

## Séquence d'exécution proposée (périmètre maximal, par incréments validés)

1. **✅ Correctifs doctrine/sécurité** : C-1 (fait), C-8 silence en piste (fait). **Reste** : C-2 mocks→état vide, C-2bis chiffre central.
2. **RGPD self-service** (B-1).
3. **Charte `:root`** (tokens + polices + revue écrans).
4. **Relation coach pilote-invite** (C-6) + attribution debrief nominale (C-7) + composant `CoachBand` normé.
5. **Système `TrackStage`** formalisé (4 modes) + bibliothèque de composants nommés.
6. **Blocs manquants** : 50 (traces perso + outil circuit), 80 (garage), 70 (identité), 90 (journal/ressenti/passeport/export), idiome HUD 30.3, insights spatiaux 30.5.
7. **E0 AR coach** (preview WebView côté site).
