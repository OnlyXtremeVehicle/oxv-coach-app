# Audit — Maquettes `specs-bundle-v4` & pages avancées/AR : ce qui reste à réaliser

> Audit multi-agents (5 clusters → synthèse → critique anti-faux-positif). Réponse à
> « ce qui reste maquette / prototype / non validé ». Date : 2026-06-28.
> **Réalisé depuis** : 20.2 Signature RADAR (PR-G). Le reste est priorisé ci-dessous.

## Déjà réels (vérifiés par grep, aucun faux « implemented »)
Insights galerie + détail (démo), **20.1 Bilan**, **20.2 Signature** (radar inclus PR-G),
**60.2 Comparaison** (côte-à-côte, double opt-in), **trace 2D + 3D** (R3F natif), **90.4 Export
souveraineté** (`dataExportService`, frames exclus volontairement), heatmap/replay/comparateur.

## À réaliser — RN-actionnable, doctrine-clean (par valeur/risque)

| Item | Statut | Schéma | Effort | Note |
|---|---|---|---|---|
| **80.1 Mes véhicules (Garage)** | partiel | **non** (`vehicles` déjà en prod) | L | Le profil n'a qu'un champ texte ; l'écran liste/CRUD manque. Zéro schéma — bon candidat suivant. |
| **90.3 Carnet de circuits (passeport)** | partiel | non (`statsService.byCircuit`) | M | Grille collection de circuits roulés. Dérivable, zéro schéma. |
| **90.1 Journal de bord pilote** | maquette | **oui** (`pilot_journal_entries`) | M | Notes privées du pilote. **Point doctrinal sensible** : l'app ne pré-remplit/ne suggère JAMAIS. |
| **90.2 Conditions & ressenti** | partiel | oui (déclaratif) | M | Météo factuelle existe ; manque la saisie du ressenti, **sans corrélation auto**. |
| **70.2 Carte de pilote (licence)** | maquette | non | M | Base `TrophyCard`/`share[token]` réutilisable. Insigne factuel, pas de rang. |
| **70.1 Avatar driver** · **70.3 Empreinte de saison** | maquette | non | M | Dérivables des faits ; pas d'écran d'agrégation. |
| **80.2 / 80.3 Véhicule × télémétrie / comparaison** | maquette | non | M | Dépend de 80.1 (`vehicle_id` FK existe). |
| **Tracé — couche annotations coach / référence coach** | partiel | non | M | `coach_annotations` existe ; rendu de la couche à brancher. |
| **CircuitTrace 3D — gestes pinch/drag** | partiel | non | S | 3D porté ; manque le geste tactile. Petit. |
| **60.1 Feed communauté** · **60.3 Partage template au cercle** | maquette | **oui** | L | **Risque doctrine élevé** (feed → pente classement/compétition) ; ConsentGate obligatoire. À cadrer avant. |

## Bloqué par Valence (données réelles, NE PAS figer avant juillet 2026)
- **Insights réels** (anatomy, tour idéal) branchés sur le vrai moteur — viz prêtes mais `telemetry_frames = 0`.
- **Insights N3/N4** (g-g enveloppe, dispersion, flow, équilibre, transfert) — calcul edge function + vraies frames.
- **Alignement détection virages** (7 courbure vs 13 minima-vitesse) — calibration sur données réelles.

## NON réalisable dans ce repo RN (web / matériel)
- **AR coach (E0)** : la vue in-lens E0.2 est une **route web** (`app.oxvehicle.fr/ar-view`) + matériel **Ray-Ban Display en preview Meta**. L'écran `ar.tsx` est un **prototype honnête** (badge APERÇU, aucune fausse valeur, bouton « Lancer » no-op assumé) — à laisser tel quel.
- Outils web **circuit-3d.html** (générateur hors app).

## Recommandation de séquence
**80.1 Garage** (zéro schéma, table prête) → **90.3 Carnet/passeport** (zéro schéma) → **90.1 Journal** (petit schéma, cadrer la garde « l'app ne suggère jamais ») → 70.x identité. Garder **60.x feed** et **insights réels** pour après cadrage / après Valence.
