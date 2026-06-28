# Plan — écrans par rôle (pilote pro · coach · partenaire B2B · admin)

> Roadmap dérivée du CDC V3 public-ready + V4 innovation métier. État au 2026-06-28.
> Méthode : 1 tranche = 1 PR, validation entre chaque, schéma seulement avec accord.
> Décisions actées : **pilote pro = nouveau rôle** (`pro_pilot`, fondation FAITE PR-I) ;
> **partenaire B2B = le `partner` existant + volet B2B Report** (pas de nouveau rôle).

## Pilote professionnel `(pro)`  — *fondation FAITE (PR-I)*
| Écran | Source | Schéma | Statut |
|---|---|---|---|
| Hub pro (identité + outils data partagés) | — | non | **FAIT** |
| Garage enrichi (véhicule, pneus/freins, setup log) | V4 §7/§18 | `vehicle_setups` (oui) | à faire |
| Jumeau numérique pilote (signature évolutive, tendances) | V4 §6 | `pilot_digital_twins` (oui) | à faire |
| Exports avancés (souveraineté data pro) | V3 §90.4 | non (`dataExportService` existe) | à faire |
| Carnet vocal + ressenti | V4 §17 | `pilot_voice_notes` (oui) | à faire |

## Coach `(coach)`  — *espace déjà riche*
| Écran | Source | Schéma | Statut |
|---|---|---|---|
| Dashboard, Mes pilotes, **File de lecture**, Annoter, Repères, Business, Dispos, AR | — | — | **déjà là** |
| Coach AI Assistant (priorisation, pré-brouillon non prescriptif, **validation humaine**) | V4 §13 | `coach_ai_suggestions`, `ai_safety_reviews` (oui) | à faire — **filtre lexical IA obligatoire** |
| Programmes adaptatifs (cycles 3 sessions, recommandations validées coach) | V4 §14 | `pilot_development_cycles`… (oui) | à faire |
| Note vocale coach (`audio_url`) | CDC V2 §6.1 | colonne (petit) | à faire |

## Partenaire `(partner)`  — *marketplace FAITE (PR-F1→F4)*
| Écran | Source | Schéma | Statut |
|---|---|---|---|
| Dashboard, Offres CRUD, Leads pilote, Validation admin | — | — | **déjà là (PR-F)** |
| Dashboard leads enrichi (vues, conversions, statuts) | V3 §11 / V4 §25 | non (dérivable) | à faire |
| **B2B Event Report** (participation, qualité, coaching, partenaires, média, conclusion) | V4 §25 | `b2b_event_reports` (oui) + un concept d'**événement** à clarifier | à cadrer — *quel est « l'événement » en base ?* |

## Admin `(admin)`  — *control tower déjà fourni*
| Écran | Source | Schéma | Statut |
|---|---|---|---|
| Opérations, Préparation, Analytique, **Qualité data**, Partenaires, Coachs, Points-carte | — | — | **déjà là** |
| **Support tickets** (pilote crée → admin traite) | V3 §12 | `support_tickets`, `support_messages` (oui) | à faire |
| Admin Ops Assistant (alertes : device batterie, non-briefé, équipement non rendu, session sans data) | V4 §22 | dérivable + `ops_alerts` (oui) | à faire |
| Devices / Équipements (CRUD + affectations) | V3 §13 | tables FAITES (PR-D), écran à faire | à faire |
| Modération (offres / médias / profils) | V3 §18 | `moderation_reports` (oui) | à faire |

## Transverse (tous rôles, V4 — innovations sûres d'abord)
- **Data Confidence Score** (lecture complète/partielle/limitée, raisons admin) — V4 §8, recommandé en premier.
- **OXV Key Moments** (tour le plus constant, virage variable, anomalie…) — V4 §9.
- **Filtre de sécurité IA** (bloque verbes prescriptifs, tests snapshot) — V4 §27, **prérequis** de toute sortie IA.

## Séquence recommandée
1. **Garage enrichi** (`(pro)` + pilote ; table `vehicle_setups` déjà prévue) — zéro/petit schéma, valeur immédiate.
2. **Support tickets** (admin + pilote) — V3 P1, bien spécifié.
3. **Data Confidence Score** (transverse, V4.1 le plus sûr).
4. **B2B Event Report** — après avoir tranché le concept d'**événement** en base.
5. Coach AI / programmes adaptatifs — **après** le filtre de sécurité IA.

> Note doctrine : toute innovation IA reste **descriptive/interrogative**, **post-session**, **jamais en piste**, et **validée par l'humain** côté coach. Le partenaire ne voit **jamais** la télémétrie.
