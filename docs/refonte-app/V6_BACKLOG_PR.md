# V6 — Backlog PR ordonné (exécution OXV Platform)

> Le plan d'exécution, de maintenant à public-ready + innovation V4. Dérivé de V2
> (`specs-bundle-v2`), V4 (`specs-bundle-v4`), [V5](V5_ECRANS_PAR_ROLE.md),
> [AUDIT_CDC_V2](AUDIT_CDC_V2.md), [AUDIT_MAQUETTES_PROTOTYPES](AUDIT_MAQUETTES_PROTOTYPES.md)
> et `test_alpha/02_SPECIFICATION_ADMIN_EVENEMENT`.
> Produit par fan-out 7 domaines → synthèse → **revue adversariale** (94 items relevés,
> 90 PR). État au 2026-06-28.

## Méthode (rappel)
**1 PR = 1 slice cohérente, peu de fichiers, pas de gros refactor.** Toute **nouvelle
table = STOP** (accord explicite de Gabin avant migration). Un rapport par PR dans
`roadmap/rapports/`. Gates : `tsc 0 · eslint 0 · prettier · jest vert`.

**Légende** : `{STOP: …}` = table/migration à valider · `<dep:…>` = prérequis ·
`[rôle]` · les **PR-NNx** lettrées sont des ajouts/correctifs issus de la revue adversariale.

## Invariants doctrine (vérifiés à chaque PR)
Miroir jamais coach · aucun verbe prescriptif (garde-fou `aiSafetyFilter`) · un seul
chiffre/visuel dominant · **le chrono n'est jamais le titre dominant seul (E2)** · or =
donnée uniquement · rouge = marque/REC · silence total en piste (S6) · **le partenaire ne
voit jamais la télémétrie** (deny-by-default) · l'app ne pré-remplit/suggère jamais le
contenu écrit du pilote · toute sortie IA filtrée + post-session + validée humain ·
**transfert IA hors-UE consenti** · pas de classement entre pilotes, pas de feed infini (D7).

## Déjà fait (ne pas re-livrer)
Nav 5 zones, design canon, Data Lab assemblé, accès coach gradué (0014), audit rôle (0015),
Qualité Data + devices/quality_reports (0016, **écran admin à faire**), marketplace
partner_accounts/offers/leads (0017, **écrans leads à faire**), rôle `pro_pilot` (0018/0019,
**espace à étoffer**), fix tours Charente/HS (PR-H), **filtre IA `aiSafetyFilter` créé mais
non branché**. La table `vehicles` existe déjà (CRUD garage = zéro schéma ; seul
`vehicle_setups` est neuf).

---

## M1 — Alpha sécurisée
*But : verrouiller la doctrine au runtime (filtre IA branché partout), fermer les trous
RGPD/sécurité, livrer les écrans P1 indispensables. Zéro schéma sauf tables support.*
**Le câblage du garde-fou IA (PR-01→05b) est la clé de voûte : il débloque tout le reste.**

| PR | Rôle | Intitulé | Schéma | Dépend |
|----|------|----------|--------|--------|
| **PR-01** | transverse | Brancher `assertDoctrineSafe` sur le générateur de débrief V1 | none | — |
| **PR-02** | transverse | Brancher `assertDoctrineSafe` sur `focusCorner` + insights générés | none | PR-01 |
| **PR-03** | transverse | Source unique du lexique + snapshot anti-divergence (incl. edge `generate-debrief-ai`) | none | PR-01,02 |
| **PR-04** | transverse | Garde-langage lintable — vocabulaire de jugement interdit (charte 09 §C) | none | PR-03 |
| **PR-05** | pilote | Bilan & débrief — garde `assertDoctrineSafe` au rendu | none | PR-01 |
| **PR-05b** | transverse | **RGPD bloquant** : `ai_debrief_enabled=false` bloque réellement l'appel OpenAI + opt-in minimal du transfert hors-UE | none | PR-01 |
| **PR-06** | système | Silence en piste (S6) — passerelle remote + garde notifications locales | none | — |
| **PR-07** | système | Audit B0.2 — `EmptyState` branché sur chaque écran data restant | none | — |
| **PR-08** | système | Bandeau perte BLE — **étendre** `OfflineBanner` existant (pas de réécriture) | none | — |
| **PR-09** | data | Tables support partagées pilote+admin | **{STOP: support_tickets, support_messages}** | — |
| **PR-10** | pilote | Support pilote — créer/suivre un ticket (dont demande RGPD) | none | PR-09 |
| **PR-11** | admin | Support admin — traiter les tickets (P0 en tête) | none | PR-09,10 |
| **PR-12** | admin | Admin Utilisateurs — annuaire + gestion de rôle **auditée** | none | — |
| **PR-13** | système | Étendre la matrice de tests RLS rôle-par-rôle (dette P0-2) | none | — |
| **PR-14** | système | Tests `appMap` — alias acyclique + cibles de route existantes | none | — |
| **PR-15** | système | Aligner l'UI consentement coach sur le cadre RGPD réel | none | — |
| **PR-16** | système | Vérifier export portabilité + suppression compte (couverture complète) | none | — |
| **PR-17** | système | Configurer `EXPO_PUBLIC_PLAUSIBLE_DOMAIN` (KPI no-op sinon) | none | — |
| **PR-18** | système | Build EAS preview iOS + smoke test device (PR-G/H/I) — **après reset quota (1er juil.)** | none | — |
| **PR-19** | système | Validation bout-en-bout capture réelle (sortie mode démo) | none | PR-18 |

---

## M2 — Public-ready
*But : livrer le concept **ÉVÉNEMENT** (table pivot → Pass OXV, leads/offres liés, B2B
Report, control-tower admin), compléter partenaire + pilote, durcir transparence IA et
honnêteté. Gros STOP : `events` + `event_registrations`.*

### Socle événement (pivot)
| PR | Rôle | Intitulé | Schéma | Dépend |
|----|------|----------|--------|--------|
| **PR-20** | admin/data | Socle ÉVÉNEMENT — **shape complet aligné sur `test_alpha/02`** (enum event_type session/balade_decouverte/test_alpha/partenaire/corporate, `location_coordinates`, `current_pilots`) + **ALTER sessions ADD event_id + context** + seed « Balade Découverte » | **{STOP: events ; ALTER telemetry_sessions ADD event_id, context}** | — |
| **PR-20b** | pilote | **Bandeau Bilan « mode démo »** quand `event_type != circuit` (analyses calibrées Beltoise → ne pas tromper sur données de campagne) | none | PR-20 |
| **PR-21** | admin | Admin Événements — liste + création/édition (5 sections) | none | PR-20 |
| **PR-22** | admin/data | `event_registrations` — inscriptions + check-in | **{STOP: event_registrations}** | PR-20 |
| **PR-23** | admin | Admin Détail événement — inscrits, devices, coachs/partenaires, export | none | PR-22 |
| **PR-24** | admin | Admin Check-in — scan QR Pass OXV (idempotent) | none | PR-22,23 |
| **PR-25** | admin | Admin Devices — parc + affectations (tables PR-D déjà là) | none | — |
| **PR-26** | pilote | Préparation session — checklist, documents, briefing, intention, météo | none | — |
| **PR-27** | pilote | Pass OXV — journée d'événement (QR check-in + contexte) | réutilise events/registrations | PR-20,22,26 |
| **PR-28** | admin | Admin Dashboard control-tower du jour | none | PR-11,21,25 |
| **PR-29** | admin | Hub admin — nav Événements/Devices/Utilisateurs/Support (**or interdit en nav**) | none | PR-21,25,12,11 |

### Partenaire (compléter la marketplace)
| PR | Rôle | Intitulé | Schéma | Dépend |
|----|------|----------|--------|--------|
| **PR-30** | partenaire | Profil partenaire — fiche entreprise + statut validation admin | none | — |
| **PR-31** | partenaire | Upload logo + documents (Storage) | none | PR-30 |
| **PR-32** | partenaire | Leads — **écran à créer** (`leads.tsx` absent), liste filtrable, **zéro télémétrie** | none | — |
| **PR-33** | partenaire | Détail lead — action statut, contact masqué si non consenti | none | PR-32 |
| **PR-34** | partenaire | Nav partenaire — ajouter l'entrée **Leads** (Accueil·Offres·Leads·Événements·Perf·Profil) | none | PR-30,32 |
| **PR-35** | partenaire | Champs offre complets | **{STOP: offers ADD category, valid_until, conditions, image_url}** | PR-20 |
| **PR-36** | partenaire | Champs fiche étendus | **{STOP: partner_accounts ADD geo_zone, documents + extension enum type}** | PR-30 |
| **PR-37** | partenaire | Événements partenaire — présence, offres liées | **{STOP: event_partners}** | PR-20 |

### Pilote + transverse (durcissement)
| PR | Rôle | Intitulé | Schéma | Dépend |
|----|------|----------|--------|--------|
| **PR-38** | pilote | Centre de consentement unifié (RGPD + coach + équipe + partage + **opt-in transfert IA hors-UE**) | none | PR-15,05b |
| **PR-39** | pilote | Garage — véhicules (CRUD zéro schéma) + journal de réglages | **{STOP: vehicle_setups}** | — |
| **PR-40** | pilote | Passeport — identité piste cumulative (radar signature dominant) | none | — |
| **PR-41** | transverse | Transparence IA — déclarer l'origine + bloc source/méthode (T1/T3/T4) | none | PR-01 |
| **PR-41b** | transverse | **Bloc « Ce que l'app ne dira jamais »** (LimitesMethode, charte 11 §T5, **obligatoire**) sur insights/data-lab | none | PR-41 |
| **PR-44b** | transverse | **Garde E2** — chrono jamais titre dominant ; couche tracé par défaut = Régularité ; `smoothest_lap` ≥ `fastest_lap` | none | — |
| **PR-42** | transverse | Honnêteté tarifaire (D4) — aligner la copie sur la table pricing réelle | none | — |
| **PR-43** | transverse | Audit doctrinal copie des notifications (factuelle, jamais prescriptive) | none | PR-04 |
| **PR-44** | transverse | Test « l'éthique peut échouer » — garde anti-tables compétitives + verdict agrégé (E1/T6) + **ligne D7 anti-feed-infini** | none | — |
| **PR-45** | système | Écran Maintenance — kill-switch distant | **{STOP: app_config}** | — |
| **PR-46** | système | Mise à jour obligatoire — gate version minimale | réutilise app_config | PR-45 |
| **PR-47** | système | Mode offline explicite + états système transverses (layout racine) | none | PR-45,46 |
| **PR-48** | système | AppBar — câbler les vraies actions de droite (tâche #25) | none | — |
| **PR-49** | système | Vérifier rétention/purge des trames (`cleanup_old_telemetry_frames`) | none | — |
| **PR-50** | système | Masquer `debug-capture`/`debug-circuit` derrière `__DEV__` en prod | none | — |

---

## M3 — Innovation V4
*But : Coach AI sous filtre dur, programmes adaptatifs, Data Confidence / Key Moments,
espace Pilote Pro complet, médias, performance partenaire. Forte densité de STOP-schéma.*

### Garde-fous & insights transverses
| PR | Rôle | Intitulé | Schéma | Dépend |
|----|------|----------|--------|--------|
| **PR-51** | transverse | Consolider le contrat de filtre IA réutilisable (jeton `ai-filter-wired`) | none | PR-01,02,03 |
| **PR-52** | transverse | Data Confidence Score — logique pure (T-2) | none | — |
| **PR-53** | transverse | Data Confidence — bandeau honnête (Bilan + Data Lab) | none | PR-52 |
| **PR-54** | transverse | OXV Key Moments — logique pure (T-3) | none | PR-01 |
| **PR-55** | transverse | OXV Key Moments — intégration écran Insights | none | PR-54 |

### Coach
| PR | Rôle | Intitulé | Schéma | Dépend |
|----|------|----------|--------|--------|
| **PR-56** | coach | Programmes adaptatifs — cycles qualitatifs | **{STOP: pilot_development_cycles, cycle_steps}** | — |
| **PR-57** | coach | Coach AI — `aiSafetyFilter` comme gate dur de `coachAiService` | none | PR-51 |
| **PR-58** | coach | Coach AI Assistant — priorisation + pré-brouillons (**dép. events retirée**) | **{STOP: coach_ai_suggestions, ai_safety_reviews}** | PR-57 |
| **PR-59** | coach | Note vocale sur annotation | **{STOP: col `audio_url` + bucket Storage}** | — |
| **PR-60** | coach | Coach hub — exposer Programmes + Assistant en nav | none | PR-56,58 |

### Pilote (carnet, identité, souveraineté)
| PR | Rôle | Intitulé | Schéma | Dépend |
|----|------|----------|--------|--------|
| **PR-61** | pilote | Carnet de notes — ressenti libre (jamais pré-rempli) | **{STOP: pilot_journal_entries}** | — |
| **PR-62** | pilote | Conditions & ressenti — juxtaposer faits météo / ressenti (sans corréler à la place du pilote) | réutilise PR-61 | PR-61 |
| **PR-63** | pilote | Carnet de circuits — collection factuelle (volet Passeport, pas un classement) | none | PR-40 |
| **PR-64** | pilote | Avatar driver — identité dérivée de la signature | none | PR-40 |
| **PR-65** | pilote | Carte de licence OXV — profil partageable (insigne factuel, pas un rang) | none | PR-40,64 |
| **PR-65b** | pilote | Empreinte de saison (maquette 70.3) — agrégat saisonnier identitaire (ou report documenté) | none | PR-40 |
| **PR-66** | pilote | Export CSV frames/laps bruts — souveraineté data (anti-lock-in) | none | — |

### Média & notifications
| PR | Rôle | Intitulé | Schéma | Dépend |
|----|------|----------|--------|--------|
| **PR-67** | pilote | Galerie média (15 §1.5) — consulter ses médias de session | none | — |
| **PR-68** | transverse | Notification `media_ready` — brancher le routage (sinon ne pas émettre) | none | PR-67 |
| **PR-69** | transverse | Garde-fou doctrine sur les captures Data Lab exportées (15 §1.4, rouge = marque) | none | — |

### Pilote Pro
| PR | Rôle | Intitulé | Schéma | Dépend |
|----|------|----------|--------|--------|
| **PR-70** | pro | Paddock Pro enrichi (hub contextuel) | none | — |
| **PR-71** | pro | Performance avancée (comparaison/tendances descriptives) | **{STOP: pilot_digital_twins si persisté}** | — |
| **PR-72** | pro | Bibliothèque de sessions (recherche multi-critères) | none | — |
| **PR-73** | pro | Média Pro (gestion + validation) | none | — |
| **PR-74** | pro | Espace Équipe (droits d'accès) | **{STOP: pro_team_members}** | — |
| **PR-75** | pro | Partage contrôlé (vitrine publique opt-in) | none | — |
| **PR-76** | pro | Garage (point d'entrée espace pro) | réutilise vehicles/vehicle_setups | PR-39,71 |
| **PR-77** | pro | Ambassadeur OXV | **{STOP: ambassador_profiles}** | — |
| **PR-78** | pro | Barre d'onglets pro (Paddock·Performance·Média·Équipe·Partage) | none | PR-70,71,73,74,75 |

### Partenaire & Admin (avancé)
| PR | Rôle | Intitulé | Schéma | Dépend |
|----|------|----------|--------|--------|
| **PR-79** | partenaire | Performance partenaire (agrégats dérivés leads/vues) | **{STOP: partner_profile_views si persisté}** | PR-32 |
| **PR-80** | partenaire | B2B Event Report — **trancher : agrégat dérivé (zéro table) OU cache** | **{STOP éventuel: b2b_event_reports}** | PR-37 |
| **PR-81** | partenaire | Facturation — placeholder honnête (phase Stripe séparée, D1 résiliation = simple) | none | — |
| **PR-82** | admin | Modération — traiter les signalements | **{STOP: moderation_reports}** | — |
| **PR-83** | admin | Analyse session — diagnostic + relance de pipeline | none | — |
| **PR-84** | admin | Business Dashboard + Analytics — enrichir l'analytique | none | PR-17 |
| **PR-85** | admin | Paramètres — feature flags + versions d'algos | **{STOP éventuel: app_feature_flags}** | — |
| **PR-86** | système | Nettoyage E6 — supprimer les coquilles de redirection après cycle alpha | none | PR-19 |

---

## Chemin critique (ce qui débloque quoi)
1. **Filtre IA branché** (PR-01→05b) → débloque débrief sûr, Key Moments (PR-54), Coach AI (PR-57/58), transparence (PR-41/41b).
2. **Socle `events`** (PR-20, shape complet `test_alpha/02`) → Pass OXV (PR-27), check-in (PR-24), offres/événements partenaire (PR-35/37), B2B Report (PR-80), control-tower (PR-28). **Coach AI ne dépend PAS d'events** (dépendance retirée).
3. **Tables support** (PR-09) → support pilote + admin (PR-10/11).
4. **Build post-reset quota** (PR-18, ≥ 1er juil.) → valider sur device tout ce qui est commité depuis le build #18.

## Décisions schéma à trancher (STOP — votre accord requis)
**M1** : `support_tickets`, `support_messages`.
**M2** : `events` + ALTER sessions (`event_id`, `context`) · `event_registrations` · `event_partners` · `offers` (+4 colonnes) · `partner_accounts` (+geo_zone, documents, enum) · `app_config` · `vehicle_setups`.
**M3** : `pilot_development_cycles`+`cycle_steps` · `coach_ai_suggestions`+`ai_safety_reviews` · `audio_url`+bucket · `pilot_journal_entries` · `pilot_digital_twins?` · `pro_team_members` · `ambassador_profiles` · `partner_profile_views?` · `moderation_reports` · `app_feature_flags?` · `b2b_event_reports?`.

## Issu de la revue adversariale (corrections déjà intégrées ci-dessus)
- **Bloquant RGPD** : transfert IA hors-UE (`generate-debrief-ai` → OpenAI US) → **PR-05b** (gate + opt-in) et **PR-38** (consentement complet). Distinct de la simple provenance (PR-41).
- **Majeur T5** : bloc « Ce que l'app ne dira jamais » obligatoire → **PR-41b**.
- **Majeur E2** : chrono jamais dominant, couche défaut = Régularité → **PR-44b**.
- **Majeur démo** : bandeau Bilan hors-circuit + flag `context` → **PR-20/20b**.
- **Ordonnancement** : PR-58 découplé d'events ; PR-08 = édition d'`OfflineBanner` existant ; PR-32/33 = créations (`leads.tsx` absent) ; PR-20 aligné sur le DDL complet `test_alpha/02` (migration atomique).
- **Reports cadrés (à ne pas perdre)** : feed communauté 60.1/60.3 **volontairement non livré** (pente classement) ; D7 anti-feed-infini → ligne d'audit PR-44 ; Empreinte de saison 70.3 → PR-65b.

> **Reco d'attaque** : PR-01 (clé de voûte, zéro schéma) déjà à moitié faite via `aiSafetyFilter`.
> Puis dérouler M1 dans l'ordre. Premier **STOP** à trancher : `support_tickets/messages` (PR-09).
> Premier gros **STOP** structurant : `events` (PR-20) — à caler sur le test alpha du 5 juillet.
